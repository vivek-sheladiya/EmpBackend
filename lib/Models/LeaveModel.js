const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const employeeLeaveSchema = new Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'employee',
        },
        leaveType: {
            type: String,
            default: null,
        },
        leaveHalfDayType: {
            type: String,
            default: null,
        },
        hours: {
            type: String,
            default: null,
        },
        deductHours: {
            type: String,
            default: null,
        },
        deductMinutes: {
            type: String,
            default: null,
        },
        deductHoursDateWise: [
            {
                _id: false,
                date: {
                    type: String,
                    default: null,
                },
                deductHours: {
                    type: String,
                    default: null,
                },
                deductMinutes: {
                    type: String,
                    default: null,
                },
            }
        ],
        dayType: {
            type: String,
            default: null,
        },
        startDate: {
            type: String,
            default: null,
        },
        endDate: {
            type: String,
            default: null,
        },
        startTime: {
            type: String,
            default: null,
        },
        endTime: {
            type: String,
            default: null,
        },
        leaveCategory: {
            type: String,
            default: null,
        },
        status: {
            type: String,
            default: 'pending',
        },
        reason: {
            type: String,
            default: null,
        },
        rejectedReason: {
            type: String,
            default: null,
        },
        isUnexpected: {
            type: Boolean,
            default: false
        },
        sandwichLeave: {
            type: Boolean,
            default: false
        },
        isDeductible: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

const leaveModel = mongoose.model("leave", employeeLeaveSchema);

module.exports = { leaveModel };