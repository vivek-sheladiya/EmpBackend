const { signup, login, verifyEmail, forgetPassSendOtp, forgetPassVarifyOtp, forgetPassword, changePassword, updateUser, updateRecord, isElectronApp, userProfile } = require('../Controllers/AuthController');
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
router.post('/changePassword', ensureAuthenticated, changePassword);
router.post('/updateUser/:userId', ensureAuthenticated, updateUser);
router.post('/updateRecord/:userId', ensureAuthenticated, upload.single("profilePhoto"), updateRecord);
router.get('/userProfile/:userId', ensureAuthenticated, userProfile);

module.exports = router;