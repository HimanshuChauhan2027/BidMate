const AUCTION_STATUS = {
    UPCOMING: "UPCOMING",
    ACTIVE: "ACTIVE",
    ENDED: "ENDED",
};

const AUCTION_CATEGORIES = {
    ELECTRONICS: "Electronics",
    FASHION: "Fashion",
    HOME_FURNITURE: "Home & Furniture",
    BOOKS: "Books",
    SPORTS: "Sports",
    VEHICLES: "Vehicles",
    COLLECTIBLES: "Collectibles",
    ART: "Art",
    JEWELLERY: "Jewellery",
    OTHERS: "Others",
};

const calculateMinimumIncrement = (price) => {
    const amount = Number(price);

    if (!Number.isFinite(amount) || amount < 1) return 10;

    return Math.max(10, Math.ceil((amount * 0.05) / 10) * 10);
};

module.exports = {
    AUCTION_STATUS,
    AUCTION_CATEGORIES,
    calculateMinimumIncrement,
};