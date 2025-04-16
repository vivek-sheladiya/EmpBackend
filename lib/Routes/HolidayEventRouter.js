const {getAllEventHolidays, addEvent, deleteEvent, updateEvent} = require('../Controllers/HolidayEventController');

const router = require('express').Router();

router.get('/getAllEventHolidays', getAllEventHolidays);
router.post('/addEvent', addEvent);
router.post('/updateEvent/:eventId', updateEvent);
router.delete('/deleteEvent/:eventId', deleteEvent);

module.exports = router;