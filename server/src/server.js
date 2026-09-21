require("dotenv").config();

const http = require("http");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { Server } = require("socket.io");

const app = require("./app");
const connectDB = require("./config/db");
const { originCheck } = require("./config/cors");
const startAuctionStatusJob = require("./jobs/auctionStatus.job");
const {
    startAuctionWorker,
    stopAuctionQueue,
    reconcileAuctionJobs,
} = require("./queues/auctionQueue");

const { initializeSocket } = require("./socket");

const MAX_AUCTION_ROOMS_PER_SOCKET = 20;

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: originCheck,
        methods: ["GET", "POST"],
        credentials: true,
    },
});

initializeSocket(io);

// Viewers can be anonymous. A valid token just attaches an identity;
// a missing or expired token never blocks the connection.
io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (typeof token === "string" && token) {
        try {
            socket.userId = jwt.verify(token, process.env.JWT_SECRET).id;
        } catch (error) {
            socket.userId = null;
        }
    }

    next();
});

io.on("connection", (socket) => {
    if (socket.userId) {
        socket.join(`user:${socket.userId}`);
    }

    socket.on("join-auction", (auctionId) => {
        if (
            typeof auctionId !== "string" ||
            !mongoose.Types.ObjectId.isValid(auctionId)
        ) {
            return;
        }

        const joined = [...socket.rooms].filter(
            (room) => room !== socket.id && !room.startsWith("user:")
        );

        if (joined.length >= MAX_AUCTION_ROOMS_PER_SOCKET) return;

        socket.join(auctionId);
    });

    socket.on("leave-auction", (auctionId) => {
        if (typeof auctionId === "string") socket.leave(auctionId);
    });
});

const PORT = process.env.PORT || 5000;

startAuctionWorker();

connectDB().then(() => reconcileAuctionJobs());

startAuctionStatusJob();

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down.`);

    setTimeout(() => process.exit(1), 10000).unref();

    io.close();
    server.close();

    await stopAuctionQueue();
    await mongoose.disconnect();

    process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
    console.error("Unhandled rejection:", reason);
});
