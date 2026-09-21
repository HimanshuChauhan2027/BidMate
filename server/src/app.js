const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/authRoutes");
const auctionRoutes = require("./routes/auctionRoutes");

const bidRoutes = require("./routes/bidRoutes");
const { originCheck } = require("./config/cors");
const { apiLimiter } = require("./middleware/rateLimiter");


const app = express();

// Behind Render's proxy, req.ip must come from X-Forwarded-For for the
// rate limiter to see real client addresses.
app.set("trust proxy", Number(process.env.TRUST_PROXY ?? 1));
app.disable("x-powered-by");

app.use((req, res, next) => {
    res.set({
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "no-referrer",
        "Cross-Origin-Opener-Policy": "same-origin",
    });

    next();
});

// Middlewares
app.use(
    cors({
        origin: originCheck,
        credentials: true,
    })
);
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(cookieParser());

// Health Check Route
app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "BidMate API is running 🚀"
    });
});

app.use("/api", apiLimiter);

app.use("/api/auctions", auctionRoutes);

app.use("/api/auth", authRoutes);

app.use("/api/bids",bidRoutes);

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found.",
    });
});

// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
    const multerMessages = {
        LIMIT_FILE_SIZE: "Each image must be 5 MB or smaller.",
        LIMIT_FILE_COUNT: "You can upload at most 5 images.",
        LIMIT_UNEXPECTED_FILE: "You can upload at most 5 images.",
    };

    if (error.name === "MulterError") {
        return res.status(400).json({
            success: false,
            message: multerMessages[error.code] || error.message,
        });
    }

    const status = error.status || error.statusCode || 500;

    if (status >= 500) {
        console.error(error);
    }

    res.status(status).json({
        success: false,
        message: status >= 500 ? "Something went wrong." : error.message,
    });
});

module.exports = app;