const { UserModel } = require("../Models/UserModel");
const { AttendanceModel } = require("../Models/AttendanceModel");
const moment = require("moment");
const { default: mongoose } = require("mongoose");
const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");
dayjs.extend(customParseFormat);

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
            role: 'Employee'
        });
        const totalAdmins = await UserModel.countDocuments({
            isActive: true,
            approvalStatus: "Approved",
            role: 'Admin'
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
                totalAdmins,
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

module.exports = {
    getEmployeeDashboardData,
    getAdminDashboardData,
};
