const { addUpdateBasicSalary, basicSalaryList, deleteBasicSalary, generateSalaryReports } = require('../Controllers/basicSalaryController')
const ensureAuthenticated = require('../Middlewares/Auth');
const router = require('express').Router();

router.get('/basicSalaryList', ensureAuthenticated, basicSalaryList);
router.post('/addUpdateBasicSalary/:_id?', ensureAuthenticated, addUpdateBasicSalary);
router.delete('/deleteBasicSalary/:_id', ensureAuthenticated, deleteBasicSalary);
router.post('/salaryReportList', ensureAuthenticated, generateSalaryReports);

module.exports = router;