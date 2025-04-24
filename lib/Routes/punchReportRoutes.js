const router = require('express').Router();
const ensureAuthenticated = require('../Middlewares/Auth');
const { punchDataGet } = require("../Controllers/punchReportController");

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

router.post('/punchSheetUploadAndGetData', ensureAuthenticated, upload.single('sheet'), punchDataGet);

module.exports = router;