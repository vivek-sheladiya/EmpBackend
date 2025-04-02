const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const AppSettingSchema = new Schema(
  {
    officeStartTime: { type: String, default: null },
    officeEndTime: { type: String, default: null },
    breakDuration: { type: String, default: null },
    screenshotTime: { type: String, default: 15 },
    showScreenShot: { type: Boolean, default: true },
    isTakeScreenShot: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const AppSettingModel = mongoose.model("appSetting", AppSettingSchema);

module.exports = { AppSettingModel };
