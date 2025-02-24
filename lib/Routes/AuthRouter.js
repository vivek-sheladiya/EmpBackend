const { signup, login, verifyEmail, forgetPassSendOtp, forgetPassVarifyOtp, forgetPassword, resetPassword, updateUser, updateRecord, isElectronApp } = require('../Controllers/AuthController');
const { signupValidation, loginValidation } = require('../Middlewares/AuthValidation');
const ensureAuthenticated = require('../Middlewares/Auth');
const upload = require('../../imageUploader');

const router = require('express').Router();

router.get('/isElectronApp',isElectronApp);
router.post('/login',loginValidation, login);
router.post('/signup', signupValidation, signup);
router.post('/forgetPassSendOtp', forgetPassSendOtp);
router.post('/forgetPassVarifyOtp', forgetPassVarifyOtp);
router.post('/forgetPassword', forgetPassword);
router.get('/verifyEmail/:token', verifyEmail);
router.post('/resetPassword', ensureAuthenticated, resetPassword);
router.post('/updateUser/:userId', ensureAuthenticated, updateUser);
router.post('/updateRecord/:userId', ensureAuthenticated, upload.single("profilePhoto"), updateRecord);

module.exports = router;