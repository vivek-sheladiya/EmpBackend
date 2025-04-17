const { addLeave, deleteLeave, list, empLeaveList, LeaveStatusChange } = require('../Controllers/LeaveController')
const ensureAuthenticated = require('../Middlewares/Auth');
const { leaveValidation } = require('../Middlewares/leaveMiddleware')
const router = require('express').Router();

router.get('/leave/list', ensureAuthenticated, list);
router.post('/leave/empLeaveList', ensureAuthenticated, empLeaveList);
router.post('/leave/addLeave', ensureAuthenticated, leaveValidation, addLeave);
router.delete('/leave/deleteLeave/:_id', ensureAuthenticated, deleteLeave);
router.put('/leave/leaveStatusChange/:_id', ensureAuthenticated, LeaveStatusChange);

module.exports = router;
