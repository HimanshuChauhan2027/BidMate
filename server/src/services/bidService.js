const mongoose = require("mongoose");

const Auction = require("../models/Auction");
const Bid = require("../models/Bid");
const AutoBid = require("../models/AutoBid");

const {
    AUCTION_STATUS,
    calculateMinimumIncrement,
} = require("../constants/auctionConstants");
const { rescheduleEnd } = require("../queues/auctionQueue");
const { decideProxy } = require("./proxyBidding");

// A bid in the last N minutes pushes the end to (bid time + N minutes).
// Set ANTI_SNIPE_MINUTES=0 to switch it off.
const SNIPE_MS = Number(process.env.ANTI_SNIPE_MINUTES ?? 2) * 60 * 1000;

class BidRejected extends Error {}

const getBidIncrement = (auction) =>
    Math.max(
        auction.minIncrement ?? 0,
        calculateMinimumIncrement(auction.startingPrice ?? auction.currentPrice)
    );

const parseAmount = (amount) => {
    const value = typeof amount === "string" ? Number(amount) : amount;

    if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value <= 0 ||
        value > 1e9
    ) {
        throw new Error("Please provide a valid bid amount.");
    }

    return value;
};

const openAuctionFilter = (auctionId, bidderId, now) => ({
    _id: auctionId,
    status: { $ne: AUCTION_STATUS.ENDED },
    startTime: { $lte: now },
    endTime: { $gt: now },
    seller: { $ne: bidderId },
});

const explainRejection = async (auctionId, bidderId, { forAutoBid }) => {
    const auction = await Auction.findById(auctionId).lean();

    if (!auction) return "Auction not found.";

    const now = new Date();

    if (auction.seller.toString() === bidderId.toString()) {
        return "You cannot bid on your own auction.";
    }

    if (auction.status === AUCTION_STATUS.ENDED || now >= auction.endTime) {
        return "Auction has ended.";
    }

    if (now < auction.startTime) {
        return "Auction has not started yet.";
    }

    if (
        !forAutoBid &&
        auction.highestBidder &&
        auction.highestBidder.toString() === bidderId.toString()
    ) {
        return "You are already the highest bidder.";
    }

    const minIncrement = getBidIncrement(auction);
    const minimum =
        auction.totalBids === 0
            ? auction.currentPrice
            : auction.currentPrice + minIncrement;

    return forAutoBid
        ? `Your maximum must be at least ${minimum}.`
        : `Bid must be at least ${minimum}.`;
};

const extendIfSniped = async (auctionId, endTime, now, session) => {
    if (SNIPE_MS > 0 && endTime.getTime() - now.getTime() < SNIPE_MS) {
        const extended = new Date(now.getTime() + SNIPE_MS);

        await Auction.updateOne(
            { _id: auctionId },
            { $set: { endTime: extended } },
            { session }
        );

        return { endTime: extended, extended: true };
    }

    return { endTime, extended: false };
};

// Proxy bidding. Treat every auto-bid maximum (and the current manual
// leader's price) as a sealed maximum. The highest maximum wins and pays
// one increment above the runner-up (or its own maximum if that is lower).
// Equal maximums go to the earliest. At most one proxy bid is written.
const resolveAutoBids = async ({ auctionId, session, now }) => {
    const auction = await Auction.findById(auctionId).session(session);

    const holder = auction.highestBidder ? String(auction.highestBidder) : null;
    const price = auction.currentPrice;
    const increment = getBidIncrement(auction);

    const autoBids = await AutoBid.find({ auction: auctionId })
        .session(session)
        .lean();

    const candidates = autoBids.map((autoBid) => {
        const bidder = String(autoBid.bidder);

        return {
            bidder,
            max: bidder === holder
                ? Math.max(autoBid.maxAmount, price)
                : autoBid.maxAmount,
            at: autoBid.placedAt.getTime(),
        };
    });

    if (holder && !candidates.some((c) => c.bidder === holder)) {
        candidates.push({ bidder: holder, max: price, at: now.getTime() });
    }

    const outcome = decideProxy({ holder, price, increment, candidates });

    if (!outcome) return null;

    await Auction.updateOne(
        { _id: auctionId },
        {
            $set: { currentPrice: outcome.price, highestBidder: outcome.winner },
            $inc: { totalBids: 1 },
        },
        { session }
    );

    const [bid] = await Bid.create(
        [
            {
                auction: auctionId,
                bidder: outcome.winner,
                amount: outcome.price,
                isAuto: true,
            },
        ],
        { session }
    );

    return { bid };
};

const readState = async (auctionId, session) => {
    const state = await Auction.findById(auctionId)
        .session(session)
        .select("currentPrice highestBidder totalBids endTime")
        .lean();

    return {
        id: auctionId,
        currentPrice: state.currentPrice,
        highestBidder: state.highestBidder,
        totalBids: state.totalBids,
        endTime: state.endTime,
    };
};

// Everyone who led during this request but is not the final leader.
const outbidUsers = (leaders, finalLeader) => {
    const final = String(finalLeader);

    return [...new Set(leaders.filter(Boolean).map(String))].filter(
        (id) => id !== final
    );
};

const afterCommit = (auctionId, result) => {
    if (result.extended) {
        rescheduleEnd(auctionId, result.auction.endTime).catch((error) => {
            console.error("Could not reschedule auction end:", error.message);
        });
    }
};

