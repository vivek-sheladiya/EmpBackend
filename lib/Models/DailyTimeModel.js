const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const DailyTimeSchema = new Schema(
    {
        date: { type: String, required: true },
        startTime: { type: String, default: null },
        endTime: { type: String, default: null },
        breakAllow: { type: Boolean, default: true },
        isLeaveOnDay: { type: Boolean, default: false },
        totalHour: { type: Number, default: 0 }
    },
    { timestamps: true }
);

const DailyTimeModel = mongoose.model("dailyTime", DailyTimeSchema);

module.exports = { DailyTimeModel };