const { getAllUsers, deleteUser, getUserByEmail, getUserByName, addUsers, getUserById, addAttendance, getTodayAttendance, getEmployeeDashboardData, getAdminDashboardData, getUserWiseAttendanceData, deleteScreenshot, getUsersList, addTask, getAllTasks, updateTask, uploadFiles } = require('../Controllers/UserDataController');
const upload = require('../../imageUploader');
const { getAllEventHolidays, addEvent, deleteEvent, updateEvent } = require('../Controllers/HolidayEventController');

const router = require('express').Router();
router.post('/addUser', upload.single('profilePhoto'), addUsers);
router.get('/getAllUsers', getAllUsers);
router.get('/getUsersList', getUsersList);
router.delete('/deleteUser/:id', deleteUser);
router.get('/getUserByEmail/:email', getUserByEmail);
router.get('/getUserById/:userId', getUserById);
router.get('/getUserByName/:name', getUserByName);
router.post('/addAttendance', upload.single('screenshot'), addAttendance);
router.get('/empDashboard/:userId', getEmployeeDashboardData);
router.get('/getTodayAttendance/:userId?', getTodayAttendance);
router.get('/adminDashboard', getAdminDashboardData);
router.get('/userWiseAttendanceData/:userId', getUserWiseAttendanceData);
router.delete('/deleteScreenshot', deleteScreenshot);
router.post('/addTask', addTask);
router.post('/updateTask/:id?', updateTask);
router.get('/getAllTasks', getAllTasks);
router.post('/uploadFiles', upload.array('taskAttachment'), uploadFiles);


router.get('/getAllEventHolidays', getAllEventHolidays);
router.post('/addEvent', addEvent);
router.post('/updateEvent/:eventId', updateEvent);
router.delete('/deleteEvent/:eventId', deleteEvent);

module.exports = router;