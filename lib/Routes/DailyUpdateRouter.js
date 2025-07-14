const express = require('express');
const router = express.Router();
const DailyUpdateController = require('../controllers/DailyUpdateController');

router.post('/addDailyUpdate', DailyUpdateController.addDailyUpdate);
router.post('/editDailyUpdate/:id', DailyUpdateController.updateDailyUpdate);
router.get('/getDailyUpdate/:id?', DailyUpdateController.getDailyUpdate);
router.get('/getAllDailyUpdate', DailyUpdateController.getAllDailyUpdate);

module.exports = router;