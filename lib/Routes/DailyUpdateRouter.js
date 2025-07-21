const express = require('express');
const {addDailyUpdate, updateDailyUpdate, getDailyUpdate, getAllDailyUpdate, getTodayUpdate} = require("../Controllers/DailyUpdateController");
const router = express.Router();

router.post('/addDailyUpdate', addDailyUpdate);
router.post('/editDailyUpdate/:id', updateDailyUpdate);
router.get('/getDailyUpdate/:id?', getDailyUpdate);
router.get('/getAllDailyUpdate', getAllDailyUpdate);
router.get('/getTodayUpdate', getTodayUpdate);

module.exports = router;