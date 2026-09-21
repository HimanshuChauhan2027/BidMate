const express = require("express");
const router = express.Router();

const auctionController = require("../controllers/auctionController");
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/uploadMiddleware");
const { createAuctionLimiter } = require("../middleware/rateLimiter");

router.post(
    "/",
    authMiddleware,
    createAuctionLimiter,
    upload.array("images", 5),
    auctionController.createAuction
);
router.get("/", auctionController.getAllAuctions);

router.put("/:id", authMiddleware, auctionController.updateAuction);
router.delete("/:id", authMiddleware, auctionController.deleteAuction);
router.get(
    "/my-auctions",
    authMiddleware,
    auctionController.getMyAuctions
);
router.get("/won",authMiddleware,auctionController.getWonAuctions);
router.get("/:id", auctionController.getAuctionById);

module.exports = router;