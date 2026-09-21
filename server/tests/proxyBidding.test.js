const test = require("node:test");
const assert = require("node:assert/strict");

const { decideProxy } = require("../src/services/proxyBidding");

const I = 10;

const run = (holder, price, candidates) =>
    decideProxy({ holder, price, increment: I, candidates });

test("first auto-bid on an empty auction bids the starting price", () => {
    const out = run(null, 1000, [{ bidder: "A", max: 1500, at: 1 }]);
    assert.deepEqual(out, { winner: "A", price: 1000 });
});

test("auto-bid beats a lower manual bid by one increment", () => {
    const out = run("M", 1200, [
        { bidder: "A", max: 1500, at: 1 },
        { bidder: "M", max: 1200, at: 9 },
    ]);
    assert.deepEqual(out, { winner: "A", price: 1210 });
});

test("auto-bid answers a higher manual bid, still under its max", () => {
    const out = run("M", 1400, [
        { bidder: "A", max: 1500, at: 1 },
        { bidder: "M", max: 1400, at: 9 },
    ]);
    assert.deepEqual(out, { winner: "A", price: 1410 });
});

test("equal amounts go to the earlier commitment", () => {
    const out = run("M", 1500, [
        { bidder: "A", max: 1500, at: 1 },
        { bidder: "M", max: 1500, at: 9 },
    ]);
    assert.deepEqual(out, { winner: "A", price: 1500 });
});

test("a manual bid above every auto max stands unchanged", () => {
    const out = run("M", 1600, [
        { bidder: "A", max: 1500, at: 1 },
        { bidder: "M", max: 1600, at: 9 },
    ]);
    assert.equal(out, null);
});

test("leader's price rises when a lower auto-bid is added", () => {
    const out = run("A", 1000, [
        { bidder: "A", max: 1500, at: 1 },
        { bidder: "B", max: 1300, at: 2 },
    ]);
    assert.deepEqual(out, { winner: "A", price: 1310 });
});

test("two equal auto maximums: earliest wins at that maximum", () => {
    const out = run("A", 1000, [
        { bidder: "A", max: 1500, at: 1 },
        { bidder: "B", max: 1500, at: 2 },
    ]);
    assert.deepEqual(out, { winner: "A", price: 1500 });
});

test("a higher new auto-bid takes the lead one increment over the old max", () => {
    const out = run("A", 1310, [
        { bidder: "A", max: 1500, at: 1 },
        { bidder: "C", max: 2000, at: 3 },
    ]);
    assert.deepEqual(out, { winner: "C", price: 1510 });
});

test("a winner whose max is under a full increment pays its own max", () => {
    const out = run("M", 1200, [
        { bidder: "A", max: 1205, at: 1 },
        { bidder: "M", max: 1200, at: 9 },
    ]);
    assert.deepEqual(out, { winner: "A", price: 1205 });
});

test("nothing to do without candidates", () => {
    assert.equal(run(null, 1000, []), null);
});

test("invariants hold for random auctions", () => {
    let seed = 12345;
    const rand = (n) => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed % n;
    };

    for (let round = 0; round < 5000; round += 1) {
        const price = 1000 + rand(500);
        const count = 1 + rand(5);
        const candidates = [];

        for (let i = 0; i < count; i += 1) {
            candidates.push({
                bidder: `U${i}`,
                max: price + rand(800),
                at: rand(50),
            });
        }

        const holder = candidates[rand(count)].bidder;
        const out = run(holder, price, candidates);

        const best = [...candidates].sort(
            (a, b) => b.max - a.max || a.at - b.at
        )[0];

        if (out === null) {
            assert.equal(best.bidder, holder);
            continue;
        }

        assert.equal(out.winner, best.bidder);
        assert.ok(out.price <= best.max, "never exceeds the winner's max");
        assert.ok(out.price >= price, "price never goes down");
    }
});
