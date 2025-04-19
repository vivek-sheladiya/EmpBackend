const {
  handleError,
} = require("../utils/utils");
const { UserModel } = require("../Models/UserModel");
const { HolidayEventModel } = require("../Models/HolidayEventModel");

const addEvent = async (req, res) => {
  try {
    // const { eventTitle, eventDetail, eventType, eventDate } = req.body;
    //
    // const newEvent = new HolidayEventModel({
    //   eventTitle,
    //   eventDetail,
    //   eventType,
    //   eventDate,
    // });
    //
    // await newEvent.save();
    const data = req.body;

    // Check if incoming data is an array (multiple events) or a single object
    const events = Array.isArray(data) ? data : [data];

    const savedEvents = [];

    for (const evt of events) {
      const { eventTitle, eventDetail, eventType, eventLeaveType, eventDate, isLeaveOnDay } = evt;

      if (!eventTitle || !eventDate) {
        return res.status(400).json({
          success: false,
          message: "eventTitle and eventDate are required for each event",
        });
      }

      const newEvent = new HolidayEventModel({
        eventTitle,
        eventDetail,
        eventType,
        eventLeaveType,
        eventDate,
        isLeaveOnDay,
      });

      const saved = await newEvent.save();
      savedEvents.push(saved);
    }

    const allEvents = await getAllEvents();

    return res.status(201).json({
      success: true,
      message: "Event added successfully",
      data: allEvents,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const updateEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!eventId) {
      return res.status(400).json({ success: false, message: "eventId is required" });
    }

    // await HolidayEventModel.findByIdAndUpdate(eventId, req.body);

    const data = req.body;

    // Check if incoming data is an array (multiple events) or a single object
    const events = Array.isArray(data) ? data : [data];

    const savedEvents = [];

    for (const evt of events) {
      const { eventTitle, eventDetail, eventType, eventLeaveType, eventDate, isLeaveOnDay } = evt;

      if (!eventTitle || !eventDate) {
        return res.status(400).json({
          success: false,
          message: "eventTitle and eventDate are required for each event",
        });
      }

      const newEvent = new HolidayEventModel({
        eventTitle,
        eventDetail,
        eventType,
        eventLeaveType,
        eventDate,
        isLeaveOnDay,
      });

      await HolidayEventModel.findByIdAndUpdate(eventId, req.body);

      const saved = await newEvent.save();
      savedEvents.push(saved);
    }

    const allEvents = await getAllEvents();

    return res.status(200).json({
      success: true,
      message: "Event updated successfully",
      data: allEvents,
    });
  } catch (err) {
    console.error("Update Event Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const { eventId } = req.params;

    if (!eventId) {
      return res.status(400).json({ success: false, message: "eventId is required" });
    }

    await HolidayEventModel.findByIdAndDelete(eventId);

    const allEvents = await getAllEvents();

    return res.status(200).json({
      success: true,
      message: "Event deleted successfully",
      data: allEvents,
    });
  } catch (err) {
    console.error("Delete Event Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const getAllEventHolidays = async (req, res) => {
  try {
    const birthdayEvents = await generateBirthdayEvents();
    const holidayEvents = await HolidayEventModel.find();

    const dbEvents = holidayEvents.map(ev => {
      const obj = ev.toObject(); // Convert Mongoose document to plain JS object
      return {
        ...obj,
        eventId: obj._id,
        isFromDb: true,
      };
    });

    const allEvents = [...birthdayEvents, ...dbEvents];

    return res.status(200).json({
      success: true,
      message: "Events fetched successfully",
      data: allEvents,
    });
  } catch (error) {
    console.error("Error fetching events:", error);
    return handleError(res, error.message);
  }
};

const generateBirthdayEvents = async () => {
  const users = await UserModel.find({}, { fullName: 1, dateOfBirth: 1 });

  return users
      .filter(user => user.dateOfBirth)
      .map(user => {
        const event = new HolidayEventModel({
          eventTitle: user.fullName,
          eventType: "birthday",
          eventDate: user.dateOfBirth,
        });

        const eventObj = event.toObject();
        eventObj.isFromDb = false; // override or add custom field
        return eventObj;
      });
};

const getAllEvents = async () => {
  const birthdayEvents = await generateBirthdayEvents();
  const holidayEvents = await HolidayEventModel.find();

  const dbEvents = holidayEvents.map(ev => {
    console.log(ev)
    return ({
      eventId: ev._id,
      eventTitle: ev.eventTitle,
      eventDetail: ev.eventDetail,
      eventType: ev.eventType,
      eventDate: ev.eventDate,
      isFromDb: true,
    });
  });

  return [...birthdayEvents, ...dbEvents];
};

module.exports = {
  addEvent, getAllEventHolidays, updateEvent, deleteEvent
};
