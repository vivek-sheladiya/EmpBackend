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
        deductionSalary: {
            type: String,
        },
        // bonusSalary: {
        //     type: String,
        // },
        salaryAdjustmentType: {
            type: String,
        },
        deductAndBonus: {
            type: String,
        },
        netSalary: {
            type: String,
        }
    },
    { timestamps: true }
);

const salaryReportModel = mongoose.model("salaryReports", salaryReportSchema);

module.exports = { salaryReportModel };