const {
    getAllUsers,
    deleteUser,
    getUserByEmail,
    getUserByName,
    addUsers,
    getUserById,
    updateRecord,
    userProfile,
    getUsersList
} = require('../Controllers/UserDataController');
const upload = require('../../imageUploader');

const router = require('express').Router();
router.post('/addUser', upload.single('profilePhoto'), addUsers);
router.get('/getAllUsers', getAllUsers);
router.get('/getUsersList', getUsersList);
router.delete('/deleteUser/:id', deleteUser);
router.get('/getUserByEmail/:email', getUserByEmail);
router.get('/getUserById/:userId', getUserById);
router.get('/getUserByName/:name', getUserByName);
router.post('/updateRecord/:userId', upload.single("profilePhoto"), updateRecord);
router.get('/userProfile/:userId', userProfile);

module.exports = router;