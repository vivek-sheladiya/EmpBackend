const {
    addSoftApp,
    updateSoftApp,
    deleteSoftApp,
    getAllSoftApps,
    getSingleSoftApp,
    isUpdateAvailable,
} = require("../Controllers/AppVersionController");
const router = require("express").Router();

router.post("/addSoftApp", addSoftApp);
router.post("/updateSoftApp/:_id", updateSoftApp);
router.delete("/deleteSoftApp/:_id", deleteSoftApp);
router.get("/getAllSoftApps", getAllSoftApps);
router.get("/getSingleSoftApp/:_id", getSingleSoftApp);
router.get("/isUpdateAvailable", isUpdateAvailable);

module.exports = router;