const express = require('express');
const {addDailyUpdate, updateDailyUpdate, getDailyUpdate, getAllDailyUpdate} = require("../Controllers/DailyUpdateController");
const router = express.Router();

router.post('/addDailyUpdate', addDailyUpdate);
router.post('/editDailyUpdate/:id', updateDailyUpdate);
router.get('/getDailyUpdate/:id?', getDailyUpdate);
router.get('/getAllDailyUpdate', getAllDailyUpdate);

module.exports = router;