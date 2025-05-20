const { addUpdateBasicSalary, basicSalaryList, deleteBasicSalary, generateSalaryReports, updateSalary,
    updateSalaryReport, publishSalaryReport, getUserWiseReport, salaryCodeVerify
} = require('../Controllers/basicSalaryController')
const {ensureAuthenticated} = require('../Middlewares/Auth');
const router = require('express').Router();

router.get('/basicSalaryList', ensureAuthenticated, basicSalaryList);
router.post('/addUpdateBasicSalary/:_id?', ensureAuthenticated, addUpdateBasicSalary);
router.delete('/deleteBasicSalary/:_id', ensureAuthenticated, deleteBasicSalary);
router.post('/updateSalaryReport', ensureAuthenticated, updateSalaryReport);
router.post('/salaryReportsUpdate', ensureAuthenticated, updateSalary);
router.get('/generateSalaryReports', ensureAuthenticated, generateSalaryReports);
router.post('/publishSalaryReport', ensureAuthenticated, publishSalaryReport);
router.get('/getUserWiseReport', ensureAuthenticated, getUserWiseReport);
router.post('/salaryCodeVerify', ensureAuthenticated, salaryCodeVerify);

module.exports = router;