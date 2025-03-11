const { UserModel } = require("../Models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { sendVerificationEmail, sendOtpEmail } = require("../utils/email");
const {
  handleError,
  setDefaultUserData,
  findEmailAddress,
  findMobileNumber,
  hashPassword,
  generateJwtToken,
  generateOtp,
  detectPlatform,
} = require("../utils/utils");
const {
  validateEmailAddress,
  validatePassword,
} = require("../utils/ValidationUtils");
const { uploadSingleFile } = require("../Database/cloudinaryConfig");
const { bucket } = require("../../firebaseConfig");
const fs = require("fs");

const signup = async (req, res) => {
  try {
    const { emailAddress, fullName, mobileNumber } = req.body;

    const userData = setDefaultUserData(req.body);

    const emailExist = await findEmailAddress(emailAddress);
    if (emailExist) {
      return handleError(res, "Email Address Already Registerd", 400);
    }
    const mobileExist = await findMobileNumber(mobileNumber);
    if (mobileExist) {
      return handleError(res, "Mobile Number Already Registerd", 400);
    }

    const verificationToken = jwt.sign(
      { emailAddress },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
    await UserModel.create({
      ...userData,
      password: await hashPassword(userData.password),
      verificationToken,
    });

    // await sendVerificationEmail(emailAddress, verificationToken);

    return res
      .status(201)
      .json({ success: true, message: "Signup Successfully" });
  } catch (err) {
    console.log(err);
    return handleError(res, err.message);
  }
};

const login = async (req, res) => {
  try {
    const { loginId, password, deviceId, onesignalPlayerId } = req.body;

    let user = await findEmailAddress(loginId);

    if (!user) {
      user = await findMobileNumber(loginId);
      if (!user) {
        return handleError(res, "User Not Found", 400);
      }
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return handleError(res, "Please Enter Correct Password", 400);
    }

    const platform = detectPlatform(req);

    const updatedUser = await UserModel.findByIdAndUpdate(user._id, {
      deviceId: deviceId,
      onesignalPlayerId: onesignalPlayerId,
    });

    const jwtToken = generateJwtToken(updatedUser);

    return res.status(200).json({
      success: true,
      message: "Login Successfully",
      jwtToken: jwtToken,
      data: {
        ...updatedUser.toObject(), // Convert Mongoose document to a plain object
        isElectron: platform?.isElectron || false,
        isMobile: platform?.isMobile || false,
        isDesktopBrowser: platform?.isDesktopBrowser || false,
      },
    });
  } catch (err) {
    console.error(err);
    return handleError(res, err.message);
  }
};

const isElectronApp = async (req, res) => {
  try {
    const platform = detectPlatform(req);

    console.log(platform);

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
  const { token } = req.params;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserModel.findOne({
      emailAddress: decoded.emailAddress,
    });

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "User not found" });
    }

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

    const userData = await UserModel.findOne({ emailAddress: emailAddress });

    const validationResult = validateEmailAddress(emailAddress);
    if (!validationResult.valid) {
      return handleError(res, validationResult.message, 400);
    }

    const emailExist = await findEmailAddress(emailAddress);
    if (!emailExist) {
      return handleError(res, "Email Address Not Found", 400);
    }

    const otp = generateOtp();
    console.log(`Your OTP is: ${otp}`);
    const updateUser = await UserModel.updateOne(
      { _id: userData._id },
      { otp: otp },
      { new: true }
    );
    console.log("updateUser", updateUser);

    await sendOtpEmail(emailAddress, userData.fullName, "XYZ Company", otp);

    return res
      .status(200)
      .json({ success: true, message: "OTP Send Successfully" });
  } catch (err) {
    console.log(err);
    // return handleError(res, err);
    return handleError(res, err.message);
  }
};

const forgetPassVarifyOtp = async (req, res) => {
  try {
    const { emailAddress, otp } = req.body;
    console.log("keyurkeyur===>", emailAddress);

    const userData = await UserModel.findOne({ emailAddress: emailAddress });
    console.log("keyurkeyur===>", userData);
    if (otp === userData.otp) {
      userData.otp = undefined;
      await userData.save();
      return res
        .status(200)
        .json({ success: true, message: "OTP Verified Successfully" });
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Please Enter Valid OTP" });
    }
  } catch (err) {
    console.log(err);
    return handleError(res, err.message);
  }
};

