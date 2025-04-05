const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const HolidayEventSchema = new Schema(
  {
    eventTitle: { type: String, default: null },
    eventDetail: { type: String, default: null },
    eventType: { type: String, default: null },
    eventDate: { type: Date, default: null },
  },
  { timestamps: true }
);

const HolidayEventModel = mongoose.model("calenderEvents", HolidayEventSchema);

module.exports = { HolidayEventModel };
