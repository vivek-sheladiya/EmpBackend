const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const punchReportSchema = new Schema(
    {
        userName: {
            type: String
            // type: mongoose.Schema.Types.ObjectId,
            // ref: 'employee',
        },
        empCode: {
            type: String
        },
        // date: {
        //     type: Date
        // },
        punchReport: [
            {
                date: {
                    type: Date
                },
                punchList: [
                    {
                        type: {
                            type: String,
                            enum: ['in', 'out'],
                        },
                        time: {
                            type: String,
                            default: null,
                        },

                    },
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
            }
        ],
        // status: {
        //     type: String,
        // },
        // workingHours: {
        //     type: String
        // },
        // missingHours: {
        //     type: String
        // }
    },
    { timestamps: true, }
);

const punchReportModel = mongoose.model("punchReport", punchReportSchema);

module.exports = { punchReportModel };