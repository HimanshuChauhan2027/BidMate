// Small fixed-window rate limiter, no dependencies.
// Counters live in this process, so with several server instances each one
// counts separately. That is fine for abuse protection; for exact global
// limits, move the counters to Redis.
//
// Set RATE_LIMIT_DISABLED=true to switch every limiter off (load tests).

const MAX_TRACKED_KEYS = 100000;

const createRateLimiter = ({
    windowMs,
    max,
    message = "Too many requests. Please slow down.",
    key = (req) => req.ip,
}) => {
    const hits = new Map();

    const sweep = setInterval(() => {
        const now = Date.now();

        for (const [id, entry] of hits) {
            if (entry.resetAt <= now) hits.delete(id);
        }
    }, Math.max(windowMs, 60 * 1000));

    sweep.unref();

    return (req, res, next) => {
        if (process.env.RATE_LIMIT_DISABLED === "true") {
            next();
            return;
        }

        const now = Date.now();
        const id = String(key(req));

        let entry = hits.get(id);

        if (!entry || entry.resetAt <= now) {
            if (hits.size >= MAX_TRACKED_KEYS) hits.clear();

            entry = { count: 0, resetAt: now + windowMs };
            hits.set(id, entry);
        }

        entry.count += 1;

        res.set("RateLimit-Limit", String(max));
        res.set("RateLimit-Remaining", String(Math.max(0, max - entry.count)));

        if (entry.count > max) {
            res.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));

            res.status(429).json({ success: false, message });
            return;
        }

        next();
    };
};

const byUser = (req) => (req.user ? req.user._id : req.ip);

const apiLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 300,
});

// Counted per address AND email, so one campus or office sharing an IP
// cannot lock everyone else out, while guessing one account still stops.
const loginLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: "Too many login attempts. Please try again in a few minutes.",
    key: (req) => `${req.ip}:${String(req.body?.email || "").trim().toLowerCase()}`,
});

const registerLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: "Too many sign-ups from this address. Please try again later.",
});

const bidLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 60,
    message: "You are bidding too fast. Please wait a moment.",
    key: byUser,
});

const createAuctionLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: "You can create at most 10 auctions per hour.",
    key: byUser,
});

module.exports = {
    createRateLimiter,
    apiLimiter,
    loginLimiter,
    registerLimiter,
    bidLimiter,
    createAuctionLimiter,
};
