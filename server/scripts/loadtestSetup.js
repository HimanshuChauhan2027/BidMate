// Creates throwaway users and one open auction for the k6 load test, and
// writes their JWTs to loadtest/tokens.json.
//
//   node scripts/loadtestSetup.js --bidders 200
//   node scripts/loadtestSetup.js --cleanup
//
// It writes to whatever MONGO_URI points at. Use a test database.

const path = require("path");
const fs = require("fs");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");

const User = require("../src/models/User");
const Auction = require("../src/models/Auction");
const Bid = require("../src/models/Bid");
const AutoBid = require("../src/models/AutoBid");
const generateToken = require("../src/utils/generateToken");
const {
    AUCTION_STATUS,
    AUCTION_CATEGORIES,
} = require("../src/constants/auctionConstants");

const args = process.argv.slice(2);

const flag = (name, fallback) => {
    const index = args.indexOf(`--${name}`);
    return index === -1 ? fallback : args[index + 1];
};

const EMAIL_DOMAIN = "@loadtest.invalid";
const TITLE_PREFIX = "LOADTEST";
const TOKENS_FILE = path.join(__dirname, "../../loadtest/tokens.json");

const cleanup = async () => {
    const auctions = await Auction.find({
        title: new RegExp(`^${TITLE_PREFIX}`),
    }).select("_id");

    const ids = auctions.map((auction) => auction._id);

    const bids = await Bid.deleteMany({ auction: { $in: ids } });
    const autoBids = await AutoBid.deleteMany({ auction: { $in: ids } });
    const removedAuctions = await Auction.deleteMany({ _id: { $in: ids } });
    const users = await User.deleteMany({
        email: new RegExp(`${EMAIL_DOMAIN.replace(".", "\\.")}$`),
    });

    if (fs.existsSync(TOKENS_FILE)) fs.unlinkSync(TOKENS_FILE);

    console.log(
        `Removed ${removedAuctions.deletedCount} auctions, ${bids.deletedCount} bids, ` +
            `${autoBids.deletedCount} auto-bids, ${users.deletedCount} users.`
    );
};

const upsertUser = (name, email) =>
    User.findOneAndUpdate(
        { email },
        {
            $setOnInsert: {
                name,
                email,
                password: "loadtest-user-never-logs-in",
            },
        },
        { upsert: true, returnDocument: "after" }
    );

const setup = async () => {
    const count = Number(flag("bidders", 100));
    const startingPrice = Number(flag("price", 1000));

    const seller = await upsertUser(
        "Load Test Seller",
        `seller${EMAIL_DOMAIN}`
    );

    const tokens = [];

    for (let i = 1; i <= count; i += 1) {
        const user = await upsertUser(
            `Load Bidder ${i}`,
            `bidder${i}${EMAIL_DOMAIN}`
        );

        tokens.push(generateToken(user._id));
    }

    const now = Date.now();

    const auction = await Auction.create({
        title: `${TITLE_PREFIX} auction ${new Date(now).toISOString()}`,
        description: "Throwaway auction used only by the k6 load test.",
        category: Object.values(AUCTION_CATEGORIES)[0],
        startingPrice,
        currentPrice: startingPrice,
        minIncrement: 1,
        images: [],
        seller: seller._id,
        startTime: new Date(now - 60 * 1000),
        endTime: new Date(now + 2 * 60 * 60 * 1000),
        status: AUCTION_STATUS.ACTIVE,
    });

    fs.mkdirSync(path.dirname(TOKENS_FILE), { recursive: true });
    fs.writeFileSync(
        TOKENS_FILE,
        JSON.stringify({ auctionId: String(auction._id), tokens }, null, 2)
    );

    console.log(`Auction:  ${auction._id}`);
    console.log(`Bidders:  ${count}`);
    console.log(`Tokens:   ${TOKENS_FILE}`);
};

const main = async () => {
    await mongoose.connect(process.env.MONGO_URI);

    try {
        if (args.includes("--cleanup")) {
            await cleanup();
        } else {
            await setup();
        }
    } finally {
        await mongoose.disconnect();
    }
};

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
