const {
  handleError,
} = require("../utils/utils");
const { UserModel } = require("../Models/UserModel");
const { HolidayEventModel } = require("../Models/HolidayEventModel");
const dayjs = require("dayjs");
const moment = require("moment/moment");

const addEvent = async (req, res) => {
  try {

    const data = req.body;

    const events = Array.isArray(data) ? data : [data];

    const savedEvents = [];

    for (const evt of events) {
      const { eventTitle, eventDetail, eventType, eventLeaveType, eventDate, endDate, isLeaveOnDay, isSilentLeave } = evt;

      if (!eventTitle || !eventDate) {
        return res.status(400).json({
          success: false,
          message: "eventTitle and eventDate are required for each event",
        });
      }

      if (eventType.toLowerCase() === 'birthday') {
        const newEvent = new HolidayEventModel({
          eventTitle,
          eventDetail,
          eventType,
          eventLeaveType,
          eventDate,
          endDate,
          isLeaveOnDay,
          isSilentLeave,
        });

        const saved = await newEvent.save();
        savedEvents.push(saved);
      } else {
        const existingEvent = await HolidayEventModel.findOne({
          eventType,
          eventDate,
          endDate,
        });

        console.log("existingEvent", existingEvent)

        if (existingEvent) {
          await HolidayEventModel.findByIdAndUpdate(existingEvent._id, {
            $set: evt,
          }, { new: true });

          savedEvents.push(existingEvent);
        } else {
          const newEvent = new HolidayEventModel({
            eventTitle,
            eventDetail,
            eventType,
            eventLeaveType,
            eventDate,
            endDate,
            isLeaveOnDay,
            isSilentLeave,
          });

          const saved = await newEvent.save();
          savedEvents.push(saved);
        }
      }
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

    const data = req.body;

    const events = Array.isArray(data) ? data : [data];

    for (const evt of events) {
      const { eventTitle, eventType, eventDate, endDate } = evt;

      if (!eventTitle || !eventDate) {
        return res.status(400).json({
          success: false,
          message: "eventTitle and eventDate are required for each event",
        });
      }

      if (eventType.toLowerCase() === 'birthday') {
        await HolidayEventModel.findByIdAndUpdate(eventId, { $set: evt }, { new: true });
      } else {
        const existingEvent = await HolidayEventModel.findOne({
          eventType,
          eventDate,
          endDate,
        });

        if (existingEvent && existingEvent._id.toString() !== eventId) {
          await HolidayEventModel.findByIdAndUpdate(existingEvent._id, {
            $set: evt,
          }, { new: true });
        } else {
          await HolidayEventModel.findByIdAndUpdate(eventId, { $set: evt }, { new: true });
        }
      }

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

    // const dbEvents = holidayEvents.map(ev => {
    //   const obj = ev.toObject();
    //   return {
    //     ...obj,
    //     eventId: obj._id,
    //     isFromDb: true,
    //   };
    // });
    //
    // console.log("holidayEvents", dbEvents);
    //
    // const allEvents = [...birthdayEvents, ...dbEvents];
    // await HolidayEventModel.deleteMany({ eventTitle: "Sunday" });

    const allEvents = await getAllEvents();

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
        const dob = moment(user.dateOfBirth);
        const dateOfBirth = dob.format("YYYY-MM-DD");

        const event = new HolidayEventModel({
          eventTitle: user.fullName,
          eventType: "birthday",
          eventDate: dateOfBirth,
        });

        const eventObj = event.toObject();
        eventObj.isFromDb = false;
        return eventObj;
      });
};

const getAllEvents = async () => {
  const birthdayEvents = await generateBirthdayEvents();
  const holidayEvents = await HolidayEventModel.find();

  const dbEvents = holidayEvents.map(ev => {
    const obj = ev.toObject();
    return {
      ...obj,
      eventId: obj._id,
      isFromDb: true,
    };
  });

  return [...birthdayEvents, ...dbEvents];
};

module.exports = {
  addEvent, generateBirthdayEvents, getAllEventHolidays, updateEvent, deleteEvent
};
