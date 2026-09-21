const Auction = require("../models/Auction");
const mongoose = require("mongoose");
const { AUCTION_STATUS } = require("../constants/auctionConstants");
const fs = require("fs-extra");
const cloudinary = require("../config/cloudinary");
const Bid = require("../models/Bid");
const { scheduleAuctionJobs } = require("../queues/auctionQueue");
const { buildAuctionQuery } = require("./auctionQuery");

const parseDate = (value, label) => {
    const date = new Date(value);

    if (!value || Number.isNaN(date.getTime())) {
        throw new Error(`${label} is invalid.`);
    }

    return date;
};

const parseIncrement = (value) => {
    if (value === undefined || value === null || value === "") return 1;

    const increment = Number(value);

    if (!Number.isFinite(increment) || increment < 1) {
        throw new Error("Minimum increment must be at least 1.");
    }

    return increment;
};

const removeTempFiles = async (files) => {
    await Promise.all(
        (files || [])
            .filter((file) => file && typeof file === "object" && file.path)
            .map((file) => fs.remove(file.path).catch(() => {}))
    );
};

const createAuction = async (auctionData, sellerId, files) => {
    const uploadedImages = [];

    try {
        const {
            title,
            description,
            category,
            startingPrice,
            minIncrement,
            startTime,
            endTime,
        } = auctionData;

        const increment = parseIncrement(minIncrement);
        const start = parseDate(startTime, "Start time");
        const end = parseDate(endTime, "End time");

        if (start >= end) {
            throw new Error("Start time must be before end time.");
        }

        const now = new Date();

        if (end <= now) {
            throw new Error("End time must be in the future.");
        }

        const price = Number(startingPrice);

        if (!Number.isFinite(price) || price < 1) {
            throw new Error("Starting price must be at least 1.");
        }

        const status =
            now < start ? AUCTION_STATUS.UPCOMING : AUCTION_STATUS.ACTIVE;

        for (const file of files || []) {
            if (!file || typeof file !== "object" || !file.path) {
                continue;
            }

            const result = await cloudinary.uploader.upload(file.path, {
                folder: "BidSync/Auctions",
            });

            uploadedImages.push({
                public_id: result.public_id,
                url: result.secure_url,
            });
        }

        const auction = await Auction.create({
            title,
            description,
            category,
            startingPrice: price,
            currentPrice: price,
            images: uploadedImages,
            seller: sellerId,
            startTime: start,
            endTime: end,
            status,
            minIncrement: increment,
        });

        scheduleAuctionJobs(auction).catch((error) => {
            console.error("Could not schedule auction jobs:", error.message);
        });

        return auction;
    } catch (error) {
        await Promise.all(
            uploadedImages.map((image) =>
                cloudinary.uploader.destroy(image.public_id).catch(() => {})
            )
        );

        throw error;
    } finally {
        await removeTempFiles(files);
    }
};

const getAllAuctions = async (params) => {
    const { filter, sort, page, limit, skip } = buildAuctionQuery(params);

    const [auctions, total] = await Promise.all([
        Auction.find(filter)
            .populate("seller", "name")
            .sort(sort)
            .skip(skip)
            .limit(limit),
        Auction.countDocuments(filter),
    ]);

    return {
        auctions,
        total,
        page,
        pages: Math.max(1, Math.ceil(total / limit)),
    };
};

const getAuctionById = async (auctionId) => {

     if (!mongoose.Types.ObjectId.isValid(auctionId)) {
        throw new Error("Invalid auction ID.");
    }
    const auction = await Auction.findById(auctionId)
        .populate("seller", "name avatar")
        .populate("highestBidder", "name");

    if (!auction) {
        throw new Error("Auction not found.");
    }

    return auction;
};

const updateAuction = async (auctionId, sellerId, updateData) => {

    if (!mongoose.Types.ObjectId.isValid(auctionId)) {
        throw new Error("Invalid auction ID.");
    }

    const auction = await Auction.findById(auctionId);

    if (!auction) {
        throw new Error("Auction not found.");
    }

    // Authorization
    if (auction.seller.toString() !== sellerId.toString()) {
        throw new Error("You are not authorized to update this auction.");
    }

    // Business Rule
    if (auction.status !== AUCTION_STATUS.UPCOMING) {
        throw new Error("Only upcoming auctions can be updated.");
    }

    const {
        title,
        description,
        category,
        minIncrement,
        startTime,
        endTime,
    } = updateData;

    const newStartTime =
        startTime !== undefined
            ? parseDate(startTime, "Start time")
            : auction.startTime;

    const newEndTime =
        endTime !== undefined
            ? parseDate(endTime, "End time")
            : auction.endTime;

    if (newStartTime >= newEndTime) {
        throw new Error("Start time must be before end time.");
    }

    if (newEndTime <= new Date()) {
        throw new Error("End time must be in the future.");
    }

    // Update only allowed fields
    if (title !== undefined) auction.title = title;
    if (description !== undefined) auction.description = description;
    if (category !== undefined) auction.category = category;
    if (minIncrement !== undefined) {
        auction.minIncrement = parseIncrement(minIncrement);
    }
    if (startTime !== undefined) auction.startTime = newStartTime;
    if (endTime !== undefined) auction.endTime = newEndTime;

    await auction.save();

    scheduleAuctionJobs(auction).catch((error) => {
        console.error("Could not schedule auction jobs:", error.message);
    });

    return auction;
};

const deleteAuction = async (auctionId, sellerId) => {

    if (!mongoose.Types.ObjectId.isValid(auctionId)) {
        throw new Error("Invalid auction ID.");
    }

    const auction = await Auction.findById(auctionId);

    if (!auction) {
        throw new Error("Auction not found.");
    }

    if (auction.seller.toString() !== sellerId.toString()) {
        throw new Error("You are not authorized to delete this auction.");
    }

    if (auction.status !== AUCTION_STATUS.UPCOMING) {
        throw new Error("Only upcoming auctions can be deleted.");
    }

    const bidExists = await Bid.exists({ auction: auctionId });

    if (bidExists) {
        throw new Error(
            "Auction cannot be deleted because bids have already been placed."
        );
    }

  if (auction.images?.length) {
    for (const image of auction.images) {
        await cloudinary.uploader.destroy(image.public_id);
    }
}
    await auction.deleteOne();
};
const getMyAuctions = async (sellerId) => {
    const auctions = await Auction.find({ seller: sellerId })
        .sort({ createdAt: -1 });

    return auctions;
};
const getWonAuctions = async (userId) => {
    return await Auction.find({
        highestBidder: userId,
        status: "ENDED",
    })
        .populate("seller", "name")
        .sort({ updatedAt: -1 });
};
module.exports = {createAuction,getAllAuctions,getAuctionById,updateAuction,deleteAuction,getMyAuctions,getWonAuctions,};