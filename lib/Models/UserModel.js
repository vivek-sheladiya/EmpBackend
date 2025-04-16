const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const UserSchema = new Schema(
    {
        employeeCode: {
            type: String,
            default: "",
            description: "Employee Code 123",
        },
        fullName: {
            type: String,
            required: true,
            default: "",
        },
        dateOfBirth: {
            type: Date,
            default: null,
        },
        mobileNumber: {
            type: String,
            required: true,
            default: "",
        },
        emergencyContactNo: {
            type: String,
            default: "",
        },
        emailAddress: {
            type: String,
            required: true,
            default: "",
        },
        role: {
            type: String,
            default: "Employee",
        },
        gender: {
            type: String,
            default: "",
        },
        bloodGroup: {
            type: String,
            default: "",
        },
        skills: {
            type: String,
            default: "",
        },
        address: {
            type: String,
            default: "",
        },
        pincode: {
            type: String,
            default: "",
        },
        technology: {
            type: Array,
            default: [],
        },
        profilePhoto: {
            type: String,
            default: "",
        },
        password: {
            type: String,
            required: true,
            default: "",
        },
        aadharCardNo: {
            type: String,
            default: "",
        },
        panCardNo: {
            type: String,
            default: "",
        },
        bankAccountNumber: {
            type: String,
            default: "",
        },
        ifscCode: {
            type: String,
            default: "",
        },
        approvalStatus: {
            type: String,
            default: "Pending",
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
            default: "",
        },
        otp: {
            type: String,
            default: "",
        },
        deviceId: {
            type: String,
            default: "",
        },
        onesignalPlayerId: {
            type: String,
            default: "",
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

// UserSchema.virtual("attendance", {
//     ref: "attendance",
//     localField: "_id",
//     foreignField: "userId",
// });
//
// UserSchema.set("toObject", {virtuals: true});
// UserSchema.set("toJSON", {virtuals: true});

const UserModel = mongoose.model("employee", UserSchema);

module.exports = {UserModel};
