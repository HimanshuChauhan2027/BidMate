const Auction = require("../models/Auction");
const { AUCTION_STATUS } = require("../constants/auctionConstants");
const { getIO } = require("../socket");

const emitToRoom = (room, event, payload) => {
    try {
        getIO().to(room).emit(event, payload);
    } catch (error) {
        console.error(`Socket emit failed (${event}):`, error.message);
    }
};

const startAuction = async (auctionId) => {
    const now = new Date();

    const auction = await Auction.findOneAndUpdate(
        {
            _id: auctionId,
            status: AUCTION_STATUS.UPCOMING,
            startTime: { $lte: now },
            endTime: { $gt: now },
        },
        { $set: { status: AUCTION_STATUS.ACTIVE } },
        { returnDocument: "after" }
    );

    if (auction) {
        const id = String(auction._id);
        emitToRoom(id, "auction-started", { auctionId: id });
    }

    return auction;
};

// Idempotent: only the first caller that finds an overdue, not-yet-ended
// auction gets a document back. Everyone else (a retry, a second server
// instance, the cron sweeper) gets null and does nothing.
const closeAuction = async (auctionId) => {
    const auction = await Auction.findOneAndUpdate(
        {
            _id: auctionId,
            status: { $ne: AUCTION_STATUS.ENDED },
            endTime: { $lte: new Date() },
        },
        { $set: { status: AUCTION_STATUS.ENDED } },
        { returnDocument: "after" }
    );

    if (!auction) return null;

    const id = String(auction._id);
    const winnerId = auction.highestBidder
        ? String(auction.highestBidder)
        : null;

    emitToRoom(id, "auction-ended", {
        auctionId: id,
        winnerId,
        finalPrice: auction.currentPrice,
        totalBids: auction.totalBids,
    });

    if (winnerId) {
        emitToRoom(`user:${winnerId}`, "auction-won", {
            auctionId: id,
            title: auction.title,
            finalPrice: auction.currentPrice,
        });
    }

    return auction;
};

module.exports = {
    startAuction,
    closeAuction,
};
