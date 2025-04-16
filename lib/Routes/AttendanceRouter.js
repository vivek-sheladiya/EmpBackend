const {
    addAttendance,
    getTodayAttendance,
    getUserWiseAttendanceData,
    deleteScreenshot,
} = require('../Controllers/AttendanceController');
const upload = require('../../imageUploader');

const router = require('express').Router();
router.post('/addAttendance', upload.single('screenshot'), addAttendance);
router.get('/getTodayAttendance/:userId?', getTodayAttendance);
router.get('/userWiseAttendanceData/:userId', getUserWiseAttendanceData);
router.delete('/deleteScreenshot', deleteScreenshot);

module.exports = router;