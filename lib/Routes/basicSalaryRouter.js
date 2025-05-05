const { addUpdateBasicSalary, basicSalaryList, deleteBasicSalary, generateSalaryReports, generateSalary, updateSalary } = require('../Controllers/basicSalaryController')
const ensureAuthenticated = require('../Middlewares/Auth');
const router = require('express').Router();

router.get('/basicSalaryList', ensureAuthenticated, basicSalaryList);
router.post('/addUpdateBasicSalary/:_id?', ensureAuthenticated, addUpdateBasicSalary);
router.delete('/deleteBasicSalary/:_id', ensureAuthenticated, deleteBasicSalary);
router.get('/salaryReportList/:user?/:year?/:month?', ensureAuthenticated, generateSalaryReports);
router.get('/salaryReportList/:year?', ensureAuthenticated, generateSalaryReports);
router.post('/salaryReportsUpdate', ensureAuthenticated, updateSalary);
router.get('/generateSalaryReports', ensureAuthenticated, generateSalary);

module.exports = router;