const jwt = require("jsonwebtoken");
const { UserModel } = require("../Models/User");

const ensureAuthenticated = async (req, res, next) => {
  try {
    const auth = req.headers["authorization"] || req.headers["Authorization"];
    const token = auth.split(" ")[1];
    if (!token) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Unauthorized, JWT token is require",
        });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userDetials = await UserModel.findById({ _id: decoded._id });
    req.user = userDetials;
    next();
  } catch (err) {
    return res
      .status(403)
      .json({
        success: false,
        message: "Unauthorized, JWT token is wrong or expired",
      });
  }
};

module.exports = ensureAuthenticated;
