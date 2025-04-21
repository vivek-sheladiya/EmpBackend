const { addUpdateBasicSalary, basicSalaryList, deleteBasicSalary, generateSalaryReports } = require('../Controllers/basicSalaryController')
const ensureAuthenticated = require('../Middlewares/Auth');
const router = require('express').Router();

router.get('/basicSalary/basicSalaryList', ensureAuthenticated, basicSalaryList);
router.post('/basicSalary/addUpdateBasicSalary', ensureAuthenticated, addUpdateBasicSalary);
router.post('/basicSalary/addUpdateBasicSalary/:_id', ensureAuthenticated, addUpdateBasicSalary);
router.delete('/basicSalary/deleteBasicSalary/:_id', ensureAuthenticated, deleteBasicSalary);


router.post('/salaryReport/salaryReportList', ensureAuthenticated, generateSalaryReports);



module.exports = router;