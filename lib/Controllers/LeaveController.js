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
const { AppSettingModel } = require('../Models/AppSettingModel')

const leaveLabelKeys = {
    fullDay: "fullDay",
    halfDay: "halfDay",
    manualHours: "manualHours",
    firstHalf: "firstHalf",
    secondHalf: "secondHalf",
    singleDay: "singleDay",
    multipleDay: "multipleDay",
    paid: "paid",
    unpaid: "unpaid",
    pending: "pending",
    approved: "approved",
    rejected: "rejected"
};

function fromCamelCaseToLabel(text) {
    if (!text) return '';
    return text
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (str) => str.toUpperCase());
}
async function checkMonthlyLeave(user, startDate, category, limit, leaveModel) {
    const date = new Date(startDate);
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const leaves = await leaveModel.find({
        user: user,
        leaveCategory: category,
        startDate: {
            $gte: start.toISOString().split('T')[0],
            $lte: end.toISOString().split('T')[0]
        }
    });

    return leaves.length < limit;
}
async function checkYearlyLeave(user, startDate, category, limit, leaveModel) {
    const date = new Date(startDate);
    const start = new Date(date.getFullYear(), 0, 1);
    const end = new Date(date.getFullYear(), 11, 31);

    const leaves = await leaveModel.find({
        user: user,
        leaveCategory: category,
        startDate: {
            $gte: start.toISOString().split('T')[0],
            $lte: end.toISOString().split('T')[0]
        }
    });

    return leaves.length < limit;
}
function validateFullDayLeave({ dayType, startDate, endDate }) {
    if (!dayType || ![leaveLabelKeys.singleDay, leaveLabelKeys.multipleDay].includes(dayType)) {
        throw new Error("Invalid or missing day type for Full Day.");
    }
    const result = { dayType };
    if (dayType === leaveLabelKeys.multipleDay) {
        if (!endDate) {
            throw new Error("End date is required");
        }
        const start = moment(startDate, moment.ISO_8601, true);
        const end = moment(endDate, moment.ISO_8601, true);
        if (!start.isValid() || !end.isValid()) {
            throw new Error("Invalid date format");
        }
        if (start.isAfter(end)) {
            throw new Error("End date must be greater than or equal to start date.");
        }
        const totalDays = end.diff(start, 'days') + 1;
        result.hours = `${totalDays * 9} hours`;
        result.endDate = endDate;
    } else {
        result.hours = "9 hours";
    }
    return result;
}
function validateHalfDayLeave(leaveHalfDayType, startDate) {
    const validHalfDayTypes = [leaveLabelKeys.firstHalf, leaveLabelKeys.secondHalf];
    if (!validHalfDayTypes.includes(leaveHalfDayType)) {
        throw new Error('Invalid or missing leave half day type.');
    }
    const leaveDate = moment(startDate);
    if (leaveDate.day() === 6) {
        throw new Error("Half Day leave is not allowed on Saturdays.");
    }
    return {
        leaveHalfDayType,
        hours: '4.5 hours'
    };
}
function validateManualHoursLeave(startTime, endTime, leaveDate) {
    if (!startTime || !endTime) {
        throw new Error('Start time and end time are required');
    }
    const start = moment(startTime, "HH:mm");
    const end = moment(endTime, "HH:mm");
    const date = moment(leaveDate);
    if (!start.isValid() || !end.isValid()) {
        throw new Error('Invalid time format. Use HH:mm');
    }
    if (end.isBefore(start)) {
        throw new Error('End time cannot be before start time');
    }
    const duration = moment.duration(end.diff(start));
    const totalMinutes = duration.asMinutes();
    const isSaturday = date.day() === 6;
    const maxMinutes = isSaturday ? 60 : 180;
    if (totalMinutes > maxMinutes) {
        throw new Error(
            isSaturday
                ? "'Manual Hours' leave cannot exceed 1 hour on Saturdays."
                : "For 'Manual Hours' leave type, the total duration cannot exceed 3 hours."
        );
    }
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const hoursString = minutes > 0
        ? `${hours} hours ${minutes} minutes`
        : `${hours} hours`;
    return {
        hours: hoursString,
        startTime,
        endTime
    };
}
async function detectSandwichLeave(startDate, endDate, holidays = []) {
    const start = moment(startDate);
    const end = moment(endDate || startDate);
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
    if (start.day() === 0 || end.day() === 0) {
        sandwich = true;
    }
    const allHolidays = await HolidayEventModel.find({ isLeaveOnDay: true }).lean();
    for (const holiday of holidays) {
        const holidayDate = moment(holiday.eventDate).format("YYYY-MM-DD");
        const beforeDate = moment(holidayDate).subtract(1, 'day').format("YYYY-MM-DD");
        const afterDate = moment(holidayDate).add(1, 'day').format("YYYY-MM-DD");
        const leaveStart = moment(startDate).format("YYYY-MM-DD");
        const leaveEnd = moment(endDate || startDate).format("YYYY-MM-DD");
        const coversBeforeDate = moment(beforeDate).isBetween(leaveStart, leaveEnd, null, '[]');
        const coversAfterDate = moment(afterDate).isBetween(leaveStart, leaveEnd, null, '[]');
        if (coversBeforeDate || coversAfterDate) {
            sandwich = true;
            break;
        }
    }
    return sandwich;
}
function checkUnexpectedLeave(startDate, requestedCategory) {
    const start = moment(startDate, moment.ISO_8601, true);
    const today = moment();
    if (!start.isValid()) {
        throw new Error('Invalid start date format');
    }
    const diffInDays = start.diff(today, 'days');
    const isUnexpected = diffInDays <= 1;
    return {
        isUnexpected,
        leaveCategory: isUnexpected ? leaveLabelKeys.unpaid : requestedCategory
    };
}

