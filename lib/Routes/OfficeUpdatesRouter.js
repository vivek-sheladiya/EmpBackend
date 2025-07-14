const express = require('express');
const {getOfficeUpdate, addOfficeUpdate, updateOfficeUpdate, deleteOfficeUpdate} = require("../Controllers/OfficeUpdateController");
const router = express.Router();

router.post('/addOfficeUpdate/', addOfficeUpdate);
router.post('/editOfficeUpdate/:id', updateOfficeUpdate);
router.get('/getOfficeUpdate/:id?', getOfficeUpdate);
router.delete('/deleteOfficeUpdate/:id', deleteOfficeUpdate);

module.exports = router;