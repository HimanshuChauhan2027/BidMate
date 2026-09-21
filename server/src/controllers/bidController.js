const bidService = require("../services/bidService");
const User = require("../models/User");
const { getIO } = require("../socket");

const buildUpdate = async (auctionId, result) => {
    const ids = [
        ...new Set([
            String(result.auction.highestBidder),
            ...result.bids.map((bid) => String(bid.bidder)),
        ]),
    ];

    const users = await User.find({ _id: { $in: ids } })
        .select("name")
        .lean();

    const names = Object.fromEntries(
        users.map((user) => [String(user._id), user.name])
    );

    const person = (id) => ({
        _id: String(id),
        name: names[String(id)] || "Bidder",
    });

    return {
        auctionId,
        currentPrice: result.auction.currentPrice,
        totalBids: result.auction.totalBids,
        endTime: result.auction.endTime,
        highestBidder: person(result.auction.highestBidder),
        bids: result.bids.map((bid) => ({
            _id: bid._id,
            amount: bid.amount,
            createdAt: bid.createdAt,
            isAuto: bid.isAuto,
            bidder: person(bid.bidder),
        })),
        extended: result.extended,
        serverTime: Date.now(),
    };
};

const broadcast = (auctionId, update, outbid) => {
    try {
        const io = getIO();

        io.to(auctionId).emit("new-bid", update);

        outbid.forEach((userId) => {
            io.to(`user:${userId}`).emit("outbid", {
                auctionId,
                currentPrice: update.currentPrice,
            });
        });
    } catch (error) {
        console.error("Socket emit failed:", error.message);
    }
};

const respond = async (req, res, result, message) => {
    const auctionId = req.params.auctionId;

    const update = await buildUpdate(auctionId, result);

    broadcast(auctionId, update, result.outbid);

    res.status(201).json({
        success: true,
        message,
        update,
        outbidYou: result.outbid.includes(String(req.user._id)),
        autoBid: result.autoBid || null,
    });
};

const placeBid = async (req, res) => {
    try {
        const result = await bidService.placeBid(
            req.params.auctionId,
            req.user._id,
            req.body.amount
        );

        await respond(req, res, result, "Bid placed successfully.");
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

const setAutoBid = async (req, res) => {
    try {
        const result = await bidService.setAutoBid(
            req.params.auctionId,
            req.user._id,
            req.body.maxAmount
        );

        await respond(req, res, result, "Auto-bid saved.");
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

const getMyAutoBid = async (req, res) => {
    try {
        const autoBid = await bidService.getMyAutoBid(
            req.params.auctionId,
            req.user._id
        );

        res.status(200).json({
            success: true,
            autoBid,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

const getBidHistory = async (req, res) => {
    try {
        const bids = await bidService.getBidHistory(
            req.params.auctionId,
            req.query.limit
        );

        res.status(200).json({
            success: true,
            bids,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

const getMyBids = async (req, res) => {
    try {
        const bids = await bidService.getMyBids(req.user._id);

        res.status(200).json({
            success: true,
            bids,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

module.exports = {
    placeBid,
    setAutoBid,
    getMyAutoBid,
    getBidHistory,
    getMyBids,
};
