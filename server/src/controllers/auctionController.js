const auctionService = require("../services/auctionService");

const createAuction = async (req, res) => {
    try {
        const {
            title,description,category,startingPrice,minIncrement,startTime, endTime,
        } = req.body;

        const auction = await auctionService.createAuction(
            {
                title,description,category,startingPrice,minIncrement,startTime,endTime,
            },
            req.user._id,req.files
        );

        res.status(201).json({
            success: true,
            message: "Auction created successfully.",
            auction,
        });
    } catch (error) {
        console.error("Create auction failed:", error.message);

        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

const getAllAuctions = async (req, res) => {
    try {
        const { auctions, total, page, pages } =
            await auctionService.getAllAuctions(req.query);

        res.status(200).json({
            success: true,
            message: "Auctions fetched successfully.",
            count: auctions.length,
            total,
            page,
            pages,
            auctions,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

const getAuctionById = async (req, res) => {
    try {
        const auction = await auctionService.getAuctionById(req.params.id);

        res.status(200).json({
            success: true,
            message: "Auction fetched successfully.",
            serverTime: Date.now(),
            auction,
        });
    } catch (error) {
        res.status(404).json({
            success: false,
            message: error.message,
        });
    }
};
const updateAuction = async (req, res) => {
    try {
        const auction = await auctionService.updateAuction(
            req.params.id,
            req.user._id,
            req.body
        );

        res.status(200).json({
            success: true,
            message: "Auction updated successfully.",
            auction,
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};

const deleteAuction = async (req, res) => {
    try {
        await auctionService.deleteAuction(
            req.params.id,
            req.user._id
        );

        res.status(200).json({
            success: true,
            message: "Auction deleted successfully.",
        });

    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message,
        });
    }
};
const getMyAuctions = async (req, res) => {
    try {
        const auctions = await auctionService.getMyAuctions(req.user._id);

        res.status(200).json({
            success: true,
            auctions,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};
const getWonAuctions = async (req, res) => {
    try {
        const auctions = await auctionService.getWonAuctions(req.user._id);

        res.status(200).json({
            success: true,
            auctions,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};


module.exports = {
    createAuction,getAllAuctions,getAuctionById,updateAuction,deleteAuction,getMyAuctions,getWonAuctions,
};