const { addClient, clientProjectList, deleteClientProject, updateClientProject } = require('../Controllers/clientProjectController')
const ensureAuthenticated = require('../Middlewares/Auth');
const router = require('express').Router();

router.get('/clientProjectList', ensureAuthenticated, clientProjectList);
router.post('/addClientProject', ensureAuthenticated, addClient);
router.delete('/deleteClientProject/:_id', ensureAuthenticated, deleteClientProject);
router.put('/updateClientProject/:_id', ensureAuthenticated, updateClientProject);

module.exports = router;