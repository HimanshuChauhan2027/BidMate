const express = require("express");
const router = express.Router();

const bidController = require("../controllers/bidController");
const authMiddleware = require("../middleware/authMiddleware");
const { bidLimiter } = require("../middleware/rateLimiter");


router.get("/my-bids",authMiddleware,bidController.getMyBids);

router.get("/:auctionId",bidController.getBidHistory);

router.get("/:auctionId/auto",authMiddleware,bidController.getMyAutoBid);

router.post("/:auctionId/auto",authMiddleware,bidLimiter,bidController.setAutoBid);

router.post("/:auctionId",authMiddleware,bidLimiter,bidController.placeBid);

module.exports = router;