const cron = require('node-cron');
const moment = require('moment');
const { AttendanceModel } = require('./lib/Models/AttendanceModel');

const autoPunchOutJob = () => {
  cron.schedule('0 0 * * *', async () => {  // Runs once a day at 12:00 AM (midnight)
    try {
      const yesterdayStart = moment().subtract(1, "days").startOf("day").valueOf();
      const yesterdayEnd = moment().subtract(1, "days").endOf("day").valueOf();
      const currentTime = Date.now();
  
      const records = await AttendanceModel.find({
        createdAt: { $gte: new Date(yesterdayStart), $lte: new Date(yesterdayEnd) },
        $or: [{ isPunchIn: true }, { isBreakIn: true }],
        "punchTime.punchOutTime": null
    });
  
      console.log('Attendance records found:', records.length);
  
      if (records.length === 0) {
        console.log('No users found for auto punch-out.');
        return;
      }
  
      for (let prevDayAttendance of records) {
        const autoPunchOutTime = moment().subtract(1, 'day').set({ hour: 18, minute: 0, second: 0, millisecond: 0 }).valueOf(); // Previous day 6:00 PM timestamp
        const lastPunch = prevDayAttendance.punchTime[prevDayAttendance.punchTime.length - 1];
        
        lastPunch.punchOutTime = autoPunchOutTime;
        prevDayAttendance.isPunchIn = false;
        prevDayAttendance.isUnderVerification = true;
  
        if (prevDayAttendance.isBreakIn) {
          const lastBreak = prevDayAttendance.breakTime[prevDayAttendance.breakTime.length - 1];
          lastBreak.breakOutTime = autoPunchOutTime;
          prevDayAttendance.isBreakIn = false;
        }
  
        await prevDayAttendance.save();
        console.log(`Auto punch-out updated for user: ${prevDayAttendance.userId}`);
      }
    } catch (err) {
      console.error('Error in auto punch-out task:', err);
    }
  });
};

module.exports = autoPunchOutJob;
