const { addClient, clientProjectList, deleteClientProject, updateClientProject } = require('../Controllers/clientProjectController')
const ensureAuthenticated = require('../Middlewares/Auth');
const router = require('express').Router();

router.get('/getClient', ensureAuthenticated, clientProjectList);
router.post('/addClient', ensureAuthenticated, addClient);
router.post('/updateClient/:_id', ensureAuthenticated, updateClientProject);
router.delete('/deleteClient/:_id', ensureAuthenticated, deleteClientProject);

module.exports = router;