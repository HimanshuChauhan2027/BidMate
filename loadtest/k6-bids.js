import http from "k6/http";
import { check, sleep } from "k6";
import { Counter } from "k6/metrics";

const data = JSON.parse(open("./tokens.json"));

const BASE_URL = __ENV.BASE_URL || "http://localhost:5000/api";
const AUCTION_ID = __ENV.AUCTION_ID || data.auctionId;

const accepted = new Counter("bids_accepted");
const rejected = new Counter("bids_rejected");
const serverErrors = new Counter("server_errors");

// 200 (reads), 201 (accepted) and 400 (correctly rejected: too low, already leading)
// are both expected outcomes under contention.
http.setResponseCallback(http.expectedStatuses(200, 201, 400));

export const options = {
    scenarios: {
        bidding_war: {
            executor: "ramping-vus",
            startVUs: 0,
            stages: [
                { duration: "10s", target: 50 },
                { duration: "20s", target: 150 },
                { duration: "30s", target: 150 },
                { duration: "10s", target: 0 },
            ],
        },
    },
    thresholds: {
        server_errors: ["count==0"],
        "http_req_duration{name:place_bid}": ["p(95)<800"],
    },
};

export default function () {
    const token = data.tokens[(__VU - 1) % data.tokens.length];

    const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
    };

    const state = http.get(`${BASE_URL}/auctions/${AUCTION_ID}`, {
        tags: { name: "get_auction" },
    });

    if (state.status !== 200) {
        serverErrors.add(1);
        return;
    }

    const auction = state.json("auction");

    const floor =
        auction.totalBids > 0
            ? auction.currentPrice + (auction.minIncrement || 1)
            : auction.currentPrice;

    // A little jitter so several VUs often aim at the same price.
    const amount = floor + Math.floor(Math.random() * 3);

    const res = http.post(
        `${BASE_URL}/bids/${AUCTION_ID}`,
        JSON.stringify({ amount }),
        { headers, tags: { name: "place_bid" } }
    );

    if (res.status === 201) accepted.add(1);
    else if (res.status === 400) rejected.add(1);
    else serverErrors.add(1);

    check(res, {
        "no server error": (r) => r.status === 201 || r.status === 400,
    });

    sleep(Math.random() * 0.3);
}
