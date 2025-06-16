const {handleError, UserRole, ApprovalStatus} = require("../utils/utils");
const {UserModel} = require("../Models/UserModel");
const {ClientModel} = require("../Models/ClientModel");
const {ProjectModel} = require("../Models/ProjectModel");
const moment = require("moment/moment");
const {AttendanceModel} = require("../Models/AttendanceModel");
const {HolidayEventModel} = require("../Models/HolidayEventModel");
const {LeaveModel} = require("../Models/LeaveModel");
const {basicSalaryModel} = require("../Models/basicSalaryModel");
const mongoose = require("mongoose");
const {calculateAttendanceStats} = require("./AttendanceController");
const {AppSettingModel} = require("../Models/AppSettingModel");
const {TasksModel} = require("../Models/TaskModel");
const {generateGroupWiseTaskList} = require("./TaskController");
const axios = require("axios");

const postToken = async (req, res) => {
    const {fcmToken, onesignalPlayerId} = req.body;

    const loginUser = req.user;

    if(fcmToken) {
        await UserModel.updateOne({ _id: loginUser._id }, { fcmToken });
    }

    if(onesignalPlayerId && loginUser.onesignalPlayerId !== onesignalPlayerId) {
        await UserModel.findByIdAndUpdate(loginUser._id, {onesignalPlayerId: onesignalPlayerId}, undefined)
    }

    return res.status(200).json({
        success: true,
        message: "Data Update Successfully",
    });
}

const getMasterData = async (req, res) => {
    try {
        const todayStart = new Date(moment().startOf("day").toISOString()).getTime();
        const todayEnd = new Date(moment().endOf("day").toISOString()).getTime();

        const loginUser = req.user;

        let isAdmin = false;
        if(loginUser && loginUser.role === UserRole.Admin) {
            isAdmin = true;
        }

        let dataObj;

        let projectsData;

        if(isAdmin) {
            projectsData = await ProjectModel.find(undefined, undefined, undefined);
        } else {
            projectsData = await ProjectModel.find({}, {
                _id: 1,
                projectName: 1,
                clientName: 1,
                addedBy: 1
            }, undefined);
        }

        const clientsFullRecord = await ClientModel.find(undefined, undefined, undefined);

        const projectMap = new Map();

        projectsData.forEach((project) => {
            const clientId = project.clientName?.toString();
            if (!projectMap.has(clientId)) projectMap.set(clientId, []);
            projectMap.get(clientId).push(project);
        });

        let clientsData = clientsFullRecord.map((client) => {
            const clientId = client._id.toString();
            return {
                ...client.toObject(),
                projects: projectMap.get(clientId) || [],
            };
        });

        let activeClientData = [...clientsData];
        let activeProjectData = [...projectsData];

        if(!isAdmin) {
            clientsData = clientsData.filter(client => client.addedBy.toString() === loginUser._id.toString());
        }

        if(!isAdmin) {
            projectsData = projectsData.filter(project => project.addedBy.toString() === loginUser._id.toString());
        }

        const eventsData = await HolidayEventModel.find(undefined, undefined, undefined);
        const holidayData = eventsData.filter(event => event.isLeaveOnDay === true);

        const taskBoardData = await generateGroupWiseTaskList(loginUser);

        if(isAdmin) {
            const usersData = await UserModel.find(undefined, undefined, undefined);
            const activeUsersData = usersData.filter(user => user.approvalStatus === ApprovalStatus.Approved && user.isActive);
            const adminUsers = usersData.filter(user => user.role === UserRole.Admin);
            const employeeUsers = usersData.filter(user => user.role === UserRole.Employee);

            const leavesData = await LeaveModel.find(undefined, undefined, undefined);

            const basicSalaryData = await basicSalaryModel.find(undefined, undefined, undefined).populate('user', 'fullName');

            let settings = await AppSettingModel.findOne();
            if (!settings) {
                settings = await AppSettingModel.create({});
            }

            let attendancesData = await AttendanceModel.find({
                createdAt: {$gte: todayStart, $lte: todayEnd},
            }, undefined, undefined);

            attendancesData = await Promise.all(
                attendancesData.map(async (att) => {
                    const user = await UserModel.findById(att.userId, undefined, undefined);
                    const stats = await calculateAttendanceStats(att);
                    return {...att.toObject(), userData: user || {}, ...stats};
                })
            );

            dataObj = {
                dashboardData: {
                    employeeUsers: employeeUsers.length,
                    adminUsers: adminUsers.length,
                    activeUsers: activeUsersData.length,
                    todayPresent: attendancesData.length,
                    todayAbsent: employeeUsers.length - attendancesData.length,
                    noOfClients: clientsData.length,
                    noOfProjects: projectsData.length,
                },
                loginUserData: req.user,
                usersData,
                activeUsersData,
                clientsData,
                activeClientData,
                projectsData,
                activeProjectData,
                leavesData,
                basicSalaryData,
                eventsData,
                holidayData,
                taskBoardData,
                attendancesData,
                settings,
            }

        } else {
            const usersData = await UserModel.find({}, {
                _id: 1,
                fullName: 1,
                mobileNumber: 1,
                emailAddress: 1,
                role: 1,
                profilePhoto: 1,
                approvalStatus: 1,
                isActive: 1,
                status: 1,
            }, undefined);
            const activeUsersData = usersData.filter(user => user.approvalStatus === ApprovalStatus.Approved && user.isActive);

            const leavesData = await LeaveModel.find({
                user: loginUser._id,
            }, undefined, undefined);

            const attendancesData = await AttendanceModel.find({
                userId: loginUser._id,
            }, undefined, undefined);

            const stats = await getUserAttendanceStats(loginUser._id);

            dataObj = {
                dashboardData: {
                    todayWorkingHours: stats.todayWorkingHours,
                    weeklyHours: stats.weeklyHours,
                    monthlyHours: stats.monthlyHours,
                    monthlyLateArrivalHours: stats.monthlyLateArrivalHours,
                    monthlyOvertimeHours: stats.monthlyOvertimeHours,
                    monthlyAbsentCount: stats.monthlyAbsentCount > 0 ? stats.monthlyAbsentCount : 0,
                },
                loginUserData: req.user,
                usersData,
                activeUsersData,
                clientsData,
                activeClientData,
                projectsData,
                activeProjectData,
                leavesData,
                eventsData,
                holidayData,
                taskBoardData,
                attendancesData,
            };
        }

        return res.status(201).json({
            success: true,
            message: "Data Fetched Successfully",
            data: dataObj
        });
    } catch (err) {
        console.error(err);
        return handleError(res, err.message);
    }
};

