const { Queue, Worker } = require("bullmq");
const IORedis = require("ioredis");

const Auction = require("../models/Auction");
const { AUCTION_STATUS } = require("../constants/auctionConstants");
const { startAuction, closeAuction } = require("../services/auctionLifecycle");

const QUEUE_NAME = "auction-lifecycle";

const queueEnabled = Boolean(process.env.REDIS_URL);

let queue = null;
let worker = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createConnection = () => {
    const connection = new IORedis(process.env.REDIS_URL, {
        maxRetriesPerRequest: null,
    });

    connection.on("error", (error) => {
        console.error("Redis error:", error.message);
    });

    return connection;
};

const getQueue = () => {
    if (!queueEnabled) return null;

    if (!queue) {
        queue = new Queue(QUEUE_NAME, { connection: createConnection() });
        queue.on("error", (error) => {
            console.error("Auction queue error:", error.message);
        });
    }

    return queue;
};

// The job id contains the target timestamp, so every distinct start/end time
// gets its own job. Re-scheduling the same time is a no-op (duplicate id),
// and an old job for a superseded end time just fires, finds nothing to do,
// and exits.
const scheduleJob = async (name, auctionId, when) => {
    const q = getQueue();

    if (!q) return;

    const target = new Date(when).getTime();

    await q.add(
        name,
        { auctionId: String(auctionId) },
        {
            jobId: `${name}-${auctionId}-${target}`,
            delay: Math.max(0, target - Date.now()),
            attempts: 3,
            backoff: { type: "exponential", delay: 2000 },
            removeOnComplete: true,
            removeOnFail: 100,
        }
    );
};

const scheduleAuctionJobs = async (auction) => {
    if (!queueEnabled) return;

    if (auction.status === AUCTION_STATUS.UPCOMING) {
        await scheduleJob("start", auction._id, auction.startTime);
    }

    if (auction.status !== AUCTION_STATUS.ENDED) {
        await scheduleJob("end", auction._id, auction.endTime);
    }
};

const rescheduleEnd = async (auctionId, endTime) => {
    await scheduleJob("end", auctionId, endTime);
};

const handleEnd = async (auctionId) => {
    const ended = await closeAuction(auctionId);

    if (ended) return;

    const auction = await Auction.findById(auctionId).select("status endTime");

    if (!auction || auction.status === AUCTION_STATUS.ENDED) return;

    const remaining = auction.endTime.getTime() - Date.now();

    if (remaining <= 0) return;

    // Small clock difference between Redis and this server: wait it out.
    if (remaining <= 5000) {
        await sleep(remaining + 25);
        await closeAuction(auctionId);
        return;
    }

    // End time was extended (anti-sniping) after this job was created.
    await scheduleJob("end", auctionId, auction.endTime);
};

const startAuctionWorker = () => {
    if (!queueEnabled) {
        console.warn(
            "REDIS_URL not set: auctions will be closed by the cron sweeper only (up to 60s late)."
        );
        return;
    }

    if (worker) return;

    worker = new Worker(
        QUEUE_NAME,
        async (job) => {
            const { auctionId } = job.data;

            if (job.name === "start") {
                await startAuction(auctionId);
            } else if (job.name === "end") {
                await handleEnd(auctionId);
            }
        },
        { connection: createConnection(), concurrency: 5 }
    );

    worker.on("failed", (job, error) => {
        console.error(`Auction job ${job?.id} failed:`, error.message);
    });

    worker.on("error", (error) => {
        console.error("Auction worker error:", error.message);
    });
};

const stopAuctionQueue = async () => {
    try {
        if (worker) await worker.close();
        if (queue) await queue.close();
    } catch (error) {
        console.error("Auction queue shutdown failed:", error.message);
    }
};

// Rebuild jobs for every open auction (safe to run on every boot: duplicate
// ids are ignored). Covers a wiped Redis and auctions created before this
// queue existed.
const reconcileAuctionJobs = async () => {
    if (!queueEnabled) return;

    try {
        const cursor = Auction.find({
            status: { $in: [AUCTION_STATUS.UPCOMING, AUCTION_STATUS.ACTIVE] },
        })
            .select("status startTime endTime")
            .cursor();

        let count = 0;

        for await (const auction of cursor) {
            await scheduleAuctionJobs(auction);
            count += 1;
        }

        console.log(`Auction jobs reconciled for ${count} open auctions.`);
    } catch (error) {
        console.error("Auction job reconcile failed:", error.message);
    }
};

module.exports = {
    scheduleAuctionJobs,
    rescheduleEnd,
    startAuctionWorker,
    stopAuctionQueue,
    reconcileAuctionJobs,
};
