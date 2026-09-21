const mongoose = require("mongoose");
const {
    AUCTION_STATUS,
    AUCTION_CATEGORIES,
} = require("../constants/auctionConstants");

const auctionSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, "Auction title is required"],
            trim: true,
            minlength: [5, "Title must be at least 5 characters"],
            maxlength: [100, "Title cannot exceed 100 characters"],
        },

        description: {
            type: String,
            required: [true, "Description is required"],
            trim: true,
            minlength: [20, "Description must be at least 20 characters"],
            maxlength: [1000, "Description cannot exceed 1000 characters"],
        },

        category: {
           type: String,
           enum: Object.values(AUCTION_CATEGORIES),
            required: true,
        },

        startingPrice: {
            type: Number,
            required: true,
            min: [1, "Starting price must be greater than 0"],
        },

        currentPrice: {
            type: Number,
            required: true,
            min: [1, "Current price must be greater than 0"],
        },

        bidVersion: {
            type: Number,
            default: 0,
            select: false,
        },

        minIncrement: {
            type: Number,
            default: 1,
            min: [1, "Minimum increment must be at least 1"],
        },

        images: [
         {
            public_id: {
            type: String,
            required: true,
            },
            url: {
            type: String,
            required: true,
            },
         },
        ],

        seller: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        highestBidder: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        startTime: {
            type: Date,
            required: true,
        },

        endTime: {
            type: Date,
            required: true,
        },

       status: {
           type: String,
           enum: Object.values(AUCTION_STATUS),
           default: AUCTION_STATUS.UPCOMING,
        },

        totalBids: {
            type: Number,
            default: 0,
        },

        watchlistCount: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

auctionSchema.index({ status: 1, endTime: 1 });
auctionSchema.index({ category: 1, status: 1 });
auctionSchema.index({ seller: 1 });
auctionSchema.index({ status: 1, createdAt: -1 });
auctionSchema.index({ status: 1, currentPrice: 1 });

module.exports = mongoose.model("Auction", auctionSchema);