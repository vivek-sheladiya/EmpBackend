const { UserModel, AttendanceModel, TasksModel } = require("../Models/User");
const jwt = require("jsonwebtoken");
const moment = require("moment");
const {
  handleError,
  findEmailAddress,
  findMobileNumber,
  hashPassword,
} = require("../utils/utils");
const path = require("path");
const fs = require("fs");
const { default: mongoose } = require("mongoose");
const environment = require("../../apiEndpoints");
const { Blob } = require("buffer");
const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");
const { AppSettingModel } = require("../Models/AppSettingModel");
dayjs.extend(customParseFormat);

const addUsers = async (req, res) => {
  try {
    const { emailAddress, mobileNumber } = req.body;

    const userData = req.body;

    const emailExist = await findEmailAddress(emailAddress);
    if (emailExist) {
      return handleError(res, "Email Address Already Registered", 400);
    }
    const mobileExist = await findMobileNumber(mobileNumber);
    if (mobileExist) {
      return handleError(res, "Mobile Number Already Registered", 400);
    }

    const verificationToken = jwt.sign(
      { emailAddress },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    let fileUrl = "";

    if (req.file) {
      const form = new FormData();
      const blob = new Blob([req.file.buffer], { type: req.file.mimetype });

      form.append("image", blob, `${Date.now()}_${req.file.originalname}`);

      const response = await fetch(`${environment.apiBaseUrl}upload.php`, {
        method: "POST",
        body: form,
      });

      const result = await response.json();

      if (result.status === true) {
        userData.profilePhoto = environment.apiBaseUrl + result.file_url;
      }
    }
    if (userData && userData.technology) {
      userData.technology = userData.technology.split(",");
    }
    await UserModel.create({
      ...userData,
      password: await hashPassword(userData.password),
      verificationToken,
    });

    return res
      .status(201)
      .json({ success: true, message: "User Added Successfully" });
  } catch (err) {
    console.log(err);
    return handleError(res, err.message);
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await UserModel.aggregate([
      {
        $lookup: {
          from: "attendances",
          localField: "_id",
          foreignField: "userId",
          as: "attendanceData",
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      message: "Data fetched successfully",
      data: users,
    });
  } catch (err) {
    return handleError(res, err.message);
  }
};

const getUsersList = async (req, res) => {
  try {
    const users = await UserModel.find();

    return res.status(200).json({
      success: true,
      message: "Data fetched successfully",
      data: users,
    });
  } catch (err) {
    return handleError(res, err.message);
  }
};

const deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedUser = await UserModel.findByIdAndDelete(id);

    if (!deletedUser) {
      return handleError(res, "User not found", 400);
    }

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
      data: deletedUser,
    });
  } catch (err) {
    return handleError(res, err.message);
  }
};

const getUserByEmail = async (req, res) => {
  const { emailAddress } = req.params;

  try {
    const user = await UserModel.findOne({ emailAddress });

    if (!user) {
      return handleError(res, "User not found", 400);
    }

    return res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      data: user,
    });
  } catch (err) {
    return handleError(res, err.message);
  }
};

const getUserById = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await UserModel.findOne({ userId });

    if (!user) {
      return handleError(res, "User not found", 400);
    }

    return res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      data: user,
    });
  } catch (err) {
    return handleError(res, err.message);
  }
};

const getUserByName = async (req, res) => {
  const { name } = req.params;

  try {
    const users = await UserModel.find({ fullName: name });

    if (users.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No users found", data: [] });
    }

    return res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      data: users,
    });
  } catch (err) {
    return handleError(res, err.message);
  }
};

const OFFICE_START_TIME = moment()
  .set({ hour: 9, minute: 30, second: 0, millisecond: 0 })
  .local()
  .valueOf();
const OFFICE_HOURS_MILLISECONDS = 9 * 60 * 60 * 1000;

