const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const employeeLeaveSchema = new Schema(
    {
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'employee',
        },
        leave_type: {
            type: String,
        },
        leaves: {
            type: String,
        },
        start_date: {
            type: String,
        },
        end_date: {
            type: String,
        },
        leave_category: {
            type: String,
        },
        status: {
            type: String,
            enum: {
                values: ['Pending', 'Approved', 'Rejected'],
                message: 'Status must be either Pending, Approved or Rejected'
            },
            default: 'Pending',
        },
        reason: {
            type: String,
        },
        is_unexpected: {
            type: String,
        }
    },
    { timestamps: true }
);

const leaveModel = mongoose.model("Employee Leave", employeeLeaveSchema);

module.exports = { leaveModel };