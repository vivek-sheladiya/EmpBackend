const {
    addApp,
    updateApp,
    deleteApp,
    getAllApps,
    getSingleApp,
    isUpdateAvailable,
} = require("../Controllers/AppVersionController");
const { ensureAuthenticated } = require("../Middlewares/Auth");
const router = require("express").Router();

router.post("/addSoftApp", ensureAuthenticated, addApp);
router.post("/updateSoftApp/:_id", ensureAuthenticated, updateApp);
router.delete("/deleteSoftApp/:_id", ensureAuthenticated, deleteApp);
router.get("/getAllSoftApps", ensureAuthenticated, getAllApps);
router.get("/getSingleSoftApp/:_id", ensureAuthenticated, getSingleApp);
router.get("/isUpdateAvailable", ensureAuthenticated, isUpdateAvailable);

module.exports = router;