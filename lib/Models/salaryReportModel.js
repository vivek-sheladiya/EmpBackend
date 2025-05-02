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
            type: String
        },
        isPublished: {
            type: Boolean,
            default: false
        },
        userName: {
            type: String
        },
        basicSalary: {
            type: String,
            set: encrypt,
            get: decrypt
        },
        leaveHours: {
            type: String,
        },
        deduct: {
            type: String,
        },
        bonus: {
            type: String,
        },
        deductionAmount: {
            type: String,
            set: encrypt,
            get: decrypt
        },
        bonusAmount: {
            type: String,
            default: null
        },
        netSalary: {
            type: String,
            set: encrypt,
            get: decrypt
        }
    },
    { timestamps: true }
);

const salaryReportModel = mongoose.model("salaryReports", salaryReportSchema);

module.exports = { salaryReportModel };