const placeBid = async (auctionId, bidderId, amount) => {
    if (!mongoose.Types.ObjectId.isValid(auctionId)) {
        throw new Error("Invalid auction ID.");
    }

    const value = parseAmount(amount);

    const session = await mongoose.startSession();

    let result;

    try {
        await session.withTransaction(async () => {
            const now = new Date();

            const current = await Auction.findOne(
                {
                    ...openAuctionFilter(auctionId, bidderId, now),
                    highestBidder: { $ne: bidderId },
                },
                null,
                { session }
            );

            if (!current) {
                throw new BidRejected();
            }

            const increment = getBidIncrement(current);
            const minimum =
                current.totalBids === 0
                    ? current.currentPrice
                    : current.currentPrice + increment;

            if (value < minimum) {
                throw new BidRejected();
            }

            const before = await Auction.findOneAndUpdate(
                {
                    ...openAuctionFilter(auctionId, bidderId, now),
                    highestBidder: { $ne: bidderId },
                },
                {
                    $set: {
                        currentPrice: value,
                        highestBidder: bidderId,
                        status: AUCTION_STATUS.ACTIVE,
                    },
                    $inc: { totalBids: 1 },
                },
                { returnDocument: "before", session }
            );

            if (!before) {
                throw new BidRejected();
            }

            const snipe = await extendIfSniped(
                auctionId,
                before.endTime,
                now,
                session
            );

            const [manualBid] = await Bid.create(
                [{ auction: auctionId, bidder: bidderId, amount: value }],
                { session }
            );

            const proxy = await resolveAutoBids({ auctionId, session, now });

            const auction = await readState(auctionId, session);

            result = {
                bids: proxy ? [manualBid, proxy.bid] : [manualBid],
                auction,
                extended: snipe.extended,
                outbid: outbidUsers(
                    [before.highestBidder, bidderId],
                    auction.highestBidder
                ),
            };
        });
    } catch (error) {
        if (error instanceof BidRejected) {
            throw new Error(
                await explainRejection(auctionId, bidderId, {
                    forAutoBid: false,
                })
            );
        }
        throw error;
    } finally {
        await session.endSession();
    }

    afterCommit(auctionId, result);

    return result;
};

const setAutoBid = async (auctionId, bidderId, maxAmount) => {
    if (!mongoose.Types.ObjectId.isValid(auctionId)) {
        throw new Error("Invalid auction ID.");
    }

    const value = parseAmount(maxAmount);

    const session = await mongoose.startSession();

    let result;

    try {
        await session.withTransaction(async () => {
            const now = new Date();

            const current = await Auction.findOne(
                {
                    ...openAuctionFilter(auctionId, bidderId, now),
                },
                null,
                { session }
            );

            if (!current) {
                throw new BidRejected();
            }

            const increment = getBidIncrement(current);
            const minimum =
                current.totalBids === 0
                    ? current.currentPrice
                    : current.currentPrice + increment;

            if (value < minimum) {
                throw new BidRejected();
            }

            // A real write on the auction document takes its lock, so every
            // bid and auto-bid on this auction is serialised from here on.
            const before = await Auction.findOneAndUpdate(
                {
                    ...openAuctionFilter(auctionId, bidderId, now),
                },
                { $inc: { bidVersion: 1 } },
                { returnDocument: "before", session }
            );

            if (!before) {
                throw new BidRejected();
            }

            const existing = await AutoBid.findOne({
                auction: auctionId,
                bidder: bidderId,
            }).session(session);

            if (existing && value <= existing.maxAmount) {
                throw new BidRejected("You can only raise your auto-bid.");
            }

            await AutoBid.findOneAndUpdate(
                { auction: auctionId, bidder: bidderId },
                { $set: { maxAmount: value, placedAt: now } },
                { upsert: true, session }
            );

            const proxy = await resolveAutoBids({ auctionId, session, now });

            const snipe = proxy
                ? await extendIfSniped(auctionId, before.endTime, now, session)
                : { endTime: before.endTime, extended: false };

            const auction = await readState(auctionId, session);

            result = {
                bids: proxy ? [proxy.bid] : [],
                auction,
                extended: snipe.extended,
                outbid: outbidUsers([before.highestBidder], auction.highestBidder),
                autoBid: { maxAmount: value },
            };
        });
    } catch (error) {
        if (error instanceof BidRejected) {
            throw new Error(
                error.message ||
                    (await explainRejection(auctionId, bidderId, {
                        forAutoBid: true,
                    }))
            );
        }
        throw error;
    } finally {
        await session.endSession();
    }

    afterCommit(auctionId, result);

    return result;
};

const getMyAutoBid = async (auctionId, userId) => {
    if (!mongoose.Types.ObjectId.isValid(auctionId)) {
        throw new Error("Invalid auction ID.");
    }

    const autoBid = await AutoBid.findOne({
        auction: auctionId,
        bidder: userId,
    }).lean();

    return autoBid ? { maxAmount: autoBid.maxAmount } : null;
};

const getBidHistory = async (auctionId, limitParam) => {
    if (!mongoose.Types.ObjectId.isValid(auctionId)) {
        throw new Error("Invalid auction ID.");
    }

    const auction = await Auction.findById(auctionId);

    if (!auction) {
        throw new Error("Auction not found.");
    }

    const bids = await Bid.find({ auction: auctionId })
        .populate({ path: "bidder", select: "name" })
        .sort({ createdAt: -1, _id: -1 })
        .limit(Math.min(500, Math.max(1, parseInt(limitParam, 10) || 100)));

    return bids;
};

const getMyBids = async (userId) => {
    const bids = await Bid.find({ bidder: userId })
        .populate({
            path: "auction",
            select: "title currentPrice startingPrice minIncrement status endTime images seller highestBidder totalBids",
        })
        .sort({ createdAt: -1 });

    return bids;
};

module.exports = {
    placeBid,
    setAutoBid,
    getMyAutoBid,
    getBidHistory,
    getMyBids,
};
