const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const DesktopReleaseSchema = new Schema(
  {
    title: { type: String, default: 15 },
    releaseNotes: { type: Boolean, default: true },
    windowDownloadUrl: { type: String, default: null },
    macDownloadUrl: { type: String, default: null },
    version: { type: String, default: null },
  },
  { timestamps: true }
);

const DesktopReleaseModel = mongoose.model("desktopRelease", DesktopReleaseSchema);

module.exports = { AppSettingModel: DesktopReleaseModel };
