const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const AttendanceSchema = new Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "employee",
            required: true,
        },
        // username: { type: String, default: null },
        punchTime: [
            {
                punchInTime: {type: Number, default: null},
                punchOutTime: {type: Number, default: null},
            },
        ],
        breakTime: [
            {
                breakInTime: {type: Number, default: null},
                breakOutTime: {type: Number, default: null},
            },
        ],
        lastPunchInTime: {type: Number, default: null},
        lastBreakInTime: {type: Number, default: null},
        isPunchIn: {type: Boolean, default: false},
        isBreakIn: {type: Boolean, default: false},
        workingHours: {type: Number, default: null},
        breakHours: {type: Number, default: null},
        overtime: {type: Number, default: null},
        totalHours: {type: Number, default: null},
        lateArrival: {type: Number, default: ""},
        punchInAt: {type: Number, default: null},
        screenshots: [
            {
                image: {type: String, default: ""},
                capturedTime: {type: Number, default: null},
                keyPressCount: {type: Number, default: null},
                mouseEventCount: {type: Number, default: null},
            },
        ],
        keyPressCount: {type: Number, default: null},
        mouseEventCount: {type: Number, default: null},
        tasks: [
            {
                userId: {type: String, default: ""},
                title: {type: String, default: ""},
                description: {type: String, default: ""},
                status: {type: String, default: ""},
                startTime: {type: Number, default: null},
                endTime: {type: Number, default: null},
            },
        ],
        isUnderVerification: {type: Boolean, default: false},
        status: {
            type: String,
            enum: ["Present", "Absent", "Holiday"],
            default: "Absent",
        },
    },
    {timestamps: true}
);

const AttendanceModel = mongoose.model("attendance", AttendanceSchema);

module.exports = {AttendanceModel};
