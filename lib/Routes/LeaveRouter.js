const { addLeave, updateLeave, deleteLeave, list, empLeaveList, LeaveStatusChange, unexpectedLeave, allLeaveLength } = require('../Controllers/LeaveController')
const ensureAuthenticated = require('../Middlewares/Auth');
const router = require('express').Router();

router.get('/leave/list', ensureAuthenticated, list);
router.post('/leave/empLeaveList', ensureAuthenticated, empLeaveList);
router.post('/leave/addLeave', ensureAuthenticated, addLeave);
router.post('/leave/updateLeave/:_id', ensureAuthenticated, updateLeave);
router.delete('/leave/deleteLeave/:_id', ensureAuthenticated, deleteLeave);
router.put('/leave/leaveStatusChange/:_id', ensureAuthenticated, LeaveStatusChange);
router.get('/leave/isUnexpectedLeave', ensureAuthenticated, unexpectedLeave);
router.get('/leave/allLeaveLength/:_id', ensureAuthenticated, allLeaveLength);

module.exports = router;
