const {
  handleError,
} = require("../utils/utils");
const { AppSettingModel } = require("../Models/AppSettingModel");

const updateSetting = async (req, res) => {
  try {
    const { officeStartTime, officeEndTime, breakDuration, screenshotCaptureTime } = req.body;

    let settings = await AppSettingModel.findOne();
    if (!settings) {
      settings = new AppSettingModel();
    }

    settings.officeStartTime = officeStartTime || settings.officeStartTime;
    settings.officeEndTime = officeEndTime || settings.officeEndTime;
    settings.breakDuration = breakDuration || settings.breakDuration;
    settings.screenshotCaptureTime = screenshotCaptureTime || settings.screenshotCaptureTime;

    await settings.save();
    return res.status(200).json({
      success: true,
      message: "Settings update successfully",
      data: settings,
    });
  } catch (err) {
    return handleError(res, err.message);
  }
};

const getAppSetting = async (req, res) => {
  try {
    let settings = await AppSettingModel.findOne();
    if (!settings) {
      settings = await AppSettingModel.create({}); // Create default settings if not found
    }
    return res.status(200).json({
      success: true,
      message: "Settings fetched successfully",
      data: settings,
    });
  } catch (err) {
    return handleError(res, err.message);
  }
};

module.exports = {
  updateSetting,
  getAppSetting,
};
