const { addUpdateBasicSalary, basicSalaryList, deleteBasicSalary, generateSalaryReports, generateSalary, updateSalary } = require('../Controllers/basicSalaryController')
const ensureAuthenticated = require('../Middlewares/Auth');
const router = require('express').Router();

router.get('/basicSalaryList', ensureAuthenticated, basicSalaryList);
router.post('/addUpdateBasicSalary/:_id?', ensureAuthenticated, addUpdateBasicSalary);
router.delete('/deleteBasicSalary/:_id', ensureAuthenticated, deleteBasicSalary);
router.get('/salaryReportList/:user?/:year?/:month?', ensureAuthenticated, generateSalaryReports);
router.get('/salaryReportList/:year?', ensureAuthenticated, generateSalaryReports);
router.put('/salaryReportsUpdate', ensureAuthenticated, updateSalary);

router.get('/generateSalaryReports/:reportType/:user?/:year?/:month?', ensureAuthenticated, generateSalary);
router.get('/generateSalaryReports/:reportType/:year?', ensureAuthenticated, generateSalary);

module.exports = router;