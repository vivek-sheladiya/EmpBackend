const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const salaryReportSchema = new Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            // ref: 'employee',
        },
        userName: {
            type: String
        },
        basicSalary: {
            type: String
        },
        leaveHours: {
            type: String,
        },
        deductionAmount: {
            type: String,
        },
        bonusAmount: {
            type: String,
            default: null
        },
        netSalary: {
            type: String,
        }
    },
    { timestamps: true }
);

const salaryReportModel = mongoose.model("salaryReports", salaryReportSchema);

module.exports = { salaryReportModel };