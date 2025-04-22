const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const employeeLeaveSchema = new Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'employee',
        },
        // user: {
        //     type: mongoose.Schema.Types.ObjectId,
        // },
        leaveType: {
            type: String,
        },
        leaveHalfDayType: {
            type: String,
        },
        hours: {
            type: String,
        },
        dayType: {
            type: String,
        },
        startDate: {
            type: Date,
        },
        endDate: {
            type: Date,
        },
        startTime: {
            type: String
        },
        endTime: {
            type: String
        },
        leaveCategory: {
            type: String,
        },
        status: {
            type: String,
            default: 'pending',
        },
        reason: {
            type: String,
        },
        rejectedReason: {
            type: String,
        },
        isUnexpected: {
            type: Boolean,
            default: false
        },
        sandwichLeave: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

const leaveModel = mongoose.model("leave", employeeLeaveSchema);

module.exports = { leaveModel };