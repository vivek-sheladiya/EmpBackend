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
const { default: mongoose } = require("mongoose");
const { bucket } = require("../../firebaseConfig");

const addUsers = async (req, res) => {
  try {
    const { emailAddress, mobileNumber } = req.body;

    const userData = setDefaultUserData(req.body);

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
      const localFilePath = req.file.path;
      const file = bucket.file(
        `profilePhoto/${Date.now()}_${req.file.originalname}`
      );
      const stream = fs.createReadStream(localFilePath).pipe(
        file.createWriteStream({
          metadata: {
            contentType: req.file.mimetype,
          },
        })
      );

      stream.on("finish", async () => {
        await file.makePublic();
      });

      fileUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;
    }
    if (userData && userData.technology) {
      userData.technology = userData.technology.split(",");
    }
    await UserModel.create({
      ...userData,
      profilePhoto: fileUrl,
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
const OFFICE_HOURS_MILLISECONDS = 8 * 60 * 60 * 1000;

const addAttendance = async (req, res) => {
  const {
    userId,
    punchInTime,
    punchOutTime,
    breakInTime,
    breakOutTime,
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
        attendance.status = "Present";
      }

      if (attendance.punchTime.length === 1) {
        if (punchInTimestamp > OFFICE_START_TIME) {
          const diff = punchInTimestamp - OFFICE_START_TIME;
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

    if (keyPressCount) {
      if (attendance.keyPressCount !== null) {
        attendance.keyPressCount = Number(attendance.keyPressCount) + Number(keyPressCount);
      } else {
        attendance.keyPressCount = Number(keyPressCount);
      }
    }

    if (mouseEventCount) {
      if (attendance.mouseEventCount !== null) {
        attendance.mouseEventCount = Number(attendance.mouseEventCount) + Number(mouseEventCount);
      } else {
        attendance.mouseEventCount = Number(mouseEventCount);
      }
    }

    if (screenshot) {
      const localFilePath = screenshot.path;
      
      const file = bucket.file(
        `screenshots/${Date.now()}_${screenshot.originalname}`
      );
      const stream = fs.createReadStream(localFilePath).pipe(
        file.createWriteStream({
          metadata: {
            contentType: screenshot.mimetype,
          },
        })
      );

      stream.on("finish", async () => {
        await file.makePublic();
        fs.unlink(localFilePath, (err) => {
          // if (err) {
          //   console.error("Error deleting file:", err);
          // } else {
          //   console.log("File deleted successfully!");
          // }
        });
      });

      // stream.on("error", (err) => {
      //   console.error("Upload Error:", err);
      // });

      const fileUrl = `https://storage.googleapis.com/${bucket.name}/${file.name}`;

      attendance.screenshots.push({
        image: fileUrl,
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
    return res.status(500).json({ success: false, message: err.message });
  }
};

const getUserWiseAttendanceData = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    if (!userId) {
      return res
        .status(400)
        .json({ success: false, message: "User ID is required" });
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
    const attendanceData = await AttendanceModel.find({
      userId,
      ...dateFilter,
    })
      .sort({ punchInAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
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

    // Validate input
    if (!id || !ssid) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required parameters" });
    }

    // 🔥 Step 1: Find Attendance Record
    const attendance = await AttendanceModel.findById(id);
    if (!attendance) {
      return res
        .status(404)
        .json({ success: false, message: "Attendance record not found" });
    }

    // 🔥 Step 2: Find Screenshot in Attendance Record
    const screenshot = attendance.screenshots.find(
      (ss) => ss._id.toString() === ssid
    );
    if (!screenshot) {
      return res
        .status(404)
        .json({ success: false, message: "Screenshot not found" });
    }

    // 🔥 Step 3: Extract Image URL from Screenshot
    const imageUrl = screenshot.image;
    if (!imageUrl) {
      return res
        .status(400)
        .json({ success: false, message: "Image URL not found in record" });
    }

    // 🔥 Step 4: Extract File Path from Image URL
    const filePath = imageUrl.split(`${bucket.name}/`)[1];
    if (!filePath) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid image URL" });
    }

    // 🔥 Step 5: Delete Image from Firebase Storage
    try {
      await bucket.file(filePath).delete();
      console.log("🔥 Image deleted from Firebase Storage:", filePath);
    } catch (error) {
      console.error(
        "❌ Error deleting image from Firebase Storage:",
        error.message
      );
      return res.status(500).json({
        success: false,
        message: "Failed to delete image from storage",
      });
    }

    // 🔥 Step 6: Remove Screenshot from MongoDB Record
    attendance.screenshots = attendance.screenshots.filter(
      (ss) => ss._id.toString() !== ssid
    );
    await attendance.save();

    console.log("✅ Screenshot deleted from MongoDB");

    res.json({ success: true, message: "Screenshot deleted successfully" });
  } catch (error) {
    console.error("❌ Error:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
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
  getAdminDashboardData,
  getTodayAttendance,
  getUserWiseAttendanceData,
  deleteScreenshot,
};
