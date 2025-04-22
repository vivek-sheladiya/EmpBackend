const {
  handleError,
} = require("../utils/utils");
const { AppSettingModel } = require("../Models/AppSettingModel");

const updateSetting = async (req, res) => {
  try {
    const updates = req.body;

    let settings = await AppSettingModel.findOne();
    if (!settings) {
      settings = new AppSettingModel();
    }

    Object.assign(settings, updates);

    await settings.save();

    return res.status(200).json({
      success: true,
      message: "Settings updated successfully",
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
