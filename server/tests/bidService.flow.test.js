// Flow test for bidService using small in-memory fakes of the models.
// It checks wiring and business rules (who leads, what price, who is
// outbid, anti-sniping). It does NOT prove real MongoDB concurrency
// behaviour; that is what loadtest/ is for.

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("module");

// ---------- tiny expression / filter evaluator (only what bidService uses)
const evalExpr = (expr, doc) => {
    if (typeof expr === "string" && expr.startsWith("$")) {
        return doc[expr.slice(1)];
    }

    if (expr && typeof expr === "object" && !(expr instanceof Date)) {
        const [op] = Object.keys(expr);
        const args = expr[op];

        switch (op) {
            case "$gte": {
                const [a, b] = args.map((x) => evalExpr(x, doc));
                return a >= b;
            }
            case "$eq": {
                const [a, b] = args.map((x) => evalExpr(x, doc));
                return a === b;
            }
            case "$add":
                return args.map((x) => evalExpr(x, doc)).reduce((a, b) => a + b, 0);
            case "$ifNull": {
                const [a, b] = args.map((x) => evalExpr(x, doc));
                return a ?? b;
            }
            case "$cond": {
                const [c, t, f] = args;
                return evalExpr(c, doc) ? evalExpr(t, doc) : evalExpr(f, doc);
            }
            default:
                throw new Error(`Unsupported operator ${op}`);
        }
    }

    return expr;
};

const asId = (v) => (v === null || v === undefined ? null : String(v));

const matches = (doc, filter) =>
    Object.entries(filter).every(([key, cond]) => {
        if (key === "$expr") return evalExpr(cond, doc) === true;
        if (key === "_id") return asId(doc._id) === asId(cond);

        const value = doc[key];

        if (cond && typeof cond === "object" && !(cond instanceof Date)) {
            if ("$ne" in cond) return asId(value) !== asId(cond.$ne);
            if ("$lte" in cond) return value <= cond.$lte;
            if ("$gt" in cond) return value > cond.$gt;
        }

        return asId(value) === asId(cond);
    });

const applyUpdate = (doc, update) => {
    Object.assign(doc, update.$set || {});

    Object.entries(update.$inc || {}).forEach(([key, by]) => {
        doc[key] = (doc[key] || 0) + by;
    });
};

const query = (getter) => {
    const q = {
        session: () => q,
        select: () => q,
        lean: () => q,
        then: (resolve, reject) => Promise.resolve(getter()).then(resolve, reject),
    };
    return q;
};

// ---------- fakes
let auction;
let autoBids;
let bids;
let reschedules;

const Auction = {
    findOne: async (filter) => {
        if (!matches(auction, filter)) return null;
        return { ...auction };
    },
    findOneAndUpdate: async (filter, update) => {
        if (!matches(auction, filter)) return null;
        const before = { ...auction };
        applyUpdate(auction, update);
        return before;
    },
    updateOne: async (filter, update) => {
        if (matches(auction, filter)) applyUpdate(auction, update);
    },
    findById: () => query(() => ({ ...auction })),
};

const AutoBid = {
    find: (filter) =>
        query(() => autoBids.filter((a) => matches(a, filter)).map((a) => ({ ...a }))),
    findOne: (filter) =>
        query(() => {
            const found = autoBids.find((a) => matches(a, filter));
            return found ? { ...found } : null;
        }),
    findOneAndUpdate: async (filter, update) => {
        const found = autoBids.find((a) => matches(a, filter));

        if (found) {
            applyUpdate(found, update);
        } else {
            autoBids.push({ ...filter, ...update.$set });
        }
    },
};

let idCounter = 0;

const Bid = {
    create: async (docs) =>
        docs.map((doc) => {
            idCounter += 1;

            const bid = {
                _id: `bid${idCounter}`,
                isAuto: false,
                createdAt: new Date(),
                ...doc,
            };

            bids.push(bid);
            return bid;
        }),
};

const fakeMongoose = {
    Types: { ObjectId: { isValid: () => true } },
    startSession: async () => ({
        withTransaction: async (fn) => {
            await fn();
        },
        endSession: async () => {},
    }),
};

