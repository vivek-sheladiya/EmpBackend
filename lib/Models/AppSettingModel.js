const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const AppSettingSchema = new Schema(
  {
    officeStartTime: { type: String, default: null },
    officeEndTime: { type: String, default: null },
    breakDuration: { type: String, default: null },
    screenshotCaptureTime: { type: String, default: null },
  },
  { timestamps: true }
);

const AppSettingModel = mongoose.model("appSetting", AppSettingSchema);

module.exports = { AppSettingModel };
