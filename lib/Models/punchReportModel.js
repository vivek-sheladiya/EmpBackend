const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const punchReportSchema = new Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'employee',
        },
        date: {
            type: Date
        },
        punchReport: [
            {
                type: {
                    type: String,
                    enum: ['in', 'out'],
                },
                time: {
                    type: String
                }
            }
        ],
        status: {
            type: String,
        },
        workingHours: {
            type: String
        },
        missingHours: {
            type: String
        }
    },
    { timestamps: true }
);

const punchReportModel = mongoose.model("leave", punchReportSchema);

module.exports = { punchReportModel };