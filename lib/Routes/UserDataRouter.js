const {
    getAllUsers,
    deleteUser,
    getUserByEmail,
    getUserByName,
    addUsers,
    getUserById,
    updateRecord,
    userProfile,
    getUsersList, addUpdateUser
} = require('../Controllers/UserDataController');
const upload = require('../../imageUploader');
const {getMasterData, postNotification, userActiveStatusChange} = require("../Controllers/MasterApiController");

const router = require('express').Router();
router.post('/addUpdateUser/:userId?', upload.single('profilePhoto'), addUpdateUser);
router.post('/addUser', upload.single('profilePhoto'), addUsers);
router.get('/getAllUsers', getAllUsers);
router.get('/getUsersList', getUsersList);
router.delete('/deleteUser/:id', deleteUser);
router.get('/getUserByEmail/:email', getUserByEmail);
router.get('/getUserById/:userId', getUserById);
router.get('/getUserByName/:name', getUserByName);
router.post('/updateRecord/:userId', upload.single("profilePhoto"), updateRecord);
router.get('/userProfile/:userId', userProfile);
router.post('/getMasterData', getMasterData);
router.post('/postNotification', postNotification);
router.post('/userStatusChange', userActiveStatusChange);

module.exports = router;