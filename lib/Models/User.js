const mongoose = require("mongoose");
const moment = require("moment");
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
    passwordOriginal: {
      type: String,
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
      type: String,
      default: "",
    },
    dateofLeaving: {
      type: String,
      default: "",
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
    permission: {
      type: Map,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

const AttendanceSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "employee",
      required: true,
    },
    punchTime: [
      {
        punchInTime: { type: Number, default: null },
        punchOutTime: { type: Number, default: null },
      },
    ],
    breakTime: [
      {
        breakInTime: { type: Number, default: null },
        breakOutTime: { type: Number, default: null },
      },
    ],
    lastPunchInTime: { type: Number, default: null },
    lastBreakInTime: { type: Number, default: null },
    isPunchIn: { type: Boolean, default: false },
    isBreakIn: { type: Boolean, default: false },
    workingHours: { type: Number, default: null },
    breakHours: { type: Number, default: null },
    overtime: { type: Number, default: null },
    totalHours: { type: Number, default: null },
    lateArrival: { type: Number, default: "" },
    punchInAt: { type: Number, default: null },
    screenshots: [
      {
        image: { type: String, default: "" },
        capturedTime: { type: Number, default: null },
      },
    ],
    keyPressCount: { type: Number, default: null },
    mouseEventCount: { type: Number, default: null },
    tasks: [
      {
        userId: { type: String, default: "" },
        title: { type: String, default: "" },
        description: { type: String, default: "" },
        status: { type: String, default: "" },
        startTime: { type: Number, default: null },
        endTime: { type: Number, default: null },
      }
    ],
    isUnderVerification: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["Present", "Absent", "Holiday"],
      default: "Absent",
    },
  },
  { timestamps: true }
);

UserSchema.virtual("attendance", {
  ref: "attendance",
  localField: "_id",
  foreignField: "userId",
});

UserSchema.set("toObject", { virtuals: true });
UserSchema.set("toJSON", { virtuals: true });

const UserModel = mongoose.model("employee", UserSchema);
const AttendanceModel = mongoose.model("attendance", AttendanceSchema);

module.exports = { UserModel, AttendanceModel };
