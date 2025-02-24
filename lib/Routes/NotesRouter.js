const { addNotes } = require('../Controllers/NotesController');
const ensureAuthenticated = require('../Middlewares/Auth');

const router = require('express').Router();

router.post('/addNotes', ensureAuthenticated, addNotes);

module.exports = router;