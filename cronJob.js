const cron = require('node-cron');
const moment = require('moment');
const { AttendanceModel } = require('./lib/Models/User');

cron.schedule('0 0 * * *', async () => {
  try {
    const previousDayDate = moment().subtract(1, 'day').format("DD-MM-YYYY");
    const prevDayAttendances = await AttendanceModel.find({
      date: previousDayDate,
      isPunchIn: true,
      'punchTime.punchOutTime': { $exists: false }
    });

    if (prevDayAttendances.length === 0) {
        return;
      }

      for (let prevDayAttendance of prevDayAttendances) {
        const autoPunchOutTime = moment().startOf('day').valueOf();
        prevDayAttendance.punchTime[prevDayAttendance.punchTime.length - 1].punchOutTime = autoPunchOutTime;
        prevDayAttendance.isPunchIn = false;
        prevDayAttendance.isUnderVerification = true;
        if(prevDayAttendance.isBreakIn === true) {
            prevDayAttendance.breakTime[prevDayAttendance.breakTime.length - 1].breakOutTime = autoPunchOutTime;
            prevDayAttendance.isBreakIn = false;
        }
        await prevDayAttendance.save();
      }

  } catch (err) {
    console.error('Error in auto punch-out task:', err);
  }
});
