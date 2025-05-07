const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const { encrypt, decrypt } = require("../../encryptSalary");

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
            type: String,
            set: encrypt,
            get: decrypt
        },
        code: {
            type: String
        }
    },
    {
        timestamps: true,
        toJSON: { getters: true },
        toObject: { getters: true }
    }
);

const basicSalaryModel = mongoose.model("basicSalary", basicSalarySchema);

module.exports = { basicSalaryModel };