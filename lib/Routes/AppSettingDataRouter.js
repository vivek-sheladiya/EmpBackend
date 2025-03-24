const {
  updateSetting,
  getAppSetting,
} = require("../Controllers/AppSettingController");

const router = require("express").Router();
router.post("/updateSetting", updateSetting);
router.get("/getAppSetting", getAppSetting);

module.exports = router;
