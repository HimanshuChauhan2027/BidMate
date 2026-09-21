const mongoose = require("mongoose");

const bidSchema = new mongoose.Schema(
    {
        auction: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Auction",
            required: true,
        },

        bidder: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        amount: {
            type: Number,
            required: true,
            min: [1, "Bid amount must be greater than 0"],
        },

        isAuto: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

// Optimize fetching bid history for an auction
bidSchema.index({ auction: 1, createdAt: -1 });

// User bid history
bidSchema.index({ bidder: 1 });

module.exports = mongoose.model("Bid", bidSchema);