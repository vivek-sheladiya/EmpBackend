const {
  updateSetting,
  getAppSetting, insertYearlyData, updateTime, getDailyTime,
} = require("../Controllers/AppSettingController");

const router = require("express").Router();
router.post("/updateSetting", updateSetting);
router.get("/getAppSetting", getAppSetting);
router.post("/insertYearlyData", insertYearlyData);
router.post("/updateTime/:id", updateTime);
router.get("/getDailyTime", getDailyTime);
// router.post("/translate", translateText);

module.exports = router;
