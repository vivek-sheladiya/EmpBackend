const mongoose = require("mongoose");
const Schema = mongoose.Schema;

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

const UserSchema = new Schema(
    {
        employeeCode: {
            type: String,
            default: generateEmployeeCode(),
        },
        fullName: {
            type: String,
            required: true,
            default: null,
        },
        fatherFullName: {
            type: String,
            default: null,
        },
        googleEmailId: {
            type: String,
            default: null,
        },
        googlePassword: {
            type: String,
            default: null,
        },
        skypeId: {
            type: String,
            default: null,
        },
        skypePassword: {
            type: String,
            default: null,
        },
        dateOfBirth: {
            type: Date,
            default: null,
        },
        mobileNumber: {
            type: String,
            required: true,
            default: null,
        },
        emergencyContactNo: {
            type: String,
            default: null,
        },
        emailAddress: {
            type: String,
            required: true,
            default: null,
        },
        role: {
            type: String,
            default: 'Employee',
        },
        gender: {
            type: String,
            default: null,
        },
        bloodGroup: {
            type: String,
            default: null,
        },
        skills: {
            type: String,
            default: null,
        },
        address: {
            type: String,
            default: null,
        },
        pincode: {
            type: String,
            default: null,
        },
        technology: {
            type: Array,
            default: [],
        },
        profilePhoto: {
            type: String,
            default: null,
        },
        password: {
            type: String,
            required: true,
            default: null,
        },
        aadharCardNo: {
            type: String,
            default: null,
        },
        panCardNo: {
            type: String,
            default: null,
        },
        bankAccountNumber: {
            type: String,
            default: null,
        },
        ifscCode: {
            type: String,
            default: null,
        },
        approvalStatus: {
            type: String,
            default: 'Pending',
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        dateOfJoining: {
            type: Date,
            default: null,
        },
        dateofLeaving: {
            type: Date,
            default: null,
        },
        isEmailVerified: {
            type: Boolean,
            default: false,
        },
        isMobileVerified: {
            type: Boolean,
            default: false,
        },
        verificationToken: {
            type: String,
            default: null,
        },
        otp: {
            type: String,
            default: null,
        },
        deviceId: {
            type: String,
            default: null,
        },
        onesignalPlayerId: {
            type: String,
            default: null,
        },
        deleted: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

const UserModel = mongoose.model("employee", UserSchema);

module.exports = { UserModel };
