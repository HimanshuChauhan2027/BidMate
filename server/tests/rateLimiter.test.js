const test = require("node:test");
const assert = require("node:assert/strict");

const { createRateLimiter } = require("../src/middleware/rateLimiter");

const fakeRes = () => {
    const res = {
        headers: {},
        statusCode: 200,
        body: null,
        set(name, value) {
            this.headers[name] = value;
            return this;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
    };
    return res;
};

const hit = (limiter, req) => {
    const res = fakeRes();
    let passed = false;

    limiter(req, res, () => {
        passed = true;
    });

    return { res, passed };
};

test("allows up to max requests, then answers 429 with Retry-After", () => {
    const limiter = createRateLimiter({ windowMs: 60000, max: 3 });
    const req = { ip: "1.1.1.1" };

    for (let i = 0; i < 3; i += 1) {
        assert.equal(hit(limiter, req).passed, true);
    }

    const blocked = hit(limiter, req);

    assert.equal(blocked.passed, false);
    assert.equal(blocked.res.statusCode, 429);
    assert.equal(blocked.res.body.success, false);
    assert.ok(Number(blocked.res.headers["Retry-After"]) >= 1);
});

test("counts each client separately", () => {
    const limiter = createRateLimiter({ windowMs: 60000, max: 1 });

    assert.equal(hit(limiter, { ip: "a" }).passed, true);
    assert.equal(hit(limiter, { ip: "b" }).passed, true);
    assert.equal(hit(limiter, { ip: "a" }).passed, false);
});

test("a custom key can count per user", () => {
    const limiter = createRateLimiter({
        windowMs: 60000,
        max: 1,
        key: (req) => req.user._id,
    });

    assert.equal(hit(limiter, { ip: "x", user: { _id: "u1" } }).passed, true);
    assert.equal(hit(limiter, { ip: "x", user: { _id: "u2" } }).passed, true);
    assert.equal(hit(limiter, { ip: "y", user: { _id: "u1" } }).passed, false);
});

test("the window resets", async () => {
    const limiter = createRateLimiter({ windowMs: 30, max: 1 });
    const req = { ip: "z" };

    assert.equal(hit(limiter, req).passed, true);
    assert.equal(hit(limiter, req).passed, false);

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.equal(hit(limiter, req).passed, true);
});

test("RATE_LIMIT_DISABLED switches it off", () => {
    const limiter = createRateLimiter({ windowMs: 60000, max: 1 });
    const req = { ip: "off" };

    process.env.RATE_LIMIT_DISABLED = "true";

    try {
        for (let i = 0; i < 5; i += 1) {
            assert.equal(hit(limiter, req).passed, true);
        }
    } finally {
        delete process.env.RATE_LIMIT_DISABLED;
    }
});

test("login attempts are counted per address and email", () => {
    const { loginLimiter } = require("../src/middleware/rateLimiter");

    const attempt = (email) => hit(loginLimiter, { ip: "9.9.9.9", body: { email } });

    for (let i = 0; i < 10; i += 1) {
        assert.equal(attempt("Victim@x.com").passed, true);
    }

    assert.equal(attempt("victim@x.com").passed, false);
    assert.equal(attempt("someone-else@x.com").passed, true);
});
