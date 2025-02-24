const { UserModel, AttendanceModel } = require("../Models/User");
const jwt = require("jsonwebtoken");
const moment = require("moment");
const {
  handleError,
  setDefaultUserData,
  findEmailAddress,
  findMobileNumber,
  hashPassword,
} = require("../utils/utils");
const screenshot = require("screenshot-desktop");
const path = require("path");
const fs = require("fs");

const addUsers = async (req, res) => {
  try {
    const { emailAddress, mobileNumber } = req.body;

    const userData = setDefaultUserData(req.body);

    const emailExist = await findEmailAddress(emailAddress);
    if (emailExist) {
      return handleError(res, "Email Address Already Registerd", 400);
    }
    const mobileExist = await findMobileNumber(mobileNumber);
    if (mobileExist) {
      return handleError(res, "Mobile Number Already Registerd", 400);
    }

    const verificationToken = jwt.sign(
      { emailAddress },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    userData.userPermission = JSON.parse(userPermission);

    await UserModel.create({
      ...userData,
      profilePhoto: req.file ? req.file.path : "",
      password: await hashPassword(userData.password),
      verificationToken,
    });

    // await sendVerificationEmail(emailAddress, verificationToken);

    return res
      .status(201)
      .json({ success: true, message: "User Added Successfully" });
  } catch (err) {
    console.log(err);
    return handleError(res, "Internal Server Error");
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
    return handleError(res, "Internal Server Error");
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
    return handleError(res, "Internal Server Error");
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
    return handleError(res, "Internal Server Error");
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
    return handleError(res, "Internal Server Error");
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
    return handleError(res, "Internal Server Error");
  }
};

const OFFICE_START_TIME = moment()
  .set({ hour: 9, minute: 30, second: 0, millisecond: 0 })
  .valueOf();
const OFFICE_HOURS_MILLISECONDS = 8 * 60 * 60 * 1000;

const addAttendance = async (req, res) => {
  const { userId, punchInTime, punchOutTime, breakInTime, breakOutTime, taskTitle, taskDescription } =
    req.body;

  const screenshot = req.file;

  try {
    const user = await UserModel.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const todayStart = moment().startOf("day").toDate();
    const todayEnd = moment().endOf("day").toDate();

    let attendance = await AttendanceModel.findOne({
      userId,
      createdAt: { $gte: todayStart, $lte: todayEnd },
    });

    if (!attendance) {
      attendance = new AttendanceModel({
        userId,
      });
    }

    const convertToTimeFormat = (milliseconds) => {
      const hours = Math.floor(milliseconds / (1000 * 60 * 60));
      const minutes = Math.floor(
        (milliseconds % (1000 * 60 * 60)) / (1000 * 60)
      );
      const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
      // return `${hours}h ${minutes}m ${seconds}s`;
      return milliseconds;
    };

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
        punchOutTime: "",
      });

      attendance.lastPunchInTime = punchInTimestamp;

      if (!attendance.punchInAt) {
        attendance.punchInAt = punchInTimestamp;
      }

      if (attendance.punchTime.length === 1) {
        const officeStartTime = moment(OFFICE_START_TIME, "hh:mm A").valueOf();
        if (punchInTimestamp > officeStartTime) {
          const diff = punchInTimestamp - officeStartTime;
          attendance.lateArrival = convertToTimeFormat(diff);
        } else {
          attendance.lateArrival = "";
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
    if (punchInTime) {
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
    if (breakInTime) {
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

    const workingMilliseconds = totalMilliseconds - totalBreakMilliseconds;

    attendance.workingHours = convertToTimeFormat(workingMilliseconds);
    attendance.breakHours = convertToTimeFormat(totalBreakMilliseconds);
    attendance.totalHours = convertToTimeFormat(totalMilliseconds);

    const overtimeMilliseconds =
      workingMilliseconds - OFFICE_HOURS_MILLISECONDS;
    if (overtimeMilliseconds > 0) {
      attendance.overtime = convertToTimeFormat(overtimeMilliseconds);
    } else {
      attendance.overtime = "";
    }

    //  screenshot().then((img) => {
    //     console.log("image-->", img);
    //     const uploadFolder = path.join(__dirname, '../../uploads/screenshots');

    //     if (!fs.existsSync(uploadFolder)) {
    //       fs.mkdirSync(uploadFolder);
    //     }

    //     const filename = `${Date.now()}.jpg`;
    //     const filePath = path.join(uploadFolder, filename);

    //     fs.writeFile(filePath, img, (err) => {
    //       if (err) {
    //         console.error('Error saving the image:', err);
    //       } else {
    //         if (screenshot) {
    //           attendance.screenshots.push({
    //             image: filePath,
    //             capturedTime: moment().valueOf(),
    //           });
    //         }
    //       }
    //     });
    //   }).catch((err) => {
    //     console.log("err-->", err);
    //   })

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

    if (screenshot) {
      attendance.screenshots.push({
        image: screenshot.path,
        capturedTime: moment().valueOf(),
      });
    }

    await attendance.save();

    const updatedAttendance = await AttendanceModel.findOne({
      userId,
      createdAt: { $gte: todayStart, $lte: todayEnd },
    });

    // localStorage.setItem("isPunchIn", updatedAttendance.isPunchIn);

    return res.status(200).json({
      success: true,
      message: "Attendance updated successfully",
      data: updatedAttendance,
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

const getEmployeeDashboardData = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await UserModel.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const today = moment().startOf("day");
    const startOfWeek = moment().startOf("week");
    const startOfMonth = moment().startOf("month");
    const endOfToday = moment().endOf("day");
    const endOfWeek = moment().endOf("week");
    const endOfMonth = moment().endOf("month");
    const officeStartTime = moment("09:30", "HH:mm").valueOf();
    const breakTimeInMillis = 45 * 60 * 1000; // 45 minutes in milliseconds
    const totalWorkHoursInMillis = 9 * 60 * 60 * 1000; // 9 hours in milliseconds

    // Attendance data
    const attendanceData = await AttendanceModel.aggregate([
      { $match: { userId: userId } },
      { $unwind: "$punchTime" },
      {
        $project: {
          punchInTime: "$punchTime.punchInTime",
          punchOutTime: "$punchTime.punchOutTime",
          date: { $toDate: "$createdAt" },
          totalHours: 1,
        },
      },
      {
        $group: {
          _id: "$date",
          totalHours: {
            $sum: { $subtract: ["$punchOutTime", "$punchInTime"] },
          },
        },
      },
    ]);

    // Function to sum hours for a period, accounting for breaks
    const sumHoursForPeriod = (data, start, end) => {
      return (
        data.reduce((sum, item) => {
          const date = moment(item._id);
          if (date.isBetween(start, end, null, "[]")) {
            // Subtract break time if within office hours
            return sum + Math.max(0, item.totalHours - breakTimeInMillis);
          }
          return sum;
        }, 0) /
        (1000 * 60 * 60)
      );
    };

    const todayHours = sumHoursForPeriod(attendanceData, today, endOfToday);
    const thisWeekHours = sumHoursForPeriod(
      attendanceData,
      startOfWeek,
      endOfWeek
    );
    const thisMonthHours = sumHoursForPeriod(
      attendanceData,
      startOfMonth,
      endOfMonth
    );
    const prevWeekHours = sumHoursForPeriod(
      attendanceData,
      startOfWeek.clone().subtract(1, "week"),
      endOfWeek.clone().subtract(1, "week")
    );
    const prevMonthHours = sumHoursForPeriod(
      attendanceData,
      startOfMonth.clone().subtract(1, "month"),
      endOfMonth.clone().subtract(1, "month")
    );

    // const leaves = await LeaveModel.find({ userId: userId, status: 'Approved' });
    // const thisMonthLeaves = leaves.filter(leave =>
    //   moment(leave.startDate).isBetween(startOfMonth, endOfMonth, null, '[]') ||
    //   moment(leave.endDate).isBetween(startOfMonth, endOfMonth, null, '[]')
    // );
    // const totalLeavesTaken = thisMonthLeaves.reduce((sum, leave) => sum + leave.days, 0);

    // const remainingLeaves = (user.leaveEntitlement || 0) - totalLeavesTaken;

    res.status(200).json({
      success: true,
      data: {
        todayHours,
        thisWeekHours,
        thisMonthHours,
        prevWeekHours,
        prevMonthHours,
        // thisMonthLeavesTaken: totalLeavesTaken,
        // remainingLeaves
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};

const getTodayAttendance = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await UserModel.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const todayStart = moment().startOf("day").toDate();
    const todayEnd = moment().endOf("day").toDate();

    let attendance = await AttendanceModel.findOne({
      userId,
      createdAt: { $gte: todayStart, $lte: todayEnd },
    });

    if (!attendance) {
      attendance = new AttendanceModel({
        userId,
        status: "Absent",
      });
      await attendance.save();
    }

    return res.status(200).json({
      success: true,
      message: "Attendance fetched successfully",
      data: attendance,
    });
  } catch (err) {
    console.log(err);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = {
  addUsers,
  getAllUsers,
  deleteUser,
  getUserByEmail,
  getUserById,
  getUserByName,
  addAttendance,
  getEmployeeDashboardData,
  getTodayAttendance,
};
