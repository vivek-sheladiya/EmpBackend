const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {UserModel} = require("../Models/UserModel");

const detectPlatform = (req) => {
    const userAgent = req.get("User-Agent");

    let platform = {
        isElectron: false,
        isMobile: false,
        isDesktopBrowser: false,
        os: "Unknown",
    };

    if (userAgent.includes("Electron")) {
        platform.isElectron = true;
        platform.os = "Electron (Desktop)";
    } else if (/iPhone|iPad|iPod|Android/i.test(userAgent)) {
        platform.isMobile = true;
        platform.os = "Mobile";
    } else {
        platform.isDesktopBrowser = true;
        if (userAgent.includes("Windows")) {
            platform.os = "Windows";
        } else if (userAgent.includes("Mac")) {
            platform.os = "macOS";
        } else if (userAgent.includes("Linux")) {
            platform.os = "Linux";
        } else {
            platform.os = "Unknown OS";
        }
    }
    return platform;
};

const handleError = (res, message, status = 500) => {
    return res.status(status).json({success: false, message: message});
};

const hashPassword = async (password) => {
    return await bcrypt.hash(password, 10);
};

const findEmailAddress = async (emailAddress) => {
    return await UserModel.findOne({emailAddress});
};

const findMobileNumber = async (mobileNumber) => {
    return await UserModel.findOne({mobileNumber});
};

const generateJwtToken = (user) => {
    return jwt.sign(
        {emailAddress: user.emailAddress, _id: user._id},
        process.env.JWT_SECRET,
        {expiresIn: process.env.JWT_EXPIRE_TIME}
    );
};

const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const generateRandomId = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomId = '';
    for (let i = 0; i < 8; i++) {
        randomId += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return randomId;
};

module.exports = {
    detectPlatform,
    handleError,
    hashPassword,
    findEmailAddress,
    findMobileNumber,
    generateJwtToken,
    generateOtp,
    generateRandomId,
};
