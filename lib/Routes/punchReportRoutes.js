const router = require('express').Router();
const {ensureAuthenticated} = require('../Middlewares/Auth');
const { storePunchReports, getPunchReports, deletePunchReports, updatePunchReports, salaryReportsGenerate, storePunchReportsEX } = require("../Controllers/punchReportController");

const path = require('path');
const multer = require('multer');
const xlsx = require('xlsx');

const upload = multer({
    dest: 'uploads/',
    fileFilter: (req, file, cb) => {
        const filetypes = /xlsx|xls/;
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
        if (extname) return cb(null, true);
        cb(new Error('Only Excel files are allowed'));
    }
});

// router.post('/punchSheetUploadAndGetData', ensureAuthenticated, upload.single('sheet'), storePunchReports);
router.get('/getPunchReportsList', ensureAuthenticated, getPunchReports);
router.delete('/deletePunchReport/:_id', ensureAuthenticated, deletePunchReports);
router.post('/updatePunchReports/:_id', ensureAuthenticated, updatePunchReports);
router.get('/salaryReportGenerate', ensureAuthenticated, salaryReportsGenerate);


router.post('/punchSheetUploadAndGetData', ensureAuthenticated, upload.single('sheet'), storePunchReportsEX);

module.exports = router;