const getUserAttendanceStats = async (userId) => {
    const moment = require("moment");
    const mongoose = require("mongoose");

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

    // const startOfMonth = today.startOf("month").toDate().valueOf();
    const startOfMonth = moment(today).startOf("month").toDate().valueOf();
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

    const monthlyOvertimeHours = overtimeHours.length > 0 ? overtimeHours[0].totalOvertime : 0;

    const startOfMonthTimestamp = new Date(startOfMonth).getTime();
    const endOfMonthTimestamp = new Date(endOfDay).getTime();

    const attendanceDays = await AttendanceModel.aggregate([
        {
            $match: {
                userId: new mongoose.Types.ObjectId(userId),
                punchInAt: { $gte: startOfMonthTimestamp, $lte: endOfMonthTimestamp }
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: { $toDate: "$punchInAt" } } }
            }
        }
    ]);

    const attendedDays = attendanceDays.length;

    const holidays = await HolidayEventModel.find({
        eventDate: {
            $gte: moment(startOfMonth).format("YYYY-MM-DD"),
            $lte: moment(endOfDay).format("YYYY-MM-DD"),
        },
        isLeaveOnDay: true,
    }).select("eventDate");

    const holidayDates = holidays.map((h) => h.eventDate);
    const totalDaysTillToday = today.date();
    const workingDays = totalDaysTillToday - holidayDates.length;
    const monthlyAbsentCount = workingDays - attendedDays;

    return {
        todayWorkingHours: todayWorkingHours || 0,
        weeklyHours: weeklyHours || 0,
        monthlyHours: monthlyHours || 0,
        monthlyLateArrivalHours: monthlyLateArrivalHours || 0,
        monthlyOvertimeHours: monthlyOvertimeHours || 0,
        monthlyAbsentCount: monthlyAbsentCount || 0
    };
};

async function sendNotification(playerId) {
    try {
        const response = await axios.post(
            'https://api.onesignal.com/notifications',
            {
                app_id: "5228ee13-2fd7-49db-a028-2c22188522c8",
                include_subscription_ids: [playerId],
                headings: { en: 'New Order Received' },
                contents: { en: `Table placed a new order.` },
                target_channel: 'push',
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Basic os_v2_app_kiuo4ezp25e5xibifqrbrbjczb2253ony6ruvc4qjmichluc4ahy2fjrnrcj2zaygjwp3eenyipufhxbawjndnym6zlpy4t7ivejaby`,
                },
            }
        );

        console.log('Notification response:', response.data);
        return response.data;
    } catch (error) {
        console.error('OneSignal notification failed:', error.response?.data || error.message);
        throw error;
    }
}

const postNotification = async (req, res) => {
    const { playerId } = req.body;

    if (!playerId) {
        return res.status(400).json({ error: 'Missing playerId' });
    }

    try {
        const result = await sendNotification(playerId);
        res.json({ success: true, result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

const userActiveStatusChange = async (req, res) => {
    try {
        const { status } = req.query;
        const loginUser = req.user;

        await UserModel.findByIdAndUpdate(loginUser._id, {status: status}, undefined);

        return res.status(200).json({
            success: true,
            message: "Status Update Successfully",
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
}

module.exports = {
    getMasterData,
    postNotification,
    userActiveStatusChange,
    postToken,
};
