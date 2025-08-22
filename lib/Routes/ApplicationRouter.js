const express = require("express");
const router = express.Router();
const {
  addApp,
  updateApp,
  deleteApp,
  getApp,
  getAllApps,
  addAppVersion,
} = require("../controllers/ApplicationController");

router.get("/getAllApps", getAllApps);
router.get("/getApp/:id", getApp);
router.post("/addApp", addApp);
router.post("/updateApp/:id", updateApp);
router.delete("/deleteApp/:id", deleteApp);
router.post("/addAppVersion/:id", addAppVersion);

module.exports = router;
