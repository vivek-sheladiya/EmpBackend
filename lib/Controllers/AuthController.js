const { UserModel } = require("../Models/UserModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { sendOtpEmail } = require("../utils/email");
const {
    handleError,
    findEmailAddress,
    findMobileNumber,
    hashPassword,
    generateJwtToken,
    generateOtp,
    detectPlatform, toCamelCase,
} = require("../utils/utils");
const {
    validateEmailAddress,
    validatePassword,
} = require("../utils/ValidationUtils");
const { Blob } = require("buffer");
const environment = require("../../apiEndpoints");

const generateEmployeeCode = () => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";
    let result = "";
    for (let i = 0; i < 7; i++) {
        if (i % 2 === 0) { result += letters.charAt(Math.floor(Math.random() * letters.length)); }
        else { result += numbers.charAt(Math.floor(Math.random() * numbers.length)); }
    }
    const newStrings = Array.from({ length: 1 }, () => result);
    return newStrings[0];
};

const signup = async (req, res) => {
    try {
        const { fullName, emailAddress, mobileNumber, password } = req.body;
        if (await findEmailAddress(emailAddress)) {
            return handleError(res, "Email Address Already Registered", 400);
        }

        if (await findMobileNumber(mobileNumber)) {
            return handleError(res, "Mobile Number Already Registered", 400);
        }

        const verificationToken = jwt.sign({ emailAddress }, process.env.JWT_SECRET, { expiresIn: "1d" });
        const hashedPassword = await hashPassword(password);

        const user = await UserModel.create({ ...req.body, fullName: toCamelCase(fullName), password: hashedPassword, verificationToken, employeeCode: generateEmployeeCode() });

        return res.status(201).json({ success: true, message: "Signup Successful" });
    } catch (err) {
        console.error(err);
        return handleError(res, err.message);
    }
};

const login = async (req, res) => {
    try {
        const { loginId, password } = req.body;
        let user = await findEmailAddress(loginId) || await findMobileNumber(loginId);
        if (!user) return handleError(res, "User Not Found", 400);
        if (!user.isActive) return handleError(res, "user is not active.", 400);
        if (user.approvalStatus !== 'Approved') return handleError(res, "user is not approved.", 400);
        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) return handleError(res, "Incorrect Password", 400);

        const jwtToken = generateJwtToken(user);

        return res.status(200).json({
            success: true,
            message: "Login Successful",
            jwtToken,
            data: user.toObject(),
        });
    } catch (err) {
        console.error(err);
        return handleError(res, err.message);
    }
};

const isElectronApp = async (req, res) => {
    try {
        const platform = detectPlatform(req);

        return res.status(200).json({
            success: platform?.isElectron || false,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
        });
    }
};

const verifyEmail = async (req, res) => {
    try {
        const { token } = req.params;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await UserModel.findOne({ emailAddress: decoded.emailAddress });
        if (!user) return res.status(400).json({ success: false, message: "User not found" });

        user.isEmailVerified = true;
        user.verificationToken = undefined;
        await user.save();

        res.redirect("/verification-success.html");
    } catch (error) {
        console.error(error);
        return res.status(400).json({ message: "Invalid or expired token" });
    }
};

const forgetPassSendOtp = async (req, res) => {
    try {
        const { emailAddress } = req.body;

        const validationResult = validateEmailAddress(emailAddress);
        if (!validationResult.valid) return handleError(res, validationResult.message, 400);

        const user = await UserModel.findOne({ emailAddress });
        if (!user) return handleError(res, "Email Address Not Found", 400);

        const otp = generateOtp();
        console.log(`Your OTP is: ${otp}`);

        user.otp = otp;
        await user.save();
        await sendOtpEmail(emailAddress, user.fullName, "XYZ Company", otp);

        return res.status(200).json({ success: true, message: "OTP Sent Successfully" });
    } catch (err) {
        console.error(err);
        return handleError(res, err.message);
    }
};

const forgetPassVerifyOtp = async (req, res) => {
    try {
        const { emailAddress, otp } = req.body;

        const user = await UserModel.findOne({ emailAddress });
        if (!user || otp !== user.otp) {
            return res.status(400).json({ success: false, message: "Invalid OTP" });
        }

        user.otp = undefined; // Clear OTP
        await user.save();

        return res.status(200).json({ success: true, message: "OTP Verified Successfully" });
    } catch (err) {
        console.error(err);
        return handleError(res, err.message);
    }
};

const forgetPassword = async (req, res) => {
    try {
        const { emailAddress, password, confirmPassword } = req.body;
        const user = await UserModel.findOne({ emailAddress });

        if (!user) return handleError(res, "User not found", 404);

        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: "Passwords do not match" });
        }

        const validationResult = validatePassword(password);
        if (!validationResult.valid) return handleError(res, validationResult.message, 400);

        user.password = await hashPassword(password);
        await user.save();

        return res.status(200).json({ success: true, message: "Password Changed Successfully" });
    } catch (err) {
        console.error(err);
        return handleError(res, err.message);
    }
};

const changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword, confirmPassword } = req.body;
        const { emailAddress } = req.user;

        const user = await UserModel.findOne({ emailAddress });
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const isPasswordMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isPasswordMatch) return res.status(400).json({ success: false, message: "Incorrect old password" });

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: "New password and confirmation do not match" });
        }

        const validationResult = validatePassword(newPassword);
        if (!validationResult.valid) return handleError(res, validationResult.message, 400);

        user.password = await hashPassword(newPassword);
        await user.save();

        return res.status(200).json({ success: true, message: "Password Changed Successfully" });
    } catch (err) {
        console.error(err);
        return handleError(res, err.message);
    }
};

const userProfile = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await UserModel.findById(userId);
        if (!user) {
            return handleError(res, "User not found", 404);
        }

        return res.status(200).json({
            success: true,
            message: "Profile fetched successfully",
            data: user,
        });
    } catch (err) {
        console.log(err);
        return handleError(res, err.message);
    }
};

module.exports = {
    signup,
    login,
    isElectronApp,
    forgetPassSendOtp,
    forgetPassVerifyOtp,
    forgetPassword,
    verifyEmail,
    changePassword,
    userProfile,
};
