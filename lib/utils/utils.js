const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const moment = require("moment");
const { UserModel } = require("../Models/User");
const PerMapKeys = require("./PerMapKeys");

const detectPlatform = (req) => {
  const userAgent = req.get("User-Agent");

  let platform = {
    isElectron: false,
    isMobile: false,
    isDesktopBrowser: false,
    os: "Unknown",
  };

  // Detect Electron app
  if (userAgent.includes("Electron")) {
    platform.isElectron = true;
    platform.os = "Electron (Desktop)";
  }
  // Detect mobile device
  else if (/iPhone|iPad|iPod|Android/i.test(userAgent)) {
    platform.isMobile = true;
    platform.os = "Mobile";
  }
  // Detect desktop browser (Windows, macOS, Linux)
  else {
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
  return res.status(status).json({ success: false, message: message });
};

const hashPassword = async (password) => {
  return await bcrypt.hash(password, 10);
};

const findEmailAddress = async (emailAddress) => {
  return await UserModel.findOne({ emailAddress });
};

const findMobileNumber = async (mobileNumber) => {
  return await UserModel.findOne({ mobileNumber });
};

const generateJwtToken = (user) => {
  return jwt.sign(
    { emailAddress: user.emailAddress, _id: user._id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE_TIME }
  );
};

const setDefaultUserData = (data) => {
  const userPermissionData = {
    [PerMapKeys.user]: {
      [PerMapKeys.read]: false,
      [PerMapKeys.add]: false,
      [PerMapKeys.update]: false,
      [PerMapKeys.delete]: false,
      [PerMapKeys.canAssignPermission]: false,
    },
    [PerMapKeys.complaint]: {
      [PerMapKeys.read]: {
        [PerMapKeys.active]: {
          [PerMapKeys.all]: false,
          [PerMapKeys.mentioned]: true,
          [PerMapKeys.hide]: false,
        },
        [PerMapKeys.pending]: {
          [PerMapKeys.all]: false,
          [PerMapKeys.mentioned]: true,
          [PerMapKeys.hide]: false,
        },
        [PerMapKeys.rejected]: {
          [PerMapKeys.all]: false,
          [PerMapKeys.mentioned]: true,
          [PerMapKeys.hide]: false,
        },
        [PerMapKeys.closed]: {
          [PerMapKeys.all]: false,
          [PerMapKeys.mentioned]: true,
          [PerMapKeys.hide]: false,
        },
        [PerMapKeys.onRoot]: {
          [PerMapKeys.all]: false,
          [PerMapKeys.mentioned]: true,
          [PerMapKeys.hide]: false,
        },
      },
      [PerMapKeys.add]: true,
      [PerMapKeys.update]: true,
      [PerMapKeys.delete]: false,
      [PerMapKeys.complaintAssign]: false,
      [PerMapKeys.complaintClose]: false,
    },
  };
  return {
    ...data,
    // employeeCode: data.employeeCode || '',
    // fullName: data.fullName || '',
    // dateOfBirth: data.dateOfBirth || '',
    // mobileNumber: data.mobileNumber || '',
    // emergencyContactNo: data.emergencyContactNo || '',
    // emailAddress: data.emailAddress || '',
    // role: data.role || 'Employee',
    // gender: data.gender || '',
    // bloodGroup: data.bloodGroup || '',
    // skills: data.skills || '',
    // address: data.address || '',
    // pincode: data.pincode || '',
    // technology: data.technology || [],
    // profilePhoto: data.profilePhoto || '',
    // password: data.password || '',
    // passwordOriginal: data.password || '',
    // aadharCardNo: data.aadharCardNo || '',
    // panCardNo: data.panCardNo || '',
    // bankAccountNumber: data.bankAccountNumber || '',
    // ifscCode: data.ifscCode || '',
    // approvalStatus: data.approvalStatus || 'Pending',
    // isActive: data.isActive || false,
    // dateOfJoining: data.dateOfJoining || '',
    // dateofLeaving: data.dateofLeaving || '',
    // createdAt: moment().format('DD-MM-YYYY HH:mm A'),
    // isEmailVerified: data.isEmailVerified || false,
    // isMobileVerified: data.isMobileVerified || false,
    // verificationToken: data.verificationToken || '',
    // otp: data.otp || '',
    // deviceId: data.deviceId || '',
    // onesignalPlayerId: data.onesignalPlayerId || '',
    // deleted: data.deleted || false,
    permission: data.permission || userPermissionData,
  };
};

const setDefaultRequestData = (data) => {
  return {
    name: data.name || "",
    mobile: data.mobile || "",
    mobile2: data.mobile2 || "",
    address: data.address || "",
    district: data.district || "",
    subDistrict: data.subDistrict || "",
    village: data.village || "",
    pinCode: data.pinCode || "",
    productImages: data.productImages || [],
    warrantyCardImages: data.warrantyCardImages || [],
    priority: data.priority || "",
    activeStatus: data.activeStatus || "",
    approvalStatus: data.approvalStatus || "",
    reason: data.reason || "",
    complaintCreatedDate: moment().format("DD-MM-YYYY HH:mm A"),
    complaintCloseDate: data.complaintCloseDate || "",
    status: data.status || "",
    latitude: data.latitude || "",
    longitude: data.longitude || "",
    assignedPersonName: data.assignedPersonName || "",
    assignedPersonUserId: data.assignedPersonUserId || "",
    complaintAddPersonName: data.complaintAddPersonName || "",
    complaintAddPersonUserId: data.complaintAddPersonUserId || "",
    approvedPersonName: data.approvedPersonName || "",
    approvedPersonUserId: data.approvedPersonUserId || "",
    isOtpSend: data.isOtpSend || false,
    otp: data.otp || "",
    complaintId: data.complaintId || "",
    productName: data.productName || "",
    productDescription: data.productDescription || "",
    dueDate: data.dueDate || "",
    usedSpareParts: data.usedSpareParts || "",
    receivedAmount: data.receivedAmount || "",
  };
};

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

module.exports = {
  detectPlatform,
  handleError,
  hashPassword,
  findEmailAddress,
  findMobileNumber,
  generateJwtToken,
  setDefaultUserData,
  setDefaultRequestData,
  generateOtp,
};