const list = async (req, res) => {
    try {
        const leaveList = await leaveModel.find({}).populate('user', 'fullName');
        const formattedLeave = leaveList.map(leave => {
            return {
                ...leave._doc,
                user: {
                    userId: leave.user._id,
                    fullName: leave.user.fullName
                }
            };
        });
        return res.status(201).json({
            success: true,
            message: "leave get Successfully.",
            data: formattedLeave,
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
        const formattedLeave = empLeave.map(leave => {
            return {
                ...leave._doc,
                user: {
                    userId: leave.user._id,
                    fullName: leave.user.fullName
                }
            };
        });
        return res.status(201).json({
            success: true,
            message: "employee leave get Successfully.",
            data: formattedLeave,
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
        let settings = await AppSettingModel.findOne();
        if (!settings) {
            settings = new AppSettingModel();
        }
        if (leaveCategory === leaveLabelKeys.paid) {
            const monthlyAllowed = await checkMonthlyLeave(user, startDate, leaveLabelKeys.paid, settings.monthlyMaxPaidLeave, leaveModel);
            if (!monthlyAllowed) {
                return handleError(res, "Only 2 paid leaves allowed per month.", 400);
            }
            const yearlyAllowed = await checkYearlyLeave(user, startDate, leaveLabelKeys.paid, settings.yearlyPaidLeave, leaveModel);
            if (!yearlyAllowed) {
                return handleError(res, "Only 12 paid leaves allowed per year.", 400);
            }
        }
        if (!leaveType || ![leaveLabelKeys.fullDay, leaveLabelKeys.halfDay, leaveLabelKeys.manualHours].includes(leaveType)) {
            return handleError(res, "Invalid or missing leave type.", 400);
        }
        // const date = /^\d{4}-\d{2}-\d{2}$/;
        if (!startDate) {
            return handleError(res, "Start date is required", 400);
        }
        const leaveData = {
            user,
            leaveType,
            leaveCategory,
            startDate,
            isUnexpected,
            reason,
        };
        if (leaveCategory) {
            try {
                const result = checkUnexpectedLeave(req.body.startDate, leaveCategory,
                );
                Object.assign(leaveData, { isUnexpected: result.isUnexpected, leaveCategory: result.leaveCategory });
            } catch (error) {
                return handleError(res, error.message, 400);
            }
        }

        if (leaveType === leaveLabelKeys.fullDay) {
            try {
                const validatedData = validateFullDayLeave({ dayType: dayType, startDate: req.body.startDate, endDate: req.body.endDate });
                leaveData.dayType = validatedData.dayType
                leaveData.endDate = validatedData.endDate
            } catch (error) {
                return handleError(res, error.message, 400);
            }
        }
        if (leaveType === leaveLabelKeys.halfDay) {
            try {
                const validatedData = validateHalfDayLeave(leaveHalfDayType, leaveData.startDate);
                console.log("validatedData", validatedData)
                leaveData.leaveHalfDayType = validatedData.leaveHalfDayType
                leaveData.hours = validatedData.hours
            } catch (error) {
                return handleError(res, error.message, 400);
            }
        }
        if (leaveType === leaveLabelKeys.manualHours) {
            try {
                const validatedData = validateManualHoursLeave(startTime, endTime, leaveData.startDate);
                leaveData.startTime = validatedData.startTime
                leaveData.endTime = validatedData.endTime
                leaveData.startDate = startDate
            } catch (error) {
                return handleError(res, error.message, 400);
            }
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


        leaveData.sandwichLeave = await detectSandwichLeave(
            leaveData.startDate,
            leaveData.endDate,
            // allHolidays
        );
        const users = await UserModel.findOne({ _id: leaveData.user })

        if (leaveData.leaveType === leaveLabelKeys.fullDay) {
            const html = await ejs.renderFile("emailtemplates/leaveAddedFullDay.ejs", {
                userName: fromCamelCaseToLabel(users.fullName),
                leaveType: fromCamelCaseToLabel(leaveData.leaveType),
                dayType: fromCamelCaseToLabel(leaveData.dayType),
                leaveCategory: fromCamelCaseToLabel(leaveData.leaveCategory),
                startDate: leaveData.startDate,
                reason: fromCamelCaseToLabel(leaveData.reason)
            });
            mailer.sendmail({
                from: users.emailAddress,
                to: settings.adminEmail,
                subject: '',
                text: '',
                html: html
            }, async success => {
                console.log("Email sent successfully");
            }, async error => {
                console.error("Failed to send email", error);
            });
        }

        if (leaveData.leaveType === leaveLabelKeys.halfDay) {
            const html = await ejs.renderFile("emailtemplates/leaveAddedHalfDay.ejs", {
                userName: fromCamelCaseToLabel(users.fullName),
                leaveType: fromCamelCaseToLabel(leaveData.leaveType),
                leaveDay: 4.5,
                hours: leaveData.hours,
                leaveCategory: fromCamelCaseToLabel(leaveData.leaveCategory),
                startDate: leaveData.startDate,
                leaveHalfDayType: fromCamelCaseToLabel(leaveData.leaveHalfDayType),
                reason: fromCamelCaseToLabel(leaveData.reason),
            });
            mailer.sendmail({
                from: users.emailAddress,
                to: settings.adminEmail,
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
                userName: fromCamelCaseToLabel(users.fullName),
                leaveType: fromCamelCaseToLabel(leaveData.leaveType),
                leaveDay: leaveData.hours,
                leaveHours: leaveData.hours,
                startDate: leaveData.startDate,
                reason: fromCamelCaseToLabel(leaveData.reason),
                leaveCategory: fromCamelCaseToLabel(leaveData.leaveCategory)
            });
            mailer.sendmail({
                from: users.emailAddress,
                to: settings.adminEmail,
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
        const list = await leaveModel.find({}).populate('user', 'fullName');
        const leaveList = list.map(leave => {
            return {
                ...leave._doc,
                user: {
                    userId: leave.user._id,
                    fullName: leave.user.fullName
                }
            };
        });
        return res.status(201).json({ success: true, message: "Leave Added Successfully.", leaveList });
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
        let settings = await AppSettingModel.findOne();
        if (!settings) {
            settings = new AppSettingModel();
        }
        if (leaveCategory === leaveLabelKeys.paid) {
            const monthlyAllowed = await checkMonthlyLeave(user, startDate, leaveLabelKeys.paid, settings.monthlyMaxPaidLeave, leaveModel);
            if (!monthlyAllowed) {
                return handleError(res, "Only 2 paid leaves allowed per month.", 400);
            }
            const yearlyAllowed = await checkYearlyLeave(user, startDate, leaveLabelKeys.paid, settings.yearlyPaidLeave, leaveModel);
            if (!yearlyAllowed) {
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
            try {
                const validatedData = validateFullDayLeave({
                    dayType: dayType,
                    startDate: req.body.startDate,
                    endDate: req.body.endDate
                });
                Object.assign(leaveData, validatedData);

            } catch (error) {
                return handleError(res, error.message, 400);
            }
        }

        if (leaveType === leaveLabelKeys.halfDay) {
            if (!leaveHalfDayType || ![leaveLabelKeys.firstHalf, leaveLabelKeys.secondHalf].includes(leaveHalfDayType)) {
                return handleError(res, "Invalid or missing leave half day type.", 400);
            }
            const leaveDate = moment(leaveData.startDate);
            if (leaveDate.day() === 6) {
                return handleError(res, "'Half Day' leave is not allowed on Saturdays.", 400);
            }
            leaveData.leaveHalfDayType = leaveHalfDayType;
            leaveData.dayType = null
            leaveData.endDate = null;
            leaveData.startTime = null;
            leaveData.endTime = null;
            leaveData.hours = `4.5 hours`;
        }

        if (leaveType === leaveLabelKeys.manualHours) {
            const start = moment(startTime, "HH:mm");
            const end = moment(endTime, "HH:mm");
            if (!startTime || !endTime) {
                return handleError(res, "Start time and end time are required", 400);
            }
            const leaveDate = moment(leaveData.startDate);
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
        const list = await leaveModel.find({}).populate('user', 'fullName');
        const leaveList = list.map(leave => {
            return {
                ...leave._doc,
                user: {
                    userId: leave.user._id,
                    fullName: leave.user.fullName
                }
            };
        });
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
        if (!status || ![leaveLabelKeys.pending, leaveLabelKeys.approved, leaveLabelKeys.rejected].includes(status)) {
            return handleError(res, "Invalid or missing status.", 400);
        }
        if (status === leaveLabelKeys.rejected && !rejectedReason) {
            return handleError(res, "rejected reason is required for status reject.", 400);
        }
        const leaveList = await leaveModel.findByIdAndUpdate({ _id: id }, { $set: { status: status } }, { new: true, runValidators: true });
        if (!leaveList) {
            return handleError(res, "Leave Not Found.", 400);
        }

        const userId = leaveList.user
        const user = await UserModel.findOne({ _id: userId })
        const formattedDate = new Date(leaveList.startDate).toISOString().split('T')[0];

        let settings = await AppSettingModel.findOne();
        if (!settings) {
            settings = new AppSettingModel();
        }

        if (leaveList.leaveType === leaveLabelKeys.fullDay) {
            const html = await ejs.renderFile("emailtemplates/leaveStatusChangeFullDay.ejs", {
                userName: fromCamelCaseToLabel(user.fullName),
                leaveType: fromCamelCaseToLabel(leaveList.leaveType),
                startDate: formattedDate,
                dayType: fromCamelCaseToLabel(leaveList.dayType),
                reason: fromCamelCaseToLabel(leaveList.reason),
                leaveCategory: fromCamelCaseToLabel(leaveList.leaveCategory),
                status: fromCamelCaseToLabel(leaveList.status)
            });
            mailer.sendmail({
                from: settings.adminEmail,
                to: user.emailAddress,
                subject: '',
                text: '',
                html: html
            }, async success => {
                console.log("Email sent successfully");
            }, async error => {
                console.error("Failed to send email", error);
            });
        }

        if (leaveList.leaveType === leaveLabelKeys.halfDay) {
            const html = await ejs.renderFile("emailtemplates/leaveStatusChangeHalfDay.ejs", {
                userName: fromCamelCaseToLabel(user.fullName),
                leaveType: fromCamelCaseToLabel(leaveList.leaveType),
                startDate: formattedDate,
                leaveHalfDayType: fromCamelCaseToLabel(leaveList.leaveHalfDayType),
                reason: fromCamelCaseToLabel(leaveList.reason),
                leaveCategory: fromCamelCaseToLabel(leaveList.leaveCategory),
                status: fromCamelCaseToLabel(leaveList.status)
            });
            mailer.sendmail({
                from: settings.adminEmail,
                to: user.emailAddress,
                subject: '',
                text: '',
                html: html
            }, async success => {
                console.log("Email sent successfully");
            }, async error => {
                console.error("Failed to send email", error);
            });
        }

        if (leaveList.leaveType === leaveLabelKeys.manualHours) {
            const html = await ejs.renderFile("emailtemplates/leaveStatusChange.ejs", {
                userName: fromCamelCaseToLabel(user.fullName),
                leaveType: fromCamelCaseToLabel(leaveList.leaveType),
                leaveDay: leaveList.hours,
                leaveHours: leaveList.hours,
                startDate: leaveList.startDate,
                reason: fromCamelCaseToLabel(leaveList.reason),
                leaveCategory: fromCamelCaseToLabel(leaveList.leaveCategory),
                status: fromCamelCaseToLabel(leaveList.status)
            });
            mailer.sendmail({
                from: settings.adminEmail,
                to: user.emailAddress,
                subject: '',
                text: '',
                html: html
            }, async success => {
                console.log("Email sent successfully");
            }, async error => {
                console.error("Failed to send email", error);
            });
        }
        const leaveListFull = await leaveModel.find().populate('user', 'fullName');
        const leaveLists = leaveListFull.map(leave => {
            return {
                ...leave._doc,
                user: {
                    userId: leave.user._id,
                    fullName: leave.user.fullName
                }
            };
        });
        return res.status(201).json({
            success: true,
            message: "Leave Status Change Successfully.",
            data: leaveLists
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
        const formattedLeave = Leave.map(leave => {
            return {
                ...leave._doc,
                user: {
                    userId: leave.user._id,
                    fullName: leave.user.fullName
                }
            };
        });
        return res.status(201).json({
            success: true,
            message: "unexpected leave get Successfully.",
            data: formattedLeave
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