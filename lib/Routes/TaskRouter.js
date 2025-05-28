const {
    addTask,
    getAllTasks,
    updateTask,
    uploadFiles, deleteTask, getGroupTask, taskReorder, postTaskComment, addMultipleTask
} = require('../Controllers/TaskController');
const upload = require('../../imageUploader');

const router = require('express').Router();

router.post('/addTask', addTask);
router.post('/updateTask/:id?', updateTask);
router.post('/postTaskComment/:taskId', postTaskComment);
router.post('/addMultipleTask', addMultipleTask);
router.get('/getAllTasks', getAllTasks);
router.get('/getGroupTask', getGroupTask);
router.patch('/taskReorder', taskReorder);
router.delete('/deleteTask/:_id', deleteTask);
router.post('/uploadFiles', upload.array('taskAttachment'), uploadFiles);

module.exports = router;