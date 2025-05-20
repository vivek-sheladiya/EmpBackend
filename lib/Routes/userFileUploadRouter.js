const { addFileUpload } = require("../Controllers/userFileUploadController")
const {ensureAuthenticated} = require('../Middlewares/Auth');
const router = require('express').Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/zip', 'application/x-zip-compressed'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only .zip files are allowed'), false);
        }
    }
});

router.post('/fileUpload', upload.single("uploadFile"), addFileUpload);

module.exports = router;