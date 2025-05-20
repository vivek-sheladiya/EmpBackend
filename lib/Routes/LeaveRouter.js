const { addLeaveRule, addLeave, updateLeave, deleteLeave, list, empLeaveList, LeaveStatusChange, unexpectedLeave, allLeaveLength, addUpdateMonthlyManualHours, getMonthlyManualHours } = require('../Controllers/LeaveController')
const {ensureAuthenticated} = require('../Middlewares/Auth');
const { addUpdateLeave } = require("../Controllers/LeaveControllerNew");
const router = require('express').Router();

router.get('/allLeaveList', ensureAuthenticated, list);
router.get('/empLeaveList', ensureAuthenticated, empLeaveList);
router.post('/addUpdateLeave/:id?', ensureAuthenticated, addUpdateLeave);
router.post('/addLeave', ensureAuthenticated, addLeave);
router.post('/updateLeave/:_id', ensureAuthenticated, updateLeave);
router.delete('/deleteLeave/:_id', ensureAuthenticated, deleteLeave);
router.post('/leaveStatusChange/:_id', ensureAuthenticated, LeaveStatusChange);
router.get('/isUnexpectedLeave', ensureAuthenticated, unexpectedLeave);

// router.get('/allLeaveLength/:_id?/:leaveCategory?/:status?/:year?/:month?', ensureAuthenticated, allLeaveLength);
router.get('/allLeaveLength', ensureAuthenticated, allLeaveLength);

router.post('/MonthlyManualHours', ensureAuthenticated, addUpdateMonthlyManualHours);
router.get('/getMonthlyManualHours', ensureAuthenticated, getMonthlyManualHours);
router.get('/getMonthlyManualHours/:year', ensureAuthenticated, getMonthlyManualHours);
router.post('/leaveRules', ensureAuthenticated, addLeaveRule);



module.exports = router;
