const {
  handleError,
} = require("../utils/utils");
const { AppSettingModel } = require("../Models/AppSettingModel");
const { manualHoursModel } = require('../Models/manualHoursModel');
const moment = require("moment");
const {HolidayEventModel} = require("../Models/HolidayEventModel");
const {DailyTimeModel} = require("../Models/DailyTimeModel");
const {translate} = require("@vitalets/google-translate-api");

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
      settings = await AppSettingModel.create({});
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

const insertYearlyData = async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const startDate = moment(`${year}-01-01`);
    const endDate = moment(`${year}-12-31`);

    const appSetting = await AppSettingModel.findOne();
    const breakDuration = appSetting?.appSettings?.breakDuration || 0;

    const holidays = await HolidayEventModel.find({
      isLeaveOnDay: true,
      eventDate: { $regex: `^${year}-` }
    });

    const holidayDates = holidays.map(h => h.eventDate);

    const existingRecords = await DailyTimeModel.find({
      date: { $gte: startDate.format("YYYY-MM-DD"), $lte: endDate.format("YYYY-MM-DD") }
    });

    const existingDatesSet = new Set(existingRecords.map(r => r.date));

    const insertOps = [];

    for (let m = moment(startDate); m.isSameOrBefore(endDate); m.add(1, "days")) {
      const dateStr = m.format("YYYY-MM-DD");

      // Skip if record already exists
      if (existingDatesSet.has(dateStr)) continue;

      const day = m.day(); // 0: Sunday, 6: Saturday
      let startTime = null;
      let endTime = null;
      let breakAllow = false;
      let isLeaveOnDay = false;
      let totalHour = 0;

      if (holidayDates.includes(dateStr)) {
        isLeaveOnDay = true;
      } else {
        if (day === 0) {
          isLeaveOnDay = true;
        } else if (day === 6) {
          startTime = "09:00";
          endTime = "13:00";
          breakAllow = false;
        } else {
          startTime = "09:30";
          endTime = "18:30";
          breakAllow = true;
        }
      }

      if (startTime && endTime) {
        const start = moment(`${dateStr} ${startTime}`, "YYYY-MM-DD HH:mm");
        const end = moment(`${dateStr} ${endTime}`, "YYYY-MM-DD HH:mm");
        let duration = moment.duration(end.diff(start)).asMinutes();
        if (breakAllow) duration -= breakDuration;
        totalHour = parseFloat((duration / 60).toFixed(2));
      }

      insertOps.push({
        date: dateStr,
        startTime,
        endTime,
        breakAllow,
        isLeaveOnDay,
        totalHour
      });
    }

    if (insertOps.length > 0) {
      await DailyTimeModel.insertMany(insertOps);
    }

    return res.status(200).json({
      success: true,
      message: "Yearly data inserted successfully.",
    });
  } catch (error) {
    console.error("Insert Yearly Data Error:", error);
    return handleError(res, error.message);
  }
};

const updateTime = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (updateData.startTime && updateData.endTime) {
      const appSetting = await AppSettingModel.findOne();
      const breakDuration = appSetting?.appSettings?.breakDuration || 0;

      const start = moment(updateData.startTime, "HH:mm");
      const end = moment(updateData.endTime, "HH:mm");

      let duration = moment.duration(end.diff(start)).asMinutes();

      if (updateData.breakAllow) {
        duration -= breakDuration;
      }

      updateData.totalHour = Math.max(0, parseFloat((duration / 60).toFixed(2)));
    }

    const updated = await DailyTimeModel.findByIdAndUpdate(id, updateData, { new: true });

    if (!updated) return res.status(404).json({ success: false, message: "Record not found" });

    return res.status(200).json({
      success: true,
      message: "Time Update Successfully",
      data: updated
    });
  } catch (error) {
    console.error("Update Error:", error);
    return handleError(res, error.message);
  }
};

const getDailyTime = async (req, res) => {
  try {
    const now = moment();
    const month = req.query.month || now.format("MM");
    const year = req.query.year || now.format("YYYY");

    const start = moment(`${year}-${month}-01`);
    const end = moment(start).endOf("month");

    const holidays = await HolidayEventModel.find({
      isLeaveOnDay: true,
      eventDate: {
        $gte: start.format("YYYY-MM-DD"),
        $lte: end.format("YYYY-MM-DD")
      }
    });

    const holidayDates = holidays.map(h => h.eventDate);

    const dailyTimes = await DailyTimeModel.find({
      date: {
        $gte: start.format("YYYY-MM-DD"),
        $lte: end.format("YYYY-MM-DD")
      }
    });

    const updatedRecords = [];

    for (let dt of dailyTimes) {
      if (holidayDates.includes(dt.date) && dt.isLeaveOnDay === false) {
        dt.isLeaveOnDay = true;
        await dt.save();
        updatedRecords.push(dt);
      }
    }

    const finalData = await DailyTimeModel.find({
      date: {
        $gte: start.format("YYYY-MM-DD"),
        $lte: end.format("YYYY-MM-DD")
      }
    }).sort({ date: 1 });

    return res.status(200).json({
      success: true,
      message: "Daily Time Fetch Successfully",
      data: finalData
    });
  } catch (error) {
    console.error("Get Monthly Data Error:", error);
    return handleError(res, error.message);
  }
};

const translateText = async (req, res) => {
  const { text, from, to } = req.body;
  try {
    const result = await translate(text, { from, to });
    res.json({ translatedText: result.text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Translation failed" });
  }
};

module.exports = {
  updateSetting,
  getAppSetting,
  insertYearlyData,
  updateTime,
  getDailyTime,
  translateText,
};
