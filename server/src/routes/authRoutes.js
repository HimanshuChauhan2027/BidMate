const express = require("express");
const router = express.Router();

const {register,login,} = require("../controllers/authController");

const authMiddleware = require("../middleware/authMiddleware");
const { loginLimiter, registerLimiter } = require("../middleware/rateLimiter");

// Public Routes
router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);

// Protected Route
router.get("/profile", authMiddleware, (req, res) => {
    res.status(200).json({
        success: true,
        user: req.user,
    });
});

module.exports = router;