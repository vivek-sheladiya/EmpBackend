const {
    projectList,
    updateProject,
    deleteProject
} = require('../Controllers/ProjectController');
const upload = require('../../imageUploader');
const router = require('express').Router();

router.get('/getProject', projectList);
router.post('/updateProject/:id?', upload.array('attachFiles'), updateProject);
router.delete('/deleteProject/:id', deleteProject);

module.exports = router;