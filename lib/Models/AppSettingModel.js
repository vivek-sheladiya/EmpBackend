const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const AppSettingSchema = new Schema(
  {
    officeStartTime: { type: String, default: null },
    officeEndTime: { type: String, default: null },
    breakDuration: { type: Number, default: null },
    screenshotTime: { type: Number, default: 15 },
    showScreenShot: { type: Boolean, default: true },
    isTakeScreenShot: { type: Boolean, default: true },
    adminEmail: { type: String, default: null },
    yearlyPaidLeave: { type: Number, default: null },
    monthlyMaxPaidLeave: { type: Number, default: null },
    monthlyTotalHours: {
      january: Number,
      february: Number,
      march: Number,
      april: Number,
      may: Number,
      june: Number,
      july: Number,
      august: Number,
      september: Number,
      october: Number,
      november: Number,
      december: Number
    }
  },
  { timestamps: true }
);

const AppSettingModel = mongoose.model("appSetting", AppSettingSchema);

module.exports = { AppSettingModel };
