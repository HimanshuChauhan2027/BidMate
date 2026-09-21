const bcrypt = require("bcryptjs");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cleanEmail = (email) =>
    typeof email === "string" ? email.trim().toLowerCase() : "";

const publicUser = (user) => ({
    id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
});

const register = async ({ name, email, password }) => {
    const userName = typeof name === "string" ? name.trim() : "";
    const userEmail = cleanEmail(email);

    if (!userName) {
        throw new Error("Name is required");
    }

    if (!EMAIL_PATTERN.test(userEmail)) {
        throw new Error("Please enter a valid email address");
    }

    if (typeof password !== "string" || password.length < 6) {
        throw new Error("Password must be at least 6 characters");
    }

    const existingUser = await User.findOne({ email: userEmail });

    if (existingUser) {
        throw new Error("User already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let user;

    try {
        user = await User.create({
            name: userName,
            email: userEmail,
            password: hashedPassword,
        });
    } catch (error) {
        if (error.code === 11000) {
            throw new Error("User already exists");
        }
        throw error;
    }

    const token = generateToken(user._id);

    return {
        success: true,
        message: "User registered successfully",
        token,
        user: publicUser(user),
    };
};

const login = async ({ email, password }) => {
    const userEmail = cleanEmail(email);

    if (!userEmail || typeof password !== "string" || !password) {
        throw new Error("Invalid email or password");
    }

    const user = await User.findOne({ email: userEmail });

    if (!user) {
        throw new Error("Invalid email or password");
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
        throw new Error("Invalid email or password");
    }

    const token = generateToken(user._id);

    return {
        success: true,
        message: "Login successful",
        token,
        user: publicUser(user),
    };
};

module.exports = { register, login };