const fakes = {
    mongoose: fakeMongoose,
    "../models/Auction": Auction,
    "../models/Bid": Bid,
    "../models/AutoBid": AutoBid,
    "../queues/auctionQueue": {
        rescheduleEnd: async (id, endTime) => {
            reschedules.push({ id, endTime });
        },
    },
};

const originalLoad = Module._load;

Module._load = function (request, ...rest) {
    if (fakes[request]) return fakes[request];
    return originalLoad.call(this, request, ...rest);
};

const { placeBid, setAutoBid } = require("../src/services/bidService");

Module._load = originalLoad;

const reset = () => {
    const now = Date.now();

    auction = {
        _id: "auc1",
        seller: "S",
        highestBidder: null,
        startingPrice: 1000,
        currentPrice: 1000,
        totalBids: 0,
        minIncrement: 10,
        startTime: new Date(now - 3600 * 1000),
        endTime: new Date(now + 3600 * 1000),
        status: "ACTIVE",
    };

    autoBids = [];
    bids = [];
    reschedules = [];
    idCounter = 0;
};

const rejects = (promise, message) =>
    assert.rejects(promise, (error) => {
        assert.equal(error.message, message);
        return true;
    });

test("bidding flow", async (t) => {
    reset();

    await t.test("first manual bid may equal the starting price", async () => {
        const r = await placeBid("auc1", "M", 1000);

        assert.equal(r.bids.length, 1);
        assert.equal(r.auction.currentPrice, 1000);
        assert.equal(String(r.auction.highestBidder), "M");
        assert.equal(r.auction.totalBids, 1);
        assert.deepEqual(r.outbid, []);
    });

    await t.test("rules are enforced with clear messages", async () => {
        await rejects(placeBid("auc1", "N", 1005), "Bid must be at least 1050.");
        await rejects(placeBid("auc1", "M", 2000), "You are already the highest bidder.");
        await rejects(placeBid("auc1", "S", 2000), "You cannot bid on your own auction.");
        await rejects(placeBid("auc1", "N", "abc"), "Please provide a valid bid amount.");
    });

    await t.test("an auto-bid takes the lead at one increment", async () => {
        const r = await setAutoBid("auc1", "A", 1500);

        assert.equal(String(r.auction.highestBidder), "A");
        assert.equal(r.auction.currentPrice, 1050);
        assert.equal(r.bids.length, 1);
        assert.equal(r.bids[0].isAuto, true);
        assert.deepEqual(r.outbid, ["M"]);
        assert.deepEqual(r.autoBid, { maxAmount: 1500 });
    });

    await t.test("a manual bid is answered by the auto-bid", async () => {
        const r = await placeBid("auc1", "N", 1200);

        assert.deepEqual(r.bids.map((b) => [b.bidder, b.amount, b.isAuto]), [
            ["N", 1200, false],
            ["A", 1250, true],
        ]);
        assert.equal(String(r.auction.highestBidder), "A");
        assert.deepEqual(r.outbid, ["N"]);
    });

    await t.test("a lower auto-bid pushes the leader's price up", async () => {
        const r = await setAutoBid("auc1", "B", 1300);

        assert.equal(String(r.auction.highestBidder), "A");
        assert.equal(r.auction.currentPrice, 1350);
        assert.deepEqual(r.outbid, []);
        assert.equal(r.auction.totalBids, 5);
    });

    await t.test("an auto-bid can only be raised", async () => {
        await rejects(setAutoBid("auc1", "A", 1400), "You can only raise your auto-bid.");
        await rejects(setAutoBid("auc1", "B", 1250), "Your maximum must be at least 1400.");
    });

    await t.test("a late bid extends the auction and reschedules the end", async () => {
        auction.endTime = new Date(Date.now() + 30 * 1000);

        const r = await placeBid("auc1", "C", 2000);

        assert.equal(r.extended, true);
        assert.ok(r.auction.endTime.getTime() > Date.now() + 100 * 1000);
        assert.equal(String(r.auction.highestBidder), "C");
        assert.equal(reschedules.length, 1);
    });

    await t.test("nothing can be placed after the end", async () => {
        auction.endTime = new Date(Date.now() - 1000);

        await rejects(placeBid("auc1", "D", 5000), "Auction has ended.");
        await rejects(setAutoBid("auc1", "D", 5000), "Auction has ended.");
    });
});
