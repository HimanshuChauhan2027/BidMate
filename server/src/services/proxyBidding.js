// Pure proxy-bidding rules, kept free of database code so they can be
// unit tested (see server/tests/proxyBidding.test.js).
//
// candidates: [{ bidder, max, at }]  (at = when that maximum was committed)
// Returns { winner, price } when the leader or the price changes, else null.
const decideProxy = ({ holder, price, increment, candidates }) => {
    if (candidates.length === 0) return null;

    const ranked = [...candidates].sort(
        (a, b) => b.max - a.max || a.at - b.at
    );

    const [top, second] = ranked;

    let finalPrice = price;

    if (second) {
        finalPrice =
            top.max === second.max
                ? top.max
                : Math.min(top.max, second.max + increment);
    }

    finalPrice = Math.min(Math.max(finalPrice, price), top.max);

    if (top.bidder === holder && finalPrice === price) return null;

    return { winner: top.bidder, price: finalPrice };
};

module.exports = { decideProxy };
