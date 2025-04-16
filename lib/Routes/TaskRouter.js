const {
    addTask,
    getAllTasks,
    updateTask,
    uploadFiles
} = require('../Controllers/TaskController');
const upload = require('../../imageUploader');

const router = require('express').Router();

router.post('/addTask', addTask);
router.post('/updateTask/:id?', updateTask);
router.get('/getAllTasks', getAllTasks);
router.post('/uploadFiles', upload.array('taskAttachment'), uploadFiles);

module.exports = router;