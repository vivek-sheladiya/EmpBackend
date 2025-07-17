const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {UserModel} = require("../Models/UserModel");

const userDataQuery = 'fullName emailAddress mobileNumber profilePhoto gender employeeCode role approvalStatus isActive';

const UserRole = {
    Admin: "Admin",
    Employee: "Employee",
};

const UserActiveStatus = {
    available: "available",
    away: "away",
    notAvailable: "notAvailable",
};

const ApprovalStatus = {
    Approved: "Approved",
    Pending: "Pending",
    Rejected: "Rejected",
};

const leaveLabelKeys = {
    fullDay: "fullDay",
    halfDay: "halfDay",
    manualHours: "manualHours",
    firstHalf: "firstHalf",
    secondHalf: "secondHalf",
    singleDay: "singleDay",
    multipleDay: "multipleDay",
    paid: "paid",
    unpaid: "unpaid",
    pending: "pending",
    approved: "approved",
    rejected: "rejected"
};

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
    return UserModel.findOne({emailAddress});
};

const findMobileNumber = async (mobileNumber) => {
    return UserModel.findOne({mobileNumber});
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

const toCamelCase = (str) => {
    if (!str) return '';

    return str
        .toLowerCase()
        .split(' ')
        .filter(word => word.trim() !== '') // remove extra spaces
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

module.exports = {
    userDataQuery,
    UserRole,
    UserActiveStatus,
    ApprovalStatus,
    detectPlatform,
    handleError,
    hashPassword,
    findEmailAddress,
    findMobileNumber,
    generateOtp,
    generateRandomId,
    toCamelCase,
    leaveLabelKeys,
};
