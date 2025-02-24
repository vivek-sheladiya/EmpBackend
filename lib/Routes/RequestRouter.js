const ensureAuthenticated = require('../Middlewares/Auth');
const { addRequestValidation, loggedinUserData } = require('../Middlewares/RequestValidation');
const { addComplaint, getAllRequests, deleteRequest, updateComplaint, upload, uploadSingleFile, uploadMultipleFiles, deleteSingleFile, deleteMultipleFiles } = require('../Controllers/RequestController');

const router = require('express').Router();

router.post('/addComplaint', ensureAuthenticated, addRequestValidation, addComplaint);
router.post('/updateComplaint/:complaintId', ensureAuthenticated, updateComplaint);
router.get('/getAllComplaints', ensureAuthenticated, getAllRequests);
router.delete('/deleteComplaint/:id', ensureAuthenticated, deleteRequest);
router.post('/upload', ensureAuthenticated, upload.single('file'), uploadSingleFile);
router.post('/uploadMultiple', ensureAuthenticated, upload.array('files', 10), uploadMultipleFiles);
router.delete('/deleteSingle/:fileName', ensureAuthenticated, deleteSingleFile);
router.post('/deleteMultiple', ensureAuthenticated, deleteMultipleFiles);

module.exports = router;