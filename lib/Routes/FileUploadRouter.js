const { uploadFile, uploadMultiFiles, deleteFile, uploadFileStorage} = require("../Controllers/FileUploadController");
const upload = require("../../imageUploader");

const router = require('express').Router();

router.post('/uploadFile', uploadFileStorage.single('file'), uploadFile);
router.post('/uploadMultiFiles', uploadFileStorage.array('file[]'), uploadMultiFiles);
router.post('/deleteFile', deleteFile);

module.exports = router;