const addAttendance = async (req, res) => {
  const {
    userId,
    taskTitle,
    taskDescription,
    keyPressCount,
    mouseEventCount,
  } = req.body;

  const screenshot = req.file;

  try {
    const user = await UserModel.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    let punchInTime = req.body.punchInTime;
    let punchOutTime = req.body.punchOutTime;
    let breakInTime = req.body.breakInTime;
    let breakOutTime = req.body.breakOutTime;

    if (punchInTime) {
      punchInTime = Date.now();
    }
    if (punchOutTime) {
      punchOutTime = Date.now();
    }
    if (breakInTime) {
      breakInTime = Date.now();
    }
    if (breakOutTime) {
      breakOutTime = Date.now();
    }

    const settings = await AppSettingModel.findOne();

    const officeHoursStart = dayjs(settings.officeStartTime, "h:mm a").valueOf();
    const officeHoursEnd = dayjs(settings.officeEndTime, "h:mm a").valueOf();
    const breakDuration = settings.breakDuration * 60 * 1000;
    const totalOfficeHourMilli = dayjs(settings.officeEndTime, "h:mm a").diff(dayjs(settings.officeStartTime, "h:mm a"), "milliseconds") - breakDuration;

    const todayStart = new Date(
      moment().startOf("day").toISOString()
    ).getTime();
    const todayEnd = new Date(moment().endOf("day").toISOString()).getTime();

    let attendance = await AttendanceModel.findOne({
      userId,
      createdAt: { $gte: todayStart, $lte: todayEnd },
    });

    if (!attendance) {
      attendance = new AttendanceModel({
        userId,
      });
    } else {
      if (
        attendance.punchInAt >= todayStart &&
        attendance.punchInAt <= todayEnd
      ) {
        console.log("Punch-in time is from today.");
      } else {
        await AttendanceModel.findByIdAndDelete(attendance._id);
        attendance = new AttendanceModel({
          userId,
        });
      }
    }

    if (punchInTime) {
      const lastPunch =
        attendance.punchTime.length > 0
          ? attendance.punchTime[attendance.punchTime.length - 1]
          : null;

      if (lastPunch && !lastPunch.punchOutTime) {
        return res.status(400).json({
          success: false,
          message: "You must punch out before punching in again.",
        });
      }

      const punchInTimestamp = Number(punchInTime);
      attendance.punchTime.push({
        punchInTime: punchInTimestamp,
        punchOutTime: null,
      });


      console.log(`Office Start Time: ${officeHoursStart}`);
      console.log(`Punch In Time: ${punchInTimestamp}`);

      attendance.lastPunchInTime = punchInTimestamp;

      if (!attendance.punchInAt) {
        attendance.punchInAt = punchInTimestamp;
        attendance.status = "Present";
      }

      if (attendance.punchTime.length === 1) {
        if (punchInTimestamp > officeHoursStart) {
          const diff = punchInTimestamp - officeHoursStart;
          if (isNaN(diff) || diff <= 0) {
            attendance.lateArrival = null;
          } else {
            attendance.lateArrival = diff;
          }
        } else {
          attendance.lateArrival = null;
        }
      }

      attendance.isPunchIn = true;
    }

    if (punchOutTime) {
      if (attendance.punchTime.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "You must punch in first." });
      }

      if (attendance.isBreakIn) {
        return res
          .status(400)
          .json({ success: false, message: "You must break out first." });
      }

      const lastPunch = attendance.punchTime[attendance.punchTime.length - 1];
      if (lastPunch.punchOutTime) {
        return res.status(400).json({
          success: false,
          message: "You have already punched out. Punch in first.",
        });
      }

      lastPunch.punchOutTime = Number(punchOutTime);
      attendance.isPunchIn = false;
    }

    if (breakInTime) {
      if (!attendance.isPunchIn) {
        return res.status(400).json({
          success: false,
          message: "You must be punched in to take a break.",
        });
      }

      const lastBreak =
        attendance.breakTime.length > 0
          ? attendance.breakTime[attendance.breakTime.length - 1]
          : null;

      if (lastBreak && !lastBreak.breakOutTime) {
        return res.status(400).json({
          success: false,
          message: "You must break out before another break in.",
        });
      }

      attendance.breakTime.push({
        breakInTime: Number(breakInTime),
        breakOutTime: "",
      });

      attendance.lastBreakInTime = Number(breakInTime);

      attendance.isBreakIn = true;
    }

    if (breakOutTime) {
      if (attendance.breakTime.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "You must break in first." });
      }

      const lastBreak = attendance.breakTime[attendance.breakTime.length - 1];
      if (lastBreak.breakOutTime) {
        return res.status(400).json({
          success: false,
          message: "You have already broken out. Break in first.",
        });
      }

      lastBreak.breakOutTime = Number(breakOutTime);
      attendance.isBreakIn = false;
    }

    let totalMilliseconds = 0;
    if (punchOutTime) {
      if (attendance.punchTime.length > 0) {
        attendance.punchTime.forEach((punch) => {
          const punchInTime = parseInt(punch.punchInTime);
          const punchOutTime = punch.punchOutTime
            ? parseInt(punch.punchOutTime)
            : moment().valueOf();

          totalMilliseconds += punchOutTime - punchInTime;
        });
      }
    } else {
      totalMilliseconds = attendance.totalHours;
    }

    let totalBreakMilliseconds = 0;
    if (breakOutTime) {
      attendance.breakTime.forEach((brk) => {
        const breakInTime = parseInt(brk.breakInTime);
        const breakOutTime = brk.breakOutTime
          ? parseInt(brk.breakOutTime)
          : moment().valueOf();
        totalBreakMilliseconds += breakOutTime - breakInTime;
      });
    } else {
      totalBreakMilliseconds = attendance.breakHours;
    }

    const workingMilliseconds =
      totalMilliseconds > totalBreakMilliseconds
        ? totalMilliseconds - totalBreakMilliseconds
        : null;

    attendance.workingHours = workingMilliseconds;
    attendance.breakHours = totalBreakMilliseconds;
    attendance.totalHours = totalMilliseconds;

    const overtimeMilliseconds =
      workingMilliseconds - totalOfficeHourMilli;
    if (overtimeMilliseconds > 0) {
      attendance.overtime = overtimeMilliseconds;
    } else {
      attendance.overtime = "";
    }

    if (taskTitle) {
      if (attendance.tasks.length > 0) {
        const lastTask = attendance.tasks[attendance.tasks.length - 1];
        if (!lastTask.endTime) {
          lastTask.endTime = moment().valueOf();
        }
      }

      attendance.tasks.push({
        userId: userId,
        title: taskTitle,
        description: taskDescription,
        startTime: moment().valueOf(),
      });
    }

    if (keyPressCount) {
      if (attendance.keyPressCount !== null) {
        attendance.keyPressCount =
          Number(attendance.keyPressCount) + Number(keyPressCount);
      } else {
        attendance.keyPressCount = Number(keyPressCount);
      }
    }

    if (mouseEventCount) {
      if (attendance.mouseEventCount !== null) {
        attendance.mouseEventCount =
          Number(attendance.mouseEventCount) + Number(mouseEventCount);
      } else {
        attendance.mouseEventCount = Number(mouseEventCount);
      }
    }

    if (screenshot) {
      const form = new FormData();
      const blob = new Blob([screenshot.buffer], { type: screenshot.mimetype });

      form.append("image", blob, `${Date.now()}_${screenshot.originalname}`);

      const response = await fetch(`${environment.apiBaseUrl}upload.php`, {
        method: "POST",
        body: form,
      });

      const result = await response.json();

      if (result.status === true) {
        attendance.screenshots.push({
          image: environment.apiBaseUrl + result.file_url,
          capturedTime: moment().valueOf(),
          keyPressCount: keyPressCount,
          mouseEventCount: mouseEventCount,
        });
      }
    }

    await attendance.save();

    const updatedAttendance = await AttendanceModel.findOne({
      userId,
      createdAt: { $gte: todayStart, $lte: todayEnd },
    });

    return res.status(200).json({
      success: true,
      message: "Attendance updated successfully",
      data: updatedAttendance,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getEmployeeDashboardData = async (req, res) => {
  try {
    const { userId } = req.params;
    const today = moment();
    const startOfDay = today.startOf("day").toDate();
    const endOfDay = today.endOf("day").toDate();

    const employee = await UserModel.findById(userId);
    if (!employee) {
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });
    }

    const todayAttendance = await AttendanceModel.findOne({
      userId,
      punchInAt: { $gte: startOfDay, $lte: endOfDay },
    });

    let todayWorkingHours = 0;
    if (
      todayAttendance &&
      todayAttendance.punchTime &&
      todayAttendance.punchTime.length > 0
    ) {
      todayAttendance.punchTime.forEach((punch) => {
        const punchInTime = parseInt(punch.punchInTime);
        const punchOutTime = punch.punchOutTime
          ? parseInt(punch.punchOutTime)
          : moment().valueOf();
        todayWorkingHours += punchOutTime - punchInTime;
      });
      todayWorkingHours -= todayAttendance.breakHours || 0;
    }

    const startOfWeek = today.startOf("week").toDate().valueOf();

    const weeklyAttendance = await AttendanceModel.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          punchInAt: { $gte: startOfWeek },
        },
      },
      {
        $group: {
          _id: "$userId",
          totalWorkingHours: { $sum: "$workingHours" },
        },
      },
    ]);

    const weeklyHours =
      weeklyAttendance.length > 0 ? weeklyAttendance[0].totalWorkingHours : 0;

    const startOfMonth = today.startOf("month").toDate().valueOf();
    const monthlyAttendance = await AttendanceModel.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          punchInAt: { $gte: startOfMonth },
        },
      },
      {
        $group: {
          _id: "$userId",
          totalWorkingHours: { $sum: "$workingHours" },
        },
      },
    ]);

    const monthlyHours =
      monthlyAttendance.length > 0 ? monthlyAttendance[0].totalWorkingHours : 0;

    const lateArrivalHours = await AttendanceModel.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          lateArrival: { $gt: 0 },
          punchInAt: { $gte: startOfMonth },
        },
      },
      {
        $group: {
          _id: "$userId",
          totalLateArrival: { $sum: "$lateArrival" },
        },
      },
    ]);

    const monthlyLateArrivalHours =
      lateArrivalHours.length > 0 ? lateArrivalHours[0].totalLateArrival : 0;

    const overtimeHours = await AttendanceModel.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          overtime: { $gt: 0 },
          punchInAt: { $gte: startOfMonth },
        },
      },
      {
        $group: {
          _id: "$userId",
          totalOvertime: { $sum: "$overtime" },
        },
      },
    ]);

    const monthlyOvertimeHours =
      overtimeHours.length > 0 ? overtimeHours[0].totalOvertime : 0;

    const absentDays = await AttendanceModel.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          punchInAt: { $gte: startOfMonth },
        },
      },
      {
        $project: {
          punchInAt: { $toDate: "$punchInAt" },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$punchInAt" } },
          attendanceCount: { $sum: 1 },
        },
      },
    ]);

    const allDaysInMonth = moment(startOfMonth).daysInMonth();
    const attendedDays = absentDays.length;
    const monthlyAbsentCount = allDaysInMonth - attendedDays;

    // console.log("todayWorkingHours-->", todayWorkingHours);
    // console.log("weeklyHours-->", weeklyHours);
    // console.log("monthlyHours-->", monthlyHours);
    // console.log("monthlyLateArrivalHours-->", monthlyLateArrivalHours);
    // console.log("monthlyOvertimeHours-->", monthlyOvertimeHours);
    // console.log("monthlyAbsentCount-->", monthlyAbsentCount);

    return res.status(200).json({
      success: true,
      data: {
        todayWorkingHours,
        weeklyHours,
        monthlyHours,
        monthlyLateArrivalHours,
        monthlyOvertimeHours,
        monthlyAbsentCount,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

const getAdminDashboardData = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    const totalEmployees = await UserModel.countDocuments({
      isActive: true,
      approvalStatus: "Approved",
    });

    const totalTodayPresent = await AttendanceModel.countDocuments({
      status: "Present",
      punchInAt: { $gte: startOfDay, $lte: endOfDay },
    });

    // 3. Total today absent count
    // const totalTodayAbsent = await AttendanceModel.countDocuments({
    //   status: "Absent",
    //   punchInAt: { $gte: startOfDay, $lte: endOfDay },
    // });

    const totalTodayAbsent = totalEmployees - totalTodayPresent;

    const totalTodayLateArrival = await AttendanceModel.countDocuments({
      lateArrival: { $gt: 0 },
      punchInAt: { $gte: startOfDay, $lte: endOfDay },
    });

    return res.status(200).json({
      success: true,
      data: {
        totalEmployees,
        totalTodayPresent,
        totalTodayAbsent,
        totalTodayLateArrival,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

const calculateAttendanceStats = async (attendance) => {
  const currentTime = Date.now();
  const todayStart = new Date().setHours(0, 0, 0, 0);

  const settings = await AppSettingModel.findOne();

  const attendanceDate = new Date(attendance.punchInAt);
  const officeHoursStart = dayjs(`${attendanceDate.toISOString().split('T')[0]} ${settings.officeStartTime}`, "YYYY-MM-DD h:mm a").valueOf();
  const officeHoursEnd = dayjs(`${attendanceDate.toISOString().split('T')[0]} ${settings.officeEndTime}`, "YYYY-MM-DD h:mm a").valueOf();
  const breakDuration = settings.breakDuration * 60 * 1000;
  const totalOfficeHourMilli = officeHoursEnd - officeHoursStart;

  if (attendance.punchInAt < todayStart) {
    attendance.isUnderVerification = true;
    attendance.isPunchIn = false;

    if (attendance.punchTime.length > 0) {
      const lastPunch = attendance.punchTime[attendance.punchTime.length - 1];
      lastPunch.punchOutTime = officeHoursEnd;
    }
  }

  if (attendance.isBreakIn) {
    if (attendance.breakTime.length > 0) {
      const lastBreak = attendance.breakTime[attendance.breakTime.length - 1];
      lastBreak.breakOutTime = officeHoursEnd;
    }
  }

  const updatedAttendance = await AttendanceModel.findByIdAndUpdate(attendance._id, attendance, { new: true });

  let totalHours = updatedAttendance.punchTime.reduce((sum, p) => {
    const punchInTime = p.punchInTime;
    let punchOutTime = p.punchOutTime;

    if (punchInTime >= todayStart && !punchOutTime) {
      punchOutTime = currentTime;
    }

    return sum + (punchOutTime - punchInTime);
  }, 0);

  let breakHours = updatedAttendance.breakTime.reduce((sum, b) => {
    return sum + ((b.breakOutTime ? b.breakOutTime : currentTime) - b.breakInTime);
  }, 0);

  let workingHours = totalHours - breakHours;

  let overtime = totalHours > totalOfficeHourMilli ? totalHours - totalOfficeHourMilli : 0;

  let lateArrival = updatedAttendance.punchInAt > officeHoursStart ? updatedAttendance.punchInAt - officeHoursStart : 0;

  let earlyArrival = updatedAttendance.punchInAt < officeHoursStart ? officeHoursStart - updatedAttendance.punchInAt : 0;

  return { totalHours, workingHours, breakHours, overtime, lateArrival, earlyArrival };
};

const getTodayAttendance = async (req, res) => {
  const { userId } = req.params;
  const { date } = req.query;

  try {
    const todayStart = new Date(moment().startOf("day").toISOString()).getTime();
    const todayEnd = new Date(moment().endOf("day").toISOString()).getTime();
    let attendance;

    if (userId) {
      const user = await UserModel.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      attendance = await AttendanceModel.findOne({
        userId,
        createdAt: { $gte: todayStart, $lte: todayEnd },
      });

      if (!attendance) {
        attendance = new AttendanceModel({ userId });
      } else {
        if (attendance.punchInAt < todayStart || attendance.punchInAt > todayEnd) {
          await AttendanceModel.findByIdAndDelete(attendance._id);
          attendance = new AttendanceModel({ userId });
        }
      }

      const stats = await calculateAttendanceStats(attendance);
      attendance = { ...attendance.toObject(), ...stats };

      // await attendance.save();
    } else {
      if (date) {
        const selectedDate = new Date(date);
        const selectedStart = new Date(moment(selectedDate).startOf("day").toISOString()).getTime();
        const selectedEnd = new Date(moment(selectedDate).endOf("day").toISOString()).getTime();

        attendance = await AttendanceModel.find({
          createdAt: { $gte: selectedStart, $lte: selectedEnd },
        });

        attendance = await Promise.all(
          attendance.map(async (att) => {
            const user = await UserModel.findById(att.userId);
            const stats = await calculateAttendanceStats(att);

            return { ...att.toObject(), userData: user || {}, ...stats };
          })
        );
      } else {
        attendance = await AttendanceModel.find({
          createdAt: { $gte: todayStart, $lte: todayEnd },
        });

        attendance = await Promise.all(
          attendance.map(async (att) => {
            const user = await UserModel.findById(att.userId);
            const stats = await calculateAttendanceStats(att);

            return { ...att.toObject(), userData: user || {}, ...stats };
          })
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: "Attendance fetched successfully",
      data: attendance,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getUserWiseAttendanceData = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.punchInAt = {};
      if (startDate) dateFilter.punchInAt.$gte = new Date(startDate).getTime();
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        dateFilter.punchInAt.$lte = endDateTime.getTime();
      }
    }

    let attendanceData = await AttendanceModel.find({ userId, ...dateFilter })
      .sort({ punchInAt: -1 })
      .lean();

    attendanceData = await Promise.all(
      attendanceData.map(async (att) => {
        const stats = await calculateAttendanceStats(att);
        return { ...att, ...stats };
      })
    );

    return res.status(200).json({
      success: true,
      message: "Attendance data fetched successfully",
      data: attendanceData,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server Error" });
  }
};

const deleteScreenshot = async (req, res) => {
  try {
    const { id, ssid } = req.query;

    if (!id || !ssid) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required parameters" });
    }

    const attendance = await AttendanceModel.findById(id);
    if (!attendance) {
      return res
        .status(404)
        .json({ success: false, message: "Attendance record not found" });
    }

    const screenshot = attendance.screenshots.find(
      (ss) => ss._id.toString() === ssid
    );
    if (!screenshot) {
      return res
        .status(404)
        .json({ success: false, message: "Screenshot not found" });
    }

    const imageUrl = screenshot.image;
    if (!imageUrl) {
      return res
        .status(400)
        .json({ success: false, message: "Image URL not found in record" });
    }

    const fileName = imageUrl.split("/").pop().split("?")[0];

    try {
      const form = new FormData();
      form.append("filename", fileName);

      const response = await fetch(`${environment.apiBaseUrl}delete.php`, {
        method: "POST",
        body: form,
      });

      const result = await response.json();

      if (result.status === false) {
        return res.status(500).json({
          success: false,
          message: "Failed to delete image from storage",
        });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to delete image from storage",
      });
    }

    attendance.screenshots = attendance.screenshots.filter(
      (ss) => ss._id.toString() !== ssid
    );
    await attendance.save();

    res.json({ success: true, message: "Screenshot deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const addTask = async (req, res) => {
  try {
    const { taskTitle, taskDescription, taskStatus, taskPriority, taskCategory, taskAssignee, taskLabels, taskStartDate, taskEndDate, taskEstimatedTime, taskAttachments, taskAddedBy } = req.body;

    if (!taskTitle || !taskStatus || !taskAddedBy) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields (taskTitle, taskStatus, taskAssignee, taskAddedBy)",
      });
    }

    const newTask = new TasksModel({
      taskId: generateTaskId(),
      taskTitle,
      taskDescription,
      taskStatus,
      taskPriority,
      taskCategory,
      taskAssignee: taskAssignee.map(user => ({ userId: user._id })),
      taskLabels,
      taskStartDate,
      taskEndDate,
      taskEstimatedTime,
      taskAttachments,
      taskAddedBy,
    });

    await newTask.save();

    const tasks = await TasksModel.find();

    return res.status(201).json({
      success: true,
      message: "Task Added Successfully",
      data: tasks,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const updateTask = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if required fields are provided for new task or update
    // if (!req.body.taskTitle || !req.body.taskStatus || !req.body.taskAddedBy) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Please provide all required fields (taskTitle, taskStatus, taskAddedBy)",
    //   });
    // }

    // Check if task exists (if there's an id, it's an update)
    if (id) {
      // It's an update operation
      const updateData = req.body;

      if (updateData.taskAssignee) {
        try {
          updateData.taskAssignee = JSON.parse(updateData.taskAssignee);
        } catch (error) {
          return res.status(400).json({
            success: false,
            message: "Invalid JSON format in taskAssignee",
          });
        }
      }

      if (updateData.taskAttachments && typeof updateData.taskAttachments === 'string') {
        try {
          updateData.taskAttachments = JSON.parse(updateData.taskAttachments);
        } catch (error) {
          return res.status(400).json({
            success: false,
            message: "Invalid JSON format in taskAttachments",
          });
        }
      }

      const existingTask = await TasksModel.findById(id);
      if (!existingTask) {
        return res.status(404).json({
          success: false,
          message: "Task not found",
        });
      }

      const fieldsToCheck = [
        "taskTitle",
        "taskDescription",
        "taskStatus",
        "taskStartDate",
        "taskEndDate",
        "taskCategory",
        "taskPriority",
        "taskLabels",
        "taskEstimatedTime",
      ];

      let historyChanges = fieldsToCheck
        .filter((field) => updateData[field] && updateData[field] !== existingTask[field])
        .map((field) => ({
          fieldName: field,
          oldValue: existingTask[field],
          newValue: updateData[field],
          changedBy: updateData.userId,
          changeTime: new Date(),
        }));

      if (updateData.taskAssignee && !arraysEqual(existingTask.taskAssignee, updateData.taskAssignee)) {
        historyChanges.push({
          fieldName: "taskAssignee",
          oldValue: existingTask.taskAssignee,
          newValue: updateData.taskAssignee,
          changedBy: req.body.userId,
          changeTime: new Date(),
        });
      }

      if (updateData.taskStatus === 'completed' && existingTask.taskStatus !== 'completed') {
        updateData.taskClosedTime = [...existingTask.taskClosedTime, { closedAt: new Date() }];
      }

      if (historyChanges.length > 0) {
        updateData.taskHistory = [...existingTask.taskHistory, ...historyChanges];
      }

      // Handle file uploads if there are any
      // let uploadedAttachments = [];

      // if (req.files && req.files.length > 0) {
      //   console.log("existingTask.taskAttachments--->", existingTask.taskAttachments);

      //   for (const file of req.files) {
      //     const form = new FormData();
      //     const blob = new Blob([file.buffer], { type: file.mimetype });
      //     const filename = `${Date.now()}_${file.originalname}`;

      //     form.append("image", blob, filename);

      //     const response = await fetch(`${environment.apiBaseUrl}upload.php`, {
      //       method: "POST",
      //       body: form,
      //     });

      //     const result = await response.json();

      //     if (result.status === true) {
      //       uploadedAttachments.push({
      //         attachmentType: file.mimetype,
      //         url: `${environment.apiBaseUrl}${result.file_url}`,
      //       });
      //     }
      //   }

      //   updateData.taskAttachments = [
      //     ...(existingTask.taskAttachments || []),
      //     ...uploadedAttachments,
      //   ];
      // }

      const updatedTask = await TasksModel.findByIdAndUpdate(id, updateData, { new: true });

      const tasks = await TasksModel.find();

      return res.status(200).json({
        success: true,
        message: "Task updated successfully",
        data: tasks,
      });
    } else {
      const {
        taskTitle,
        taskDescription,
        taskStatus,
        taskPriority,
        taskCategory,
        taskAssignee,
        taskLabels,
        taskStartDate,
        taskEndDate,
        taskEstimatedTime,
        taskAttachments,
        taskAddedBy
      } = req.body;
      const newTask = new TasksModel({
        taskId: generateTaskId(),
        taskTitle: taskTitle || '',
        taskDescription: taskDescription || '',
        taskStatus: taskStatus || 'To Do',
        taskPriority: taskPriority || 'Normal',
        taskCategory: taskCategory || 'General',
        taskAssignee: Array.isArray(taskAssignee)
          ? taskAssignee.map(user => ({ userId: user._id }))
          : taskAddedBy
            ? [{ userId: taskAddedBy }]
            : [],
        taskLabels: taskLabels || '',
        taskStartDate: taskStartDate || null,
        taskEndDate: taskEndDate || null,
        taskEstimatedTime: taskEstimatedTime || '',
        taskAttachments: Array.isArray(taskAttachments) ? taskAttachments : [],
        taskAddedBy: taskAddedBy || null,
      });

      await newTask.save();

      const tasks = await TasksModel.find();

      return res.status(201).json({
        success: true,
        message: "Task Added Successfully",
        data: tasks,
      });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const uploadFiles = async (req, res) => {
  try {
    let uploadedAttachments = [];

    console.log("sdrfte", req.files);


    if (req.files && req.files.length > 0) {

      for (const file of req.files) {
        const form = new FormData();
        const blob = new Blob([file.buffer], { type: file.mimetype });
        const filename = `${Date.now()}_${file.originalname}`;

        form.append("image", blob, filename);

        const response = await fetch(`${environment.apiBaseUrl}upload.php`, {
          method: "POST",
          body: form,
        });

        const result = await response.json();

        if (result.status === true) {
          uploadedAttachments.push({
            attachmentType: file.mimetype,
            url: `${environment.apiBaseUrl}${result.file_url}`,
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Image upload successfully",
      data: uploadedAttachments,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const generateTaskId = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let taskId = '';
  for (let i = 0; i < 8; i++) {
    taskId += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return taskId;
};

const arraysEqual = (arr1, arr2) => {
  if (arr1.length !== arr2.length) return false;
  return arr1.every((item, index) => {
    return JSON.stringify(item) === JSON.stringify(arr2[index]);
  });
};

const getAllTasks = async (req, res) => {
  try {
    const tasks = await TasksModel.find();

    return res.status(200).json({
      success: true,
      message: "Tasks fetched Successfully",
      data: tasks,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

module.exports = {
  addUsers,
  getAllUsers,
  getUsersList,
  deleteUser,
  getUserByEmail,
  getUserById,
  getUserByName,
  addAttendance,
  getEmployeeDashboardData,
  getAdminDashboardData,
  getTodayAttendance,
  getUserWiseAttendanceData,
  deleteScreenshot,
  addTask,
  updateTask,
  getAllTasks,
  uploadFiles,
};
