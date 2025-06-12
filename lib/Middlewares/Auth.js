const jwt = require("jsonwebtoken");
const { UserModel } = require("../Models/UserModel");
const {UserRole} = require("../utils/utils");

const generateJwtToken = (user) => {
    return jwt.sign(
        {emailAddress: user.emailAddress, _id: user._id},
        process.env.JWT_SECRET,
        // {expiresIn: process.env.JWT_EXPIRE_TIME}
    );
};

const ensureAuthenticated = async (req, res, next) => {
    try {
        const auth = req.headers["authorization"] || req.headers["Authorization"];

        if (!auth || !auth.startsWith("Bearer ")) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized: JWT token is required.",
            });
        }

        const token = auth.split(" ")[1];

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true });
        } catch (err) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized: Invalid token.",
            });
        }

        const userDetails = await UserModel.findById(decoded._id);

        if (!userDetails) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized: User not found.",
            });
        }

        if (userDetails.role === UserRole.Employee) {
            const nowInSeconds = Math.floor(Date.now() / 1000);

            if (decoded.exp && decoded.exp < nowInSeconds) {
                return res.status(403).json({
                    success: false,
                    message: "Unauthorized: Token expired. Please log in again.",
                });
            }
        }

        req.user = userDetails;
        next();
    } catch (err) {
        console.error("Auth Error:", err.message);
        return res.status(403).json({
            success: false,
            message: "Unauthorized: Error verifying token.",
        });
    }
};

// const ensureAuthenticated = async (req, res, next) => {
//   try {
//     const auth = req.headers["authorization"] || req.headers["Authorization"];
//     const token = auth.split(" ")[1];
//     if (!token) {
//       return res
//         .status(403)
//         .json({
//           success: false,
//           message: "Unauthorized, JWT token is require",
//         });
//     }
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     const userDetials = await UserModel.findById({ _id: decoded._id });
//     req.user = userDetials;
//     next();
//   } catch (err) {
//     return res
//       .status(403)
//       .json({
//         success: false,
//         message: "Unauthorized, JWT token is wrong or expired",
//       });
//   }
// };

module.exports = {generateJwtToken, ensureAuthenticated};
