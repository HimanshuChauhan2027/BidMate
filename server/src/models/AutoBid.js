const mongoose = require("mongoose");

const autoBidSchema = new mongoose.Schema(
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

        maxAmount: {
            type: Number,
            required: true,
            min: [1, "Maximum bid must be greater than 0"],
        },

        // When this maximum was last raised. Used to break ties:
        // equal maximums go to whoever committed first.
        placedAt: {
            type: Date,
            required: true,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

autoBidSchema.index({ auction: 1, bidder: 1 }, { unique: true });

module.exports = mongoose.model("AutoBid", autoBidSchema);
