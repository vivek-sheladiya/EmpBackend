const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const basicSalarySchema = new Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'employee',
        },
        startDate: {
            type: String,
        },
        basicSalary: {
            type: String
        },
        code: {
            type: String
        }
    },
    { timestamps: true }
);

const basicSalaryModel = mongoose.model("basicSalary", basicSalarySchema);

module.exports = { basicSalaryModel };