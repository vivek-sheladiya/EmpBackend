const {
    addTask,
    getAllTasks,
    updateTask,
    uploadFiles, deleteTask
} = require('../Controllers/TaskController');
const upload = require('../../imageUploader');

const router = require('express').Router();

router.post('/addTask', addTask);
router.post('/updateTask/:id?', updateTask);
router.get('/getAllTasks', getAllTasks);
router.delete('/deleteTask/:_id', deleteTask);
router.post('/uploadFiles', upload.array('taskAttachment'), uploadFiles);

module.exports = router;