const { signup, login, verifyEmail, forgetPassSendOtp, forgetPassVerifyOtp, forgetPassword, changePassword, isElectronApp } = require('../Controllers/AuthController');
const { signupValidation, loginValidation } = require('../Middlewares/AuthValidation');
const ensureAuthenticated = require('../Middlewares/Auth');
const upload = require('../../imageUploader');

const router = require('express').Router();

router.get('/isElectronApp',isElectronApp);
router.post('/login',loginValidation, login);
router.post('/signup', signupValidation, signup);
router.post('/forgetPassSendOtp', forgetPassSendOtp);
router.post('/forgetPassVerifyOtp', forgetPassVerifyOtp);
router.post('/forgetPassword', forgetPassword);
router.get('/verifyEmail/:token', verifyEmail);
router.post('/changePassword', ensureAuthenticated, changePassword);

module.exports = router;