const forgetPassword = async (req, res) => {
  try {
    const { emailAddress, password, confirmPassword } = req.body;

    const userData = await UserModel.findOne({ emailAddress: emailAddress });

    if (password === confirmPassword) {
      const validationResult = validatePassword(password);
      if (!validationResult.valid) {
        return handleError(res, validationResult.message, 400);
      } else {
        await UserModel.updateOne(
          { _id: userData._id },
          { password: await hashPassword(password) }
        );
        return res
          .status(200)
          .json({ success: true, message: "Password Changed Successfully" });
      }
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Password Does Not Matched" });
    }
  } catch (err) {
    console.log(err);
    return handleError(res, err.message);
  }
};

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;
    const { emailAddress, _id } = req.user;

    const userData = await UserModel.findOne({ emailAddress: emailAddress });
    // Make sure user exists
    if (!userData) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Compare plain old password with the hashed password stored in the database
    const isPasswordMatch = await bcrypt.compare(
      oldPassword,
      userData.password
    );

    if (!isPasswordMatch) {
      return res.status(400).json({
        success: false,
        message: "Old password is incorrect, please try again.",
      });
    }

    if (newPassword === confirmPassword) {
      const validationResult = validatePassword(newPassword);
      if (!validationResult.valid) {
        return handleError(res, validationResult.message, 400);
      } else {
        // Update password after hashing it
        await UserModel.updateOne(
          { _id },
          { password: await hashPassword(newPassword) }
        );
        return res
          .status(200)
          .json({ success: true, message: "Password Changed Successfully" });
      }
    } else {
      return res.status(400).json({
        success: false,
        message: "New password and confirmation password do not match",
      });
    }
  } catch (err) {
    console.log(err);
    return handleError(res, err.message);
  }
};

const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;

    const user = await UserModel.findById(userId);
    if (!user) {
      return handleError(res, "User not found", 404);
    }

    if (
      updateData.emailAddress &&
      updateData.emailAddress !== user.emailAddress
    ) {
      const emailExist = await findEmailAddress(updateData.emailAddress);
      if (emailExist) {
        return handleError(res, "Email Address Already Registered", 400);
      }
    }

    if (
      updateData.mobileNumber &&
      updateData.mobileNumber !== user.mobileNumber
    ) {
      const mobileExist = await findMobileNumber(updateData.mobileNumber);
      if (mobileExist) {
        return handleError(res, "Mobile Number Already Registered", 400);
      }
    }

    const updatedUser = await UserModel.findByIdAndUpdate(userId, {
      ...updateData,
      password: await hashPassword(updateData.password),
    });

    // const updatedUser = await UserModel.findByIdAndUpdate(userId, updateData);

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.log(err);
    return handleError(res, err.message);
  }
};

const updateRecord = async (req, res) => {
  try {
    const { userId } = req.params;
    const updateData = req.body;

    const user = await UserModel.findById(userId);
    if (!user) {
      return handleError(res, "User not found", 404);
    }

    const updateFields = {};

    for (const key in updateData) {
      if (Object.prototype.hasOwnProperty.call(updateData, key)) {
        const newValue = updateData[key];
        const existingValue = user[key];

        if (newValue !== undefined && newValue !== existingValue) {
          if (key === "emailAddress") {
            const emailExist = await findEmailAddress(newValue);
            if (emailExist) {
              return handleError(res, "Email Address Already Registered", 400);
            }
          }

          if (key === "mobileNumber") {
            const mobileExist = await findMobileNumber(newValue);
            if (mobileExist) {
              return handleError(res, "Mobile Number Already Registered", 400);
            }
          }

          if (key === "password") {
            updateFields[key] = await hashPassword(newValue);
          } else {
            updateFields[key] = newValue;
          }

          if (key === "userPermission") {
            updateFields[key] = JSON.parse(newValue);
          }

          if (key === "technology") {
            updateFields[key] = JSON.parse(newValue);
          }
        }
      }
    }

    if (req.file) {
      const localFilePath = req.file.path;
      const file = bucket.file(
        `profilePhoto/${Date.now()}_${req.file.originalname}`
      );
      const stream = fs.createReadStream(localFilePath).pipe(
        file.createWriteStream({
          metadata: {
            contentType: req.file.mimetype,
          },
        })
      );

      stream.on("finish", async () => {
        await file.makePublic();
      });

      const fileUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;

      updateFields.profilePhoto = fileUrl;
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(200).json({
        success: true,
        message: "No fields to update",
        user,
      });
    }

    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      updateFields,
      {
        new: true,
      }
    );

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (err) {
    console.log(err);
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
  forgetPassVarifyOtp,
  forgetPassword,
  verifyEmail,
  changePassword,
  updateUser,
  updateRecord,
  userProfile,
};
