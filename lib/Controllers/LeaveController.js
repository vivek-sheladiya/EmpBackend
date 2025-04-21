const {
    handleError,
} = require("../utils/utils");
const moment = require('moment');
const { leaveModel } = require('../Models/LeaveModel')


const list = async (req, res) => {
    try {
        const leaveList = await leaveModel.find({}).populate('user', 'fullName')
        return res.status(201).json({
            success: true,
            message: "leave get Successfully.",
            totalLeave: leaveList.length,
            leaveList
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

const empLeaveList = async (req, res) => {
    try {
        const userId = req.user._id
        const empLeave = await leaveModel.find({
            user: userId
        }).populate('user', 'fullName');
        const paidLeave = empLeave.filter(leave => leave.leaveCategory === 'paid');
        const unexpected = empLeave.filter(leave => leave.isUnexpected === true);
        const totalLeaveHours = empLeave.reduce((sum, leave) => {
            const hourMatch = leave.hours?.match(/\d+(\.\d+)?/);
            return sum + (hourMatch ? parseFloat(hourMatch[0]) : 0);
        }, 0);
        return res.status(201).json({
            success: true,
            message: "employee leave get Successfully.",
            totalLeave: empLeave.length,
            totalPaidLeave: paidLeave.length,
            unexpectedLeave: unexpected.length,
            totalLeaveHours: totalLeaveHours,
            empLeave
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

const addLeave = async (req, res) => {
    try {
        const { isUnexpected, leaveType, leaveCategory, startDate, endDate, reason, leaveHalfDayType, dayType, startTime, endTime, user } = req.body;
        if (!user) {
            return handleError(res, "user is required.", 400);
        }
        if (!leaveCategory || !['paid', 'unpaid'].includes(leaveCategory)) {
            return handleError(res, "Invalid or missing leave category.", 400);
        }
        if (leaveCategory === 'paid') {
            const date = new Date(startDate);
            const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            const startOfYear = new Date(date.getFullYear(), 0, 1);
            const endOfYear = new Date(date.getFullYear(), 11, 31);

            const startOfMonthStr = startOfMonth.toISOString().split('T')[0];
            const endOfMonthStr = endOfMonth.toISOString().split('T')[0];
            const startOfYearStr = startOfYear.toISOString().split('T')[0];
            const endOfYearStr = endOfYear.toISOString().split('T')[0];

            const paidLeavesThisMonth = await leaveModel.find({
                user: user,
                leaveCategory: 'paid',
                startDate: {
                    $gte: startOfMonthStr,
                    $lte: endOfMonthStr,
                },
            });
            if (paidLeavesThisMonth.length >= 2) {
                return handleError(res, "Only 2 paid leaves allowed per month.", 400);
            }
            const paidLeavesThisYear = await leaveModel.find({
                user: user,
                leaveCategory: 'Paid',
                startDate: {
                    $gte: startOfYearStr,
                    $lte: endOfYearStr,
                },
            });
            if (paidLeavesThisYear.length >= 12) {
                return handleError(res, "Only 12 paid leaves allowed per year.", 400);
            }
        }
        if (!leaveType || !['Full Day', 'Half Day', 'Manual Hours'].includes(leaveType)) {
            return handleError(res, "Invalid or missing leave type.", 400);
        }
        const date = /^\d{4}-\d{2}-\d{2}$/;
        if (!startDate || !date.test(startDate)) {
            return handleError(res, "Start date is required and must be in YYYY-MM-DD format.", 400);
        }
        const leaveData = {
            user,
            leaveType,
            leaveCategory,
            startDate,
            isUnexpected,
            reason,
        };
        if (leaveCategory === 'unpaid') {
            const startD = req.body.startDate;
            const start = moment(startD, moment.ISO_8601, true);
            const today = moment();
            const diffInDays = start.diff(today, 'days');
            if (diffInDays <= 1) {
                leaveData.isUnexpected = true;
            } else {
                leaveData.isUnexpected = false;
            }
        }
        if (leaveType === 'Full Day') {
            if (!dayType || !['Single Day', 'Multiple Day'].includes(dayType)) {
                return handleError(res, "Invalid or missing day type for Full Day.", 400);
            }
            leaveData.dayType = dayType;
            if (dayType === 'Multiple Day') {
                const startDate = req.body.startDate;
                const endDate = req.body.endDate;
                const start = moment(startDate, moment.ISO_8601, true);
                const end = moment(endDate, moment.ISO_8601, true);
                const totalDays = end.diff(start, 'days') + 1;
                const hours = totalDays * 9;
                req.body.hours = `${hours} hours`;
                if (!endDate || !date.test(endDate)) {
                    return handleError(res, "End date is required for Full Day and must be in YYYY-MM-DD format.", 400);
                }
                if (startDate >= endDate) {
                    return handleError(res, "End date must be greater than or equal to start date.", 400);
                }
                leaveData.endDate = endDate;
            }
            if (dayType === 'Single Day') {
                leaveData.hours = `9 hours`;
            }
        }
        if (leaveType === 'Half Day') {
            if (!leaveHalfDayType || !['First Half', 'Second Half'].includes(leaveHalfDayType)) {
                return handleError(res, "Invalid or missing leave half day type.", 400);
            }
            leaveData.leaveHalfDayType = leaveHalfDayType;
            leaveData.hours = `4.5 hours`;
        }
        if (leaveType === 'Manual Hours') {
            const start = moment(startTime, "HH:mm");
            const end = moment(endTime, "HH:mm");
            if (end.isBefore(start)) {
                end.add(1, 'day');
            }
            const duration = moment.duration(end.diff(start));
            const hours = duration.hours();
            leaveData.hours = `${hours} hours`;
            const time = /^([01]\d|2[0-3]):([0-5]\d)$/;
            if (!startTime || !endTime || !time.test(startTime) || !time.test(endTime)) {
                return handleError(res, "start time and end time  is required for Manual Hours and must be in HH:mm format.", 400);
            }
            leaveData.startTime = startTime;
            leaveData.endTime = endTime;
        }
        if (!reason || reason.trim() === '') {
            return handleError(res, "Reason is required.", 400);
        }
        const _startDate = leaveData.startDate;
        const _endDate = leaveData.endDate || _startDate;
        const leaveAddAlready = await leaveModel.findOne({
            user,
            $or: [
                { startDate: { $lte: _endDate }, endDate: { $gte: _startDate } },
                { startDate: { $gte: _startDate, $lte: _endDate }, endDate: { $exists: false } }
            ]
        });
        if (leaveAddAlready) {
            return handleError(res, "Leave already exists for selected date range.", 400);
        }
        await leaveModel.create(leaveData);
        return res.status(201).json({ success: true, message: "Leave Added Successfully." });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

const updateLeave = async (req, res) => {
    try {
        const _id = req.params._id
        const body = req.body;
        const { isUnexpected, leaveType, leaveCategory, startDate, endDate, reason, leaveHalfDayType, dayType, startTime, endTime, user } = body;
        if (!user) {
            return handleError(res, "user is required.", 400);
        }
        if (body.leaveCategory && !['paid', 'unpaid'].includes(body.leaveCategory)) {
            return handleError(res, "Invalid leave category.", 400);
        }
        if (body.leaveCategory === 'paid') {
            const date = new Date(startDate);
            const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            const startOfYear = new Date(date.getFullYear(), 0, 1);
            const endOfYear = new Date(date.getFullYear(), 11, 31);

            const startOfMonthStr = startOfMonth.toISOString().split('T')[0];
            const endOfMonthStr = endOfMonth.toISOString().split('T')[0];
            const startOfYearStr = startOfYear.toISOString().split('T')[0];
            const endOfYearStr = endOfYear.toISOString().split('T')[0];

            const paidLeavesThisMonth = await leaveModel.find({
                user: user,
                leaveCategory: 'paid',
                startDate: {
                    $gte: startOfMonthStr,
                    $lte: endOfMonthStr,
                },
            });
            if (paidLeavesThisMonth.length >= 2) {
                return handleError(res, "Only 2 paid leaves allowed per month.", 400);
            }
            const paidLeavesThisYear = await leaveModel.find({
                user: user,
                leaveCategory: 'paid',
                startDate: {
                    $gte: startOfYearStr,
                    $lte: endOfYearStr,
                },
            });
            if (paidLeavesThisYear.length >= 12) {
                return handleError(res, "Only 12 paid leaves allowed per year.", 400);
            }
        }
        if (body.leaveType && !['Full Day', 'Half Day', 'Manual Hours'].includes(body.leaveType)) {
            return handleError(res, "Invalid leave type.", 400);
        }
        const leaveData = {
            user,
            leaveType,
            leaveCategory,
            startDate,
            isUnexpected,
            reason,
        };
        const startD = req.body.startDate;
        const start = moment(startD, moment.ISO_8601, true);
        const today = moment();
        const diffInDays = start.diff(today, 'days');
        if (diffInDays <= 1) {
            leaveData.isUnexpected = true;
        } else {
            leaveData.isUnexpected = false;
        }
        if (leaveType === 'Full Day') {
            if (!dayType || !['Single Day', 'Multiple Day'].includes(dayType)) {
                return handleError(res, "Invalid or missing day type for Full Day.", 400);
            }
            const date = /^\d{4}-\d{2}-\d{2}$/;
            if (!startDate || !date.test(startDate)) {
                return handleError(res, "Start date is required and must be in YYYY-MM-DD format.", 400);
            }
            if (dayType === 'Multiple Day') {
                const startDate = req.body.startDate;
                const endDate = req.body.endDate;
                const start = moment(startDate, moment.ISO_8601, true);
                const end = moment(endDate, moment.ISO_8601, true);
                const totalDays = end.diff(start, 'days') + 1;
                const hours = totalDays * 9;
                req.body.hours = `${hours} hours`;
                if (!endDate || !date.test(endDate)) {
                    return handleError(res, "End date is required for Full Day and must be in YYYY-MM-DD format.", 400);
                }
                if (startDate >= endDate) {
                    return handleError(res, "End date must be greater than or equal to start date.", 400);
                }
                leaveData.endDate = endDate;
                leaveData.hours = `${hours} hours`;
                leaveData.dayType = dayType;
                leaveData.leaveCategory = leaveCategory;
                leaveData.leaveHalfDayType = null;
            }
            if (dayType === 'Single Day') {
                leaveData.endDate = null;
                leaveData.startTime = null;
                leaveData.endTime = null;
                leaveData.dayType = dayType;
                leaveData.leaveHalfDayType = null;
                leaveData.hours = `9 hours`;
            }
        }
        if (leaveType === 'Half Day') {
            if (!leaveHalfDayType || !['First Half', 'Second Half'].includes(leaveHalfDayType)) {
                return handleError(res, "Invalid or missing leave half day type.", 400);
            }
            const date = /^\d{4}-\d{2}-\d{2}$/;
            if (!startDate || !date.test(startDate)) {
                return handleError(res, "Start date is required and must be in YYYY-MM-DD format.", 400);
            }
            leaveData.dayType = null
            leaveData.endDate = null
            leaveData.startTime = null;
            leaveData.endTime = null;
            leaveData.leaveHalfDayType = leaveHalfDayType;
            leaveData.hours = "4.5 hours";
        }
        if (leaveType === 'Manual Hours') {
            const date = /^\d{4}-\d{2}-\d{2}$/;
            if (!startDate || !date.test(startDate)) {
                return handleError(res, "Start date is required and must be in YYYY-MM-DD format.", 400);
            }
            const start = moment(startTime, "HH:mm");
            const end = moment(endTime, "HH:mm");
            if (end.isBefore(start)) {
                end.add(1, 'day');
            }
            const duration = moment.duration(end.diff(start));
            const hours = duration.hours();
            req.body.hours = `${hours} hours`;
            const time = /^([01]\d|2[0-3]):([0-5]\d)$/;
            if (!startTime || !endTime || !time.test(startTime) || !time.test(endTime)) {
                return handleError(res, "start time and end time  is required for Manual Hours and must be in HH:mm format.", 400);
            }
            leaveData.dayType = null
            leaveData.endDate = null
            leaveData.startTime = startTime;
            leaveData.endTime = endTime;
            leaveData.leaveHalfDayType = null;
            leaveData.hours = `${hours} hours`;
        }
        const _startDate = leaveData.startDate;
        const _endDate = leaveData.endDate || _startDate;
        const leaveAddedSameDate = await leaveModel.findOne({
            user,
            _id: { $ne: _id },
            startDate: { $lte: _endDate },
            $or: [
                { endDate: { $gte: _startDate } },
                { endDate: { $exists: false }, startDate: { $gte: _startDate } }
            ]
        });
        if (leaveAddedSameDate) {
            return handleError(res, "Leave already exists for selected date range.", 400);
        }
        await leaveModel.findByIdAndUpdate({ _id: _id }, leaveData);
        return res.status(201).json({ success: true, message: "Leave updated Successfully." });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

const deleteLeave = async (req, res) => {
    try {
        const id = req.params._id
        const EmpLeave = await leaveModel.findByIdAndDelete({ _id: id });
        if (!EmpLeave) {
            return handleError(res, "Leave Not Found.", 400);
        }
        return res.status(201).json({
            success: true,
            message: "Leave Deleted Successfully.",
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

const LeaveStatusChange = async (req, res) => {
    try {
        const id = req.params._id;
        const { status, rejectedReason } = req.body;
        if (!status || !['Pending', 'Approved', 'Rejected'].includes(status)) {
            return handleError(res, "Invalid or missing status.", 400);
        }
        if (status === 'Rejected' && !rejectedReason) {
            return handleError(res, "rejected reason is required for status reject.", 400);
        }
        const leaveList = await leaveModel.findByIdAndUpdate({ _id: id }, { $set: { status: status } }, { new: true, runValidators: true });
        if (!leaveList) {
            return handleError(res, "Leave Not Found.", 400);
        }
        return res.status(201).json({
            success: true,
            message: "Leave Status Change Successfully."
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

const unexpectedLeave = async (req, res) => {
    try {
        const Leave = await leaveModel.find({
            isUnexpected: true
        }).populate('user', 'fullName')
        return res.status(201).json({
            success: true,
            message: "unexpected leave get Successfully.",
            Leave
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

const allLeaveLength = async (req, res) => {
    try {
        const empLeave = await leaveModel.find({
            user: req.params._id
        }).populate('user', 'fullName');
        const paidLeave = empLeave.filter(leave => leave.leaveCategory === 'paid');
        const unexpected = empLeave.filter(leave => leave.isUnexpected === true);
        const sandwichLeaves = empLeave.filter(leave => leave.sandwichLeave === true);
        const totalLeaveHours = empLeave.reduce((sum, leave) => {
            const hourMatch = leave.hours?.match(/\d+(\.\d+)?/);
            return sum + (hourMatch ? parseFloat(hourMatch[0]) : 0);
        }, 0);
        return res.status(201).json({
            success: true,
            message: "all total leave length get Successfully.",
            totalLeave: `${empLeave.length} Leaves`,
            totalPaidLeave: `${paidLeave.length} Leaves`,
            unexpectedLeave: `${unexpected.length} Leaves`,
            sandwichLeaves: `${sandwichLeaves.length} Leaves`,
            totalLeaveHours: `${totalLeaveHours} Hours`,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

module.exports = {
    addLeave,
    updateLeave,
    deleteLeave,
    list,
    empLeaveList,
    LeaveStatusChange,
    unexpectedLeave,
    allLeaveLength
}