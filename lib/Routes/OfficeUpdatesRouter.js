const express = require('express');
const router = express.Router();
const OfficeUpdatesController = require('../controllers/OfficeUpdateController');

router.post('/addOfficeUpdate/', OfficeUpdatesController.addOfficeUpdate);
router.post('/editOfficeUpdate/:id', OfficeUpdatesController.updateOfficeUpdate);
router.get('/getOfficeUpdate/:id?', OfficeUpdatesController.getOfficeUpdate);
router.delete('/deleteOfficeUpdate/:id', OfficeUpdatesController.deleteOfficeUpdate);

module.exports = router;