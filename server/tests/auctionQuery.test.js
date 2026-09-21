const test = require("node:test");
const assert = require("node:assert/strict");

const { buildAuctionQuery } = require("../src/services/auctionQuery");

test("defaults: open auctions, newest first, first page of 12", () => {
    const q = buildAuctionQuery({});

    assert.deepEqual(q.filter, { status: { $in: ["UPCOMING", "ACTIVE"] } });
    assert.deepEqual(q.sort, { createdAt: -1, _id: -1 });
    assert.equal(q.page, 1);
    assert.equal(q.limit, 12);
    assert.equal(q.skip, 0);
});

test("paging is clamped and skip is computed", () => {
    const q = buildAuctionQuery({ page: "3", limit: "500" });

    assert.equal(q.limit, 48);
    assert.equal(q.skip, 96);
    assert.equal(buildAuctionQuery({ page: "-4", limit: "0" }).page, 1);
    assert.equal(buildAuctionQuery({ page: "abc" }).page, 1);
});

test("search is escaped so it cannot become a regex attack", () => {
    const q = buildAuctionQuery({ search: "  a.b*(c  " });

    assert.equal(q.filter.title.$regex, "a\\.b\\*\\(c");
    assert.equal(q.filter.title.$options, "i");
});

test("category must be a real category", () => {
    assert.equal(
        buildAuctionQuery({ category: "Home & Furniture" }).filter.category,
        "Home & Furniture"
    );
    assert.equal(buildAuctionQuery({ category: "Nope" }).filter.category, undefined);
});

test("status values", () => {
    assert.equal(buildAuctionQuery({ status: "ended" }).filter.status, "ENDED");
    assert.equal(buildAuctionQuery({ status: "active" }).filter.status, "ACTIVE");
    assert.equal("status" in buildAuctionQuery({ status: "all" }).filter, false);
    assert.deepEqual(buildAuctionQuery({ status: "garbage" }).filter, {});
});

test("sort options, unknown falls back to newest", () => {
    assert.deepEqual(buildAuctionQuery({ sort: "priceLow" }).sort, { currentPrice: 1, _id: 1 });
    assert.deepEqual(buildAuctionQuery({ sort: "endingSoon" }).sort, { endTime: 1, _id: 1 });
    assert.deepEqual(buildAuctionQuery({ sort: "x" }).sort, { createdAt: -1, _id: -1 });
});

test("non-string params (objects, arrays) are ignored", () => {
    const q = buildAuctionQuery({
        search: { $ne: "" },
        category: ["Books"],
        status: { $ne: "ENDED" },
        sort: ["priceLow"],
    });

    assert.deepEqual(q.filter, { status: { $in: ["UPCOMING", "ACTIVE"] } });
    assert.deepEqual(q.sort, { createdAt: -1, _id: -1 });
});
