const {
    addApp,
    updateApp,
    deleteApp,
    getAllApps,
    getSingleApp,
    isUpdateAvailable,
} = require("../Controllers/AppVersionController");
const router = require("express").Router();

router.post("/addSoftApp", addApp);
router.post("/updateSoftApp/:_id", updateApp);
router.delete("/deleteSoftApp/:_id", deleteApp);
router.get("/getAllSoftApps", getAllApps);
router.get("/getSingleSoftApp/:_id", getSingleApp);
router.get("/isUpdateAvailable", isUpdateAvailable);

module.exports = router;