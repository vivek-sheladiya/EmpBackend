const { getAllUsers, deleteUser, getUserByEmail, getUserByName, addUsers, getUserById, addAttendance, getTodayAttendance, getEmployeeDashboardData, getAdminDashboardData, getUserWiseAttendanceData, deleteScreenshot, getUsersList, addTask, getAllTasks, updateTask } = require('../Controllers/UserDataController');
const ensureAuthenticated = require('../Middlewares/Auth');
const { addUserValidation } = require('../Middlewares/AuthValidation');
const upload = require('../../imageUploader');

const router = require('express').Router();
router.post('/addUser', ensureAuthenticated, upload.single('profilePhoto'), addUsers);
// router.post('/addUser', ensureAuthenticated, upload.single('profilePhoto'), addUserValidation, addUsers);
router.get('/getAllUsers', ensureAuthenticated, getAllUsers);
router.get('/getUsersList', ensureAuthenticated, getUsersList);
router.delete('/deleteUser/:id', ensureAuthenticated, deleteUser);
router.get('/getUserByEmail/:email', ensureAuthenticated, getUserByEmail);
router.get('/getUserById/:userId', ensureAuthenticated, getUserById);
router.get('/getUserByName/:name', ensureAuthenticated, getUserByName);
router.post('/addAttendance', upload.single('screenshot'), addAttendance);
router.get('/empDashboard/:userId', getEmployeeDashboardData);
router.get('/getTodayAttendance/:userId', getTodayAttendance);
router.get('/adminDashboard', getAdminDashboardData);
router.get('/userWiseAttendanceData/:userId', getUserWiseAttendanceData);
router.delete('/deleteScreenshot', deleteScreenshot);
router.post('/addTask', ensureAuthenticated, addTask);
router.post('/updateTask/:id', ensureAuthenticated, updateTask);
router.get('/getAllTasks', ensureAuthenticated, getAllTasks);

module.exports = router;