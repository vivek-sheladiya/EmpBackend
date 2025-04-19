const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const HolidayEventSchema = new Schema(
    {
        eventTitle: {type: String, default: null},
        eventDetail: {type: String, default: null},
        eventType: {type: String, default: null},
        eventLeaveType: {type: String, default: null},
        eventDate: {type: Date, default: null},
        isLeaveOnDay: {type: Boolean, default: false},
        isSilentLeave: {type: Boolean, default: false},
    },
    {timestamps: true}
);

const HolidayEventModel = mongoose.model("calenderEvents", HolidayEventSchema);

module.exports = {HolidayEventModel};
