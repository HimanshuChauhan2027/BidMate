// Checks the bid data left behind by a load test.
//
//   node scripts/loadtestVerify.js <auctionId>
//
// Exits with code 1 if any invariant is broken.

const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const Auction = require("../src/models/Auction");
const Bid = require("../src/models/Bid");

const main = async () => {
    const auctionId = process.argv[2];

    if (!mongoose.Types.ObjectId.isValid(auctionId)) {
        console.error("Usage: node scripts/loadtestVerify.js <auctionId>");
        process.exit(2);
    }

    await mongoose.connect(process.env.MONGO_URI);

    const auction = await Auction.findById(auctionId).lean();

    if (!auction) {
        console.error("Auction not found.");
        process.exit(2);
    }

    const bids = await Bid.find({ auction: auctionId })
        .sort({ createdAt: 1, _id: 1 })
        .lean();

    const increment = auction.minIncrement ?? 1;
    const problems = [];

    if (bids.length !== auction.totalBids) {
        problems.push(
            `totalBids is ${auction.totalBids} but ${bids.length} bids are stored`
        );
    }

    bids.forEach((bid, index) => {
        const previous = bids[index - 1];

        if (!previous) {
            if (bid.amount < auction.startingPrice) {
                problems.push(`first bid ${bid.amount} is below the starting price`);
            }
            return;
        }

        const rises = bid.isAuto
            ? bid.amount >= previous.amount
            : bid.amount >= previous.amount + increment;

        if (!rises) {
            problems.push(
                `bid ${index + 1} (${bid.amount}${bid.isAuto ? ", auto" : ""}) ` +
                    `does not beat the previous bid (${previous.amount})`
            );
        }
    });

    const last = bids[bids.length - 1];

    if (last) {
        if (auction.currentPrice !== last.amount) {
            problems.push(
                `currentPrice ${auction.currentPrice} differs from last bid ${last.amount}`
            );
        }

        if (String(auction.highestBidder) !== String(last.bidder)) {
            problems.push("highestBidder is not the author of the last bid");
        }
    }

    const late = bids.filter((bid) => bid.createdAt > auction.endTime);

    if (late.length > 0) {
        problems.push(`${late.length} bids were stored after the end time`);
    }

    const bidders = new Set(bids.map((bid) => String(bid.bidder)));
    const autoCount = bids.filter((bid) => bid.isAuto).length;

    console.log(`Bids stored:     ${bids.length} (${autoCount} auto)`);
    console.log(`Distinct bidders: ${bidders.size}`);
    console.log(`Final price:     ${auction.currentPrice}`);
    console.log(`Status:          ${auction.status}`);

    if (problems.length === 0) {
        console.log("\nPASS: no lost updates, no out-of-order or late bids.");
    } else {
        console.log("\nFAIL:");
        problems.slice(0, 20).forEach((problem) => console.log(` - ${problem}`));
    }

    await mongoose.disconnect();

    process.exit(problems.length === 0 ? 0 : 1);
};

main().catch((error) => {
    console.error(error);
    process.exit(2);
});
