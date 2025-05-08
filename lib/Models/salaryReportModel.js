const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const { encrypt, decrypt } = require("../../encryptSalary");

const salaryReportSchema = new Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'employee',
        },
        reportType: {
            type: String,
            default: null,
            enum: ['leaveWise', 'punchWise', 'trackWise'],
        },
        date: {
            type: String,
            default: null
        },
        isPublished: {
            type: Boolean,
            default: false
        },
        userName: {
            type: String,
            default: null
        },
        basicSalary: {
            type: String,
            set: encrypt,
            get: decrypt,
            default: null
        },
        leaveHours: {
            type: String,
            default: null
        },
        deduct: {
            type: String,
            default: null
        },
        bonus: {
            type: String,
            default: null
        },
        description: {
            type: String,
            default: null
        },
        deductionAmount: {
            type: String,
            set: encrypt,
            get: decrypt,
            default: null
        },
        netSalary: {
            type: String,
            set: encrypt,
            get: decrypt,
            default: null
        }
    },
    { timestamps: true }
);

const salaryReportModel = mongoose.model("salaryReports", salaryReportSchema);

module.exports = { salaryReportModel };