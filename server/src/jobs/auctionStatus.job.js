const cron = require("node-cron");

const Auction = require("../models/Auction");
const { AUCTION_STATUS } = require("../constants/auctionConstants");
const { startAuction, closeAuction } = require("../services/auctionLifecycle");

// Safety net. With Redis configured, the BullMQ worker closes auctions on
// the second; this sweeper only catches anything that slipped through
// (Redis down, a missed job). Without Redis it is the only closer.
const startAuctionStatusJob = () => {
    cron.schedule("* * * * *", async () => {
        try {
            const now = new Date();

            const toStart = await Auction.find({
                status: AUCTION_STATUS.UPCOMING,
                startTime: { $lte: now },
                endTime: { $gt: now },
            }).select("_id");

            for (const auction of toStart) {
                await startAuction(auction._id);
            }

            const toEnd = await Auction.find({
                status: { $ne: AUCTION_STATUS.ENDED },
                endTime: { $lte: now },
            }).select("_id");

            for (const auction of toEnd) {
                await closeAuction(auction._id);
            }
        } catch (error) {
            console.error("Auction sweeper failed:", error.message);
        }
    });
};

module.exports = startAuctionStatusJob;
