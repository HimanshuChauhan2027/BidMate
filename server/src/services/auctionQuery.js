const { AUCTION_STATUS, AUCTION_CATEGORIES } = require("../constants/auctionConstants");

const SORTS = {
    newest: { createdAt: -1, _id: -1 },
    priceLow: { currentPrice: 1, _id: 1 },
    priceHigh: { currentPrice: -1, _id: -1 },
    endingSoon: { endTime: 1, _id: 1 },
};

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const asString = (value) => (typeof value === "string" ? value : "");

// Turns the query string of GET /api/auctions into a Mongo filter, sort and
// page window. Anything unexpected falls back to a safe default.
const buildAuctionQuery = (params = {}) => {
    const page = Math.max(1, parseInt(params.page, 10) || 1);
    const limit = Math.min(48, Math.max(1, parseInt(params.limit, 10) || 12));

    const filter = {};

    const search = asString(params.search).trim().slice(0, 100);

    if (search) {
        filter.title = { $regex: escapeRegex(search), $options: "i" };
    }

    const category = asString(params.category);

    if (Object.values(AUCTION_CATEGORIES).includes(category)) {
        filter.category = category;
    }

    const status = asString(params.status).toUpperCase() || "OPEN";

    if (status === "OPEN") {
        filter.status = { $in: [AUCTION_STATUS.UPCOMING, AUCTION_STATUS.ACTIVE] };
    } else if (Object.values(AUCTION_STATUS).includes(status)) {
        filter.status = status;
    }

    return {
        filter,
        sort: SORTS[asString(params.sort)] || SORTS.newest,
        page,
        limit,
        skip: (page - 1) * limit,
    };
};

module.exports = { buildAuctionQuery };
