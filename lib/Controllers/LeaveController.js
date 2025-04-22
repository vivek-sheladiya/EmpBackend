const {
    handleError,
} = require("../utils/utils");
const moment = require('moment');
const { leaveModel } = require('../Models/LeaveModel');
const { HolidayEventModel } = require("../Models/HolidayEventModel");
const { manualHoursModel } = require('../Models/manualHoursModel');
const { UserModel } = require('../Models/UserModel')
const mailer = require('../utils/smtp_mailer');
const ejs = require("ejs");

const leaveLabelKeys = {
    fullDay: "fullDay",
    halfDay: "halfDay",
    manualHours: "manualHours",
    firstHalf: "firstHalf",
    secondHalf: "secondHalf",
    singleDay: "singleDay",
    multipleDay: "multipleDay",
    paid: "paid",
    unpaid: "unpaid"
};

const list = async (req, res) => {
    try {
        const leaveList = await leaveModel.find({}).populate('user', 'fullName')
        return res.status(201).json({
            success: true,
            message: "leave get Successfully.",
            data: leaveList,
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
        const paidLeave = empLeave.filter(leave => leave.leaveCategory === leaveLabelKeys.paid);
        const unexpected = empLeave.filter(leave => leave.isUnexpected === true);
        const totalLeaveHours = empLeave.reduce((sum, leave) => {
            const hourMatch = leave.hours?.match(/\d+(\.\d+)?/);
            return sum + (hourMatch ? parseFloat(hourMatch[0]) : 0);
        }, 0);
        return res.status(201).json({
            success: true,
            message: "employee leave get Successfully.",
            data: empLeave,
            totalPaidLeave: paidLeave.length,
            unexpectedLeave: unexpected.length,
            totalLeaveHours: totalLeaveHours,
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
        if (!leaveCategory || ![leaveLabelKeys.paid, leaveLabelKeys.unpaid].includes(leaveCategory)) {
            return handleError(res, "Invalid or missing leave category.", 400);
        }
        if (leaveCategory === leaveLabelKeys.paid) {
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
                leaveCategory: leaveLabelKeys.paid,
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
                leaveCategory: leaveLabelKeys.paid,
                startDate: {
                    $gte: startOfYearStr,
                    $lte: endOfYearStr,
                },
            });
            if (paidLeavesThisYear.length >= 12) {
                return handleError(res, "Only 12 paid leaves allowed per year.", 400);
            }
        }
        if (!leaveType || ![leaveLabelKeys.fullDay, leaveLabelKeys.halfDay, leaveLabelKeys.manualHours].includes(leaveType)) {
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
        if (leaveCategory === leaveLabelKeys.unpaid) {
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
        if (leaveType === leaveLabelKeys.fullDay) {
            if (!dayType || ![leaveLabelKeys.singleDay, leaveLabelKeys.multipleDay].includes(dayType)) {
                return handleError(res, "Invalid or missing day type for Full Day.", 400);
            }
            leaveData.dayType = dayType;
            if (dayType === leaveLabelKeys.multipleDay) {
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
            if (dayType === leaveLabelKeys.singleDay) {
                leaveData.hours = `9 hours`;
            }
        }
        if (leaveType === leaveLabelKeys.halfDay) {
            if (!leaveHalfDayType || ![leaveLabelKeys.firstHalf, leaveLabelKeys.secondHalf].includes(leaveHalfDayType)) {
                return handleError(res, "Invalid or missing leave half day type.", 400);
            }
            const leaveDate = moment(leaveData.startDate, 'YYYY-MM-DD', true);
            if (!leaveDate.isValid()) {
                return handleError(res, "Invalid leave date provided.", 400);
            }
            if (leaveDate.day() === 6) {
                return handleError(res, "'Half Day' leave is not allowed on Saturdays.", 400);
            }
            leaveData.leaveHalfDayType = leaveHalfDayType;
            leaveData.hours = `4.5 hours`;
        }
        if (leaveType === leaveLabelKeys.manualHours) {
            const start = moment(startTime, "HH:mm");
            const end = moment(endTime, "HH:mm");
            const time = /^([01]\d|2[0-3]):([0-5]\d)$/;
            if (!startTime || !endTime || !time.test(startTime) || !time.test(endTime)) {
                return handleError(res, "Start time and end time are required for Manual Hours and must be in HH:mm format.", 400);
            }
            const leaveDate = moment(leaveData.startDate, 'YYYY-MM-DD', true);
            if (!leaveDate.isValid()) {
                return handleError(res, "Invalid leave date provided.", 400);
            }
            const isSaturday = leaveDate.day() === 6;
            const maxMinutes = isSaturday ? 60 : 180;
            const duration = moment.duration(end.diff(start));
            const totalMinutes = duration.asMinutes();
            if (totalMinutes > maxMinutes) {
                return handleError(
                    res,
                    isSaturday
                        ? "'Manual Hours' leave cannot exceed 1 hour on Saturdays."
                        : "For 'Manual Hours' leave type, the total duration cannot exceed 3 hours.",
                    400
                );
            }
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            leaveData.hours = `${hours}h ${minutes}m`;
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

        const start = moment(leaveData.startDate);
        const end = moment(leaveData.endDate || leaveData.startDate);
        let sandwich = false;
        if (start.day() === 1) {
            const yesterday = moment(start).subtract(1, 'day');
            if (yesterday.day() === 0) {
                sandwich = true;
            }
        }
        if (end.day() === 6) {
            const tomorrow = moment(end).add(1, 'day');
            if (tomorrow.day() === 0) {
                sandwich = true;
            }
        }
        if (start.day() === 0) {
            sandwich = true;
        }
        if (end.day() === 0) {
            sandwich = true;
        }
        leaveData.sandwichLeave = sandwich;

        const allHolidays = await HolidayEventModel.find({ isLeaveOnDay: true }).lean();
        for (const holiday of allHolidays) {
            const holidayDate = moment(holiday.eventDate).format("YYYY-MM-DD");
            const beforeDate = moment(holidayDate).subtract(1, 'day').startOf('day').format("YYYY-MM-DD");
            const afterDate = moment(holidayDate).add(1, 'day').startOf('day').format("YYYY-MM-DD");
            const leaveStart = moment(leaveData.startDate).startOf('day').format("YYYY-MM-DD");
            const leaveEnd = leaveData.endDate
                ? moment(leaveData.endDate).startOf('day').format("YYYY-MM-DD")
                : leaveStart;
            const coversBeforeDate = moment(beforeDate).isBetween(leaveStart, leaveEnd, undefined, '[]');
            const coversAfterDate = moment(afterDate).isBetween(leaveStart, leaveEnd, undefined, '[]');
            if (coversBeforeDate || coversAfterDate) {
                sandwich = true;
                break;
            }
        }
        leaveData.sandwichLeave = sandwich;
        const users = await UserModel.findOne({ _id: leaveData.user })

        if (leaveData.leaveType === leaveLabelKeys.fullDay || leaveData.dayType === leaveLabelKeys.singleDay) {
            const html = await ejs.renderFile("emailtemplates/leaveAddedFullDay.ejs", {
                userName: users.fullName,
                leaveType: leaveData.leaveType,
                leaveDay: 1,
                startDate: leaveData.startDate,
                dayType: leaveData.dayType,
                reason: leaveData.reason,
                leaveCategory: leaveData.leaveCategory
            });
            mailer.sendmail({
                from: 'bansikheniteqheal@gmail.com',
                to: 'bansikheniteqheal@gmail.com',
                subject: 'testing nodemailer',
                text: 'welcome to nodemailer',
                html: html
            }, async success => {
                console.log("Email sent successfully");
            }, async error => {
                console.error("Failed to send email", error);
            });
        }

        if (leaveData.leaveType === leaveLabelKeys.halfDay) {
            const html = await ejs.renderFile("emailtemplates/leaveAddedHalfDay.ejs", {
                userName: users.fullName,
                leaveType: leaveData.leaveType,
                startDate: leaveData.startDate,
                leaveHalfDayType: leaveData.leaveHalfDayType,
                reason: leaveData.reason,
                leaveCategory: leaveData.leaveCategory
            });
            mailer.sendmail({
                from: 'bansikheniteqheal@gmail.com',
                to: 'bansikheniteqheal@gmail.com',
                subject: 'testing nodemailer',
                text: 'welcome to nodemailer',
                html: html
            }, async success => {
                console.log("Email sent successfully");
            }, async error => {
                console.error("Failed to send email", error);
            });
        }

        if (leaveData.leaveType === leaveLabelKeys.manualHours) {
            const html = await ejs.renderFile("emailtemplates/leaveAddedManualHours.ejs", {
                userName: users.fullName,
                leaveType: leaveData.leaveType,
                leaveHours: leaveData.hours,
                startDate: leaveData.startDate,
                reason: leaveData.reason,
                leaveCategory: leaveData.leaveCategory
            });
            mailer.sendmail({
                from: 'bansikheniteqheal@gmail.com',
                to: 'bansikheniteqheal@gmail.com',
                subject: 'testing nodemailer',
                text: 'welcome to nodemailer',
                html: html
            }, async success => {
                console.log("Email sent successfully");
            }, async error => {
                console.error("Failed to send email", error);
            });
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
        if (body.leaveCategory && ![leaveLabelKeys.paid, leaveLabelKeys.unpaid].includes(body.leaveCategory)) {
            return handleError(res, "Invalid leave category.", 400);
        }
        if (body.leaveCategory === leaveLabelKeys.paid) {
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
                leaveCategory: leaveLabelKeys.paid,
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
                leaveCategory: leaveLabelKeys.paid,
                startDate: {
                    $gte: startOfYearStr,
                    $lte: endOfYearStr,
                },
            });
            if (paidLeavesThisYear.length >= 12) {
                return handleError(res, "Only 12 paid leaves allowed per year.", 400);
            }
        }
        if (body.leaveType && ![leaveLabelKeys.fullDay, leaveLabelKeys.halfDay, leaveLabelKeys.manualHours].includes(body.leaveType)) {
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
        if (leaveType === leaveLabelKeys.fullDay) {
            if (!dayType || !['Single Day', 'Multiple Day'].includes(dayType)) {
                return handleError(res, "Invalid or missing day type for Full Day.", 400);
            }
            const date = /^\d{4}-\d{2}-\d{2}$/;
            if (!startDate || !date.test(startDate)) {
                return handleError(res, "Start date is required and must be in YYYY-MM-DD format.", 400);
            }
            if (dayType === leaveLabelKeys.multipleDay) {
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
            if (dayType === leaveLabelKeys.singleDay) {
                leaveData.endDate = null;
                leaveData.startTime = null;
                leaveData.endTime = null;
                leaveData.dayType = dayType;
                leaveData.leaveHalfDayType = null;
                leaveData.hours = `9 hours`;
            }
        }
        if (leaveType === leaveLabelKeys.halfDay) {
            if (!leaveHalfDayType || ![leaveLabelKeys.firstHalf, leaveLabelKeys.secondHalf].includes(leaveHalfDayType)) {
                return handleError(res, "Invalid or missing leave half day type.", 400);
            }
            const leaveDate = moment(leaveData.startDate, 'YYYY-MM-DD', true);
            if (!leaveDate.isValid()) {
                return handleError(res, "Invalid leave date provided.", 400);
            }
            if (leaveDate.day() === 6) {
                return handleError(res, "'Half Day' leave is not allowed on Saturdays.", 400);
            }
            leaveData.leaveHalfDayType = leaveHalfDayType;
            leaveData.hours = `4.5 hours`;
        }
        if (leaveType === leaveLabelKeys.manualHours) {
            const start = moment(startTime, "HH:mm");
            const end = moment(endTime, "HH:mm");
            const time = /^([01]\d|2[0-3]):([0-5]\d)$/;
            if (!startTime || !endTime || !time.test(startTime) || !time.test(endTime)) {
                return handleError(res, "Start time and end time are required for Manual Hours and must be in HH:mm format.", 400);
            }
            const leaveDate = moment(leaveData.startDate, 'YYYY-MM-DD', true);
            if (!leaveDate.isValid()) {
                return handleError(res, "Invalid leave date provided.", 400);
            }
            const isSaturday = leaveDate.day() === 6;
            const maxMinutes = isSaturday ? 60 : 180;
            const duration = moment.duration(end.diff(start));
            const totalMinutes = duration.asMinutes();
            if (totalMinutes > maxMinutes) {
                return handleError(
                    res,
                    isSaturday
                        ? "'Manual Hours' leave cannot exceed 1 hour on Saturdays."
                        : "For 'Manual Hours' leave type, the total duration cannot exceed 3 hours.",
                    400
                );
            }
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            leaveData.hours = `${hours}h ${minutes}m`;
            leaveData.startTime = startTime;
            leaveData.endTime = endTime;
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

        const startDates = moment(leaveData.startDate);
        const end = moment(leaveData.endDate || leaveData.startDate);
        let sandwich = false;
        if (startDates.day() === 1) {
            const yesterday = moment(startDates).subtract(1, 'day');
            if (yesterday.day() === 0) {
                sandwich = true;
            }
        }
        if (end.day() === 6) {
            const tomorrow = moment(end).add(1, 'day');
            if (tomorrow.day() === 0) {
                sandwich = true;
            }
        }
        if (startDates.day() === 0 || end.day() === 0) {
            sandwich = true;
        }
        leaveData.sandwichLeave = sandwich;

        const allHolidays = await HolidayEventModel.find({ isLeaveOnDay: true }).lean();
        for (const holiday of allHolidays) {
            const holidayDate = moment(holiday.eventDate).format("YYYY-MM-DD");
            const beforeDate = moment(holidayDate).subtract(1, 'day').startOf('day').format("YYYY-MM-DD");
            const afterDate = moment(holidayDate).add(1, 'day').startOf('day').format("YYYY-MM-DD");
            const leaveStart = moment(leaveData.startDate).startOf('day').format("YYYY-MM-DD");
            const leaveEnd = leaveData.endDate
                ? moment(leaveData.endDate).startOf('day').format("YYYY-MM-DD")
                : leaveStart;
            const coversBeforeDate = moment(beforeDate).isBetween(leaveStart, leaveEnd, undefined, '[]');
            const coversAfterDate = moment(afterDate).isBetween(leaveStart, leaveEnd, undefined, '[]');
            if (coversBeforeDate || coversAfterDate) {
                sandwich = true;
                break;
            }
        }
        leaveData.sandwichLeave = sandwich;


        await leaveModel.findByIdAndUpdate({ _id: _id }, leaveData);
        const leaveList = await leaveModel.find();
        return res.status(201).json({ success: true, message: "Leave updated Successfully.", data: leaveList });
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
        const leaveList = await leaveModel.find();
        return res.status(201).json({
            success: true,
            message: "Leave Deleted Successfully.",
            data: leaveList
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
        const leaveListFull = await leaveModel.find();
        const userId = leaveList.user
        const user = await UserModel.findOne({ _id: userId })
        const formattedDate = new Date(leaveList.startDate).toISOString().split('T')[0];

        if (leaveList.leaveType === leaveLabelKeys.fullDay || leaveList.dayType === leaveLabelKeys.singleDay) {
            const html = await ejs.renderFile("emailtemplates/leaveStatusChangeFullDay.ejs", {
                userName: user.fullName,
                leaveType: leaveList.leaveType,
                leaveDay: 1,
                startDate: formattedDate,
                dayType: leaveList.dayType,
                reason: leaveList.reason,
                leaveCategory: leaveList.leaveCategory,
                status: leaveList.status
            });
            mailer.sendmail({
                from: 'bansikheniteqheal@gmail.com',
                to: user.emailAddress,
                subject: 'testing nodemailer',
                text: 'welcome to nodemailer',
                html: html
            }, async success => {
                console.log("Email sent successfully");
            }, async error => {
                console.error("Failed to send email", error);
            });
        }
        if (leaveList.leaveType === leaveLabelKeys.halfDay) {
            const html = await ejs.renderFile("emailtemplates/leaveStatusChangeHalfDay.ejs", {
                userName: user.fullName,
                leaveType: leaveList.leaveType,
                startDate: formattedDate,
                leaveHalfDayType: leaveList.leaveHalfDayType,
                reason: leaveList.reason,
                leaveCategory: leaveList.leaveCategory,
                status: leaveList.status
            });
            mailer.sendmail({
                from: 'bansikheniteqheal@gmail.com',
                to: user.emailAddress,
                subject: 'testing nodemailer',
                text: 'welcome to nodemailer',
                html: html
            }, async success => {
                console.log("Email sent successfully");
            }, async error => {
                console.error("Failed to send email", error);
            });
        }
        if (leaveList.leaveType === leaveLabelKeys.manualHours) {
            const html = await ejs.renderFile("emailtemplates/leaveStatusChange.ejs", {
                userName: user.fullName,
                leaveType: leaveList.leaveType,
                leaveHours: leaveList.hours,
                startDate: formattedDate,
                reason: leaveList.reason,
                status: leaveList.status,
                leaveCategory: leaveList.leaveCategory
            });
            mailer.sendmail({
                from: 'bansikheniteqheal@gmail.com',
                to: user.emailAddress,
                subject: 'testing nodemailer',
                text: 'welcome to nodemailer',
                html: html
            }, async success => {
                console.log("Email sent successfully");
            }, async error => {
                console.error("Failed to send email", error);
            });
        }


        return res.status(201).json({
            success: true,
            message: "Leave Status Change Successfully.",
            data: leaveListFull
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
        const paidLeave = empLeave.filter(leave => leave.leaveCategory === leaveLabelKeys.paid);
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

const addUpdateMonthlyManualHours = async (req, res) => {
    try {
        const { year, monthly_hours } = req.body;
        let existing = await manualHoursModel.findOne({ year });
        if (existing) {
            existing.monthly_hours = monthly_hours;
            await existing.save();
            return res.status(200).json({ message: 'Manual hours updated', data: existing });
        } else {
            const newRecord = await manualHoursModel.create({ year, monthly_hours });
            return res.status(201).json({ message: 'Manual hours saved', data: newRecord });
        }
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

const getMonthlyManualHours = async (req, res) => {
    try {
        const { year } = req.params;
        if (year) {
            const existing = await manualHoursModel.findOne({ year });
            return res.status(200).json({ message: 'Manual hours get Successfully', data: existing });
        } else {
            const manualHours = await manualHoursModel.find();
            return res.status(200).json({ message: 'Manual hours get Successfully', data: manualHours });
        }
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
    allLeaveLength,
    addUpdateMonthlyManualHours,
    getMonthlyManualHours
}