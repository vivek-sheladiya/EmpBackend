const mongoose = require('mongoose');

const dailyUpdateSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'employee',
    },
    todayWorkUpdate: {
        type: String,
        required: true,
    },
    tomorrowPlanning: {
        type: String,
        required: true,
    },
}, {
    timestamps: true,
});

const DailyUpdateModel = mongoose.model("dailyUpdate", dailyUpdateSchema);

module.exports = { DailyUpdateModel };