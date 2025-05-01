const { addUpdateBasicSalary, basicSalaryList, deleteBasicSalary, generateSalaryReports, generateSalary } = require('../Controllers/basicSalaryController')
const ensureAuthenticated = require('../Middlewares/Auth');
const router = require('express').Router();

router.get('/basicSalaryList', ensureAuthenticated, basicSalaryList);
router.post('/addUpdateBasicSalary/:_id?', ensureAuthenticated, addUpdateBasicSalary);
router.delete('/deleteBasicSalary/:_id', ensureAuthenticated, deleteBasicSalary);
router.get('/salaryReportList/:user?/:year?/:month?', ensureAuthenticated, generateSalaryReports);
router.get('/salaryReportList/:year?', ensureAuthenticated, generateSalaryReports);

router.get('/generateSalaryReports/:ReportType/:user?/:year?/:month?', ensureAuthenticated, generateSalary);
router.get('/generateSalaryReports/:ReportType/:year?', ensureAuthenticated, generateSalary);

module.exports = router;