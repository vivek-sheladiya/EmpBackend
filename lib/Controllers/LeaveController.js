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
const {sendLeaveEmail} = require("../utils/smtp_mailer");

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
async function checkLeave(user, startDate, endDate, category, limit, leaveModel, type = 'monthly') {
    const date = new Date(startDate);
    let start, end;
    if (type === 'monthly') {
        start = new Date(date.getFullYear(), date.getMonth(), 1);
        end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    } else if (type === 'yearly') {
        start = new Date(date.getFullYear(), 0, 1);
        end = new Date(date.getFullYear(), 11, 31);
    }
    const leaves = await leaveModel.find({
        user: user,
        leaveCategory: category,
        $or: [
            {
                startDate: { $gte: start.toISOString().split('T')[0], $lte: end.toISOString().split('T')[0] }
            },
            {
                endDate: { $gte: start.toISOString().split('T')[0], $lte: end.toISOString().split('T')[0] }
            },
            {
                startDate: { $lte: start.toISOString().split('T')[0] },
                endDate: { $gte: end.toISOString().split('T')[0] }
            }
        ]
    });
    let totalLeaveDays = 0;
    for (const leave of leaves) {
        totalLeaveDays += calculateLeaveDays(leave.startDate, leave.endDate);
    }
    return totalLeaveDays < limit;
}
function calculateLeaveDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date(startDate);
    const diffTime = end - start;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
}

function validateFullDayLeave({ dayType, startDate, endDate, limit, leaveCategory }) {
    if (!dayType || ![leaveLabelKeys.singleDay, leaveLabelKeys.multipleDay].includes(dayType)) {
        return { success: false, message: "Invalid or missing day type for Full Day." };
    }
    const result = { success: true, dayType };
    if (dayType === leaveLabelKeys.multipleDay) {
        if (!endDate) {
            return { success: false, message: "End date is required." };
        }
        const start = moment(startDate, moment.ISO_8601, true);
        const end = moment(endDate, moment.ISO_8601, true);
        if (!start.isValid() || !end.isValid()) {
            return { success: false, message: "Invalid date format." };
        }
        if (start.isAfter(end)) {
            return { success: false, message: "End date must be greater than or equal to start date." };
        }
        const totalDays = end.diff(start, 'days') + 1;
        if (leaveCategory === leaveLabelKeys.paid && totalDays > limit) {
            return {
                success: false,
                message: `You have requested ${totalDays} days, which exceeds the limit of ${limit} days. This leave will be marked as unpaid.`
            };
        }
        result.hours = `${totalDays * 9} hours`;
        result.endDate = endDate;
    } else {
        result.hours = "9 hours";
        result.endDate = null;
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
        hours: '4.5 hours',
        startTime: null,
        endTime: null
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
    const startDates = moment(startDate);
    const end = moment(endDate || startDate);
    let sandwich = false;
    const isSunday = (date) => date.day() === 0;
    const isSaturday = (date) => date.day() === 6;
    const isFriday = (date) => date.day() === 5;
    const isMonday = (date) => date.day() === 1;
    const getSaturdayIndex = (date) => {
        const month = date.month();
        const year = date.year();
        let count = 0;
        for (let d = 1; d <= date.date(); d++) {
            const current = moment([year, month, d]);
            if (current.day() === 6) {
                count++;
            }
        }
        return count;
    };
    const isHolidaySaturday = (date) => {
        if (!isSaturday(date)) return false;
        const index = getSaturdayIndex(date);
        return index === 2 || index === 4;
    };
    if (isMonday(startDates)) {
        const prev = moment(startDates).subtract(1, 'day');
        if (isSunday(prev)) {
            sandwich = true;
        } else if (isSaturday(prev) && isHolidaySaturday(prev)) {
            const friday = moment(prev).subtract(1, 'day');
            if (isFriday(friday)) {
                sandwich = true;
            }
        }
    }
    if (isFriday(end)) {
        const next = moment(end).add(1, 'day');
        if (isSaturday(next) && isHolidaySaturday(next)) {
            const sunday = moment(next).add(1, 'day');
            if (isSunday(sunday)) {
                sandwich = true;
            }
        }
    }
    if (isSunday(startDates) || isSunday(end)) {
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
        const {
            isUnexpected,
            leaveType,
            leaveCategory,
            startDate,
            endDate,
            reason,
            leaveHalfDayType,
            dayType,
            startTime,
            endTime,
            user
        } = req.body;
        if (!user) {
            return handleError(res, "User is required.", 400);
        }
        if (!leaveCategory || ![leaveLabelKeys.paid, leaveLabelKeys.unpaid].includes(leaveCategory)) {
            return handleError(res, "Invalid or missing leave category.", 400);
        }
        let settings = await AppSettingModel.findOne();
        if (!settings) {
            settings = new AppSettingModel();
        }
        if (leaveCategory === leaveLabelKeys.paid) {
            const monthlyAllowed = await checkLeave(user, startDate, endDate, leaveLabelKeys.paid, settings.appSettings.monthlyMaxPaidLeave, leaveModel, 'monthly');
            if (!monthlyAllowed) {
                return handleError(res, `Only ${settings.appSettings.monthlyMaxPaidLeave} paid leave days allowed per month.`, 400);
            }
            const yearlyAllowed = await checkLeave(user, startDate, endDate, leaveLabelKeys.paid, settings.appSettings.yearlyPaidLeave, leaveModel, 'yearly');
            if (!yearlyAllowed) {
                return handleError(res, `Only ${settings.appSettings.yearlyPaidLeave} paid leave days allowed per year.`, 400);

            }
        }
        if (!leaveType || ![leaveLabelKeys.fullDay, leaveLabelKeys.halfDay, leaveLabelKeys.manualHours].includes(leaveType)) {
            return handleError(res, "Invalid or missing leave type.", 400);
        }
        // const date = /^\d{4}-\d{2}-\d{2}$/;
        if (!startDate) {
            return handleError(res, "Start date is required", 400);
        }
        const leaveData = { user, leaveType, leaveCategory, startDate, isUnexpected, reason };
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
                const validatedData = validateFullDayLeave({
                    dayType: dayType,
                    startDate: req.body.startDate,
                    endDate: req.body.endDate,
                    limit: settings.appSettings.monthlyMaxPaidLeave,
                    leaveCategory
                });

                if (!validatedData.success) {
                    return res.status(400).json({ message: validatedData.message });
                } else {
                    console.log("Leave validation successful:", validatedData);
                }
                leaveData.dayType = validatedData.dayType
                leaveData.endDate = validatedData.endDate
                leaveData.hours = validatedData.hours
            } catch (error) {
                return handleError(res, error.message, 400);
            }
        }
        if (leaveType === leaveLabelKeys.halfDay) {
            try {
                const validatedData = validateHalfDayLeave(leaveHalfDayType, leaveData.startDate);
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
                leaveData.hours = validatedData.hours
            } catch (error) {
                return handleError(res, error.message, 400);
            }
        }
        if (!reason || reason.trim() === '') {
            return handleError(res, "Reason is required.", 400);
        }
        const _startDates = leaveData.startDate;
        const _endDates = leaveData.endDate || _startDates;
        const overlapLeave = await leaveModel.findOne({
            user: leaveData.user,
            $or: [
                {
                    startDate: { $gte: _startDates, $lte: _endDates }
                },
                {
                    endDate: { $gte: _startDates, $lte: _endDates }
                },
                {
                    startDate: { $lte: _startDates },
                    endDate: { $gte: _endDates }
                }
            ]
        });
        if (overlapLeave) {
            return handleError(res, "Leave already exists in this date range.", 400);
        }
        if (!reason || reason.trim() === '') {
            return handleError(res, "Reason is required.", 400);

        }
        leaveData.sandwichLeave = await detectSandwichLeave(
            leaveData.startDate,
            leaveData.endDate,
        );
        const users = await UserModel.findOne({ _id: leaveData.user })
        const commonData = {
            userName: fromCamelCaseToLabel(users.fullName),
            leaveType: fromCamelCaseToLabel(leaveData.leaveType),
            leaveCategory: fromCamelCaseToLabel(leaveData.leaveCategory),
            startDate: leaveData.startDate,
            reason: fromCamelCaseToLabel(leaveData.reason),
        };
        if (leaveData.leaveType === leaveLabelKeys.fullDay) {
            await sendLeaveEmail({
                template: 'leaveAddedFullDay',
                subject: 'Full Day Leave Applied',
                to: settings.appSettings.adminEmail,
                from: users.emailAddress,
                data: {
                    ...commonData,
                    dayType: fromCamelCaseToLabel(leaveData.dayType)
                }
            });
        }
        if (leaveData.leaveType === leaveLabelKeys.halfDay) {
            await sendLeaveEmail({
                template: 'leaveAddedHalfDay',
                subject: 'Half Day Leave Applied',
                to: settings.appSettings.adminEmail,
                from: users.emailAddress,
                data: {
                    ...commonData,
                    leaveDay: 4.5,
                    hours: leaveData.hours,
                    leaveHalfDayType: fromCamelCaseToLabel(leaveData.leaveHalfDayType),
                }
            });
        }
        if (leaveData.leaveType === leaveLabelKeys.manualHours) {
            await sendLeaveEmail({
                template: 'leaveAddedManualHours',
                subject: 'Manual Hour Leave Applied',
                to: settings.appSettings.adminEmail,
                from: users.emailAddress,
                data: {
                    ...commonData,
                    leaveDay: leaveData.hours,
                    leaveHours: leaveData.hours,
                }
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
        return res.status(201).json({ success: true, message: "Leave Added Successfully.", data: leaveList });
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
        const {
            isUnexpected,
            sandwichLeave,
            leaveType,
            leaveCategory,
            startDate,
            endDate,
            reason,
            leaveHalfDayType,
            dayType,
            startTime,
            endTime,
            user
        } = body;
        if (!user) {
            return handleError(res, "User is required.", 400);
        }
        if (body.leaveCategory && ![leaveLabelKeys.paid, leaveLabelKeys.unpaid].includes(body.leaveCategory)) {
            return handleError(res, "Invalid leave category.", 400);
        }
        let settings = await AppSettingModel.findOne();
        if (!settings) {
            settings = new AppSettingModel();
        }
        if (leaveCategory === leaveLabelKeys.paid) {
            const monthlyAllowed = await checkLeave(user, startDate, endDate, leaveLabelKeys.paid, settings.appSettings.monthlyMaxPaidLeave, leaveModel, 'monthly');
            if (!monthlyAllowed) {
                return handleError(res, `Only ${settings.appSettings.monthlyMaxPaidLeave} paid leave days allowed per month.`, 400);
            }
            const yearlyAllowed = await checkLeave(user, startDate, endDate, leaveLabelKeys.paid, settings.appSettings.yearlyPaidLeave, leaveModel, 'yearly');
            if (!yearlyAllowed) {
                return handleError(res, `Only ${settings.appSettings.yearlyPaidLeave} paid leave days allowed per year.`, 400);
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
            sandwichLeave
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
                const validatedData = validateFullDayLeave({
                    dayType: dayType,
                    startDate: req.body.startDate,
                    endDate: req.body.endDate
                });
                Object.assign(leaveData, validatedData);
                leaveData.startTime = null
                leaveData.endTime = null
                leaveData.leaveHalfDayType = null
                if (!validatedData.success) {
                    return res.status(400).json({ message: validatedData.message });
                } else {
                    console.log("Leave validation successful:", validatedData);
                }
            } catch (error) {
                return handleError(res, error.message, 400);
            }
        }
        if (leaveType === leaveLabelKeys.halfDay) {
            try {
                const validatedData = validateHalfDayLeave(leaveHalfDayType, leaveData.startDate);
                leaveData.leaveHalfDayType = validatedData.leaveHalfDayType
                leaveData.hours = validatedData.hours
                leaveData.dayType = null
                leaveData.endDate = null
                leaveData.startTime = null
                leaveData.endTime = null
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
                leaveData.hours = validatedData.hours
                leaveData.dayType = null
                leaveData.leaveHalfDayType = null
                leaveData.endDate = null
            } catch (error) {
                return handleError(res, error.message, 400);
            }
        }
        const existingLeave = await leaveModel.findById(_id);
        const existingStartDate = moment(existingLeave.startDate).format('YYYY-MM-DD');
        const leaveStartDate = moment(leaveData.startDate).format('YYYY-MM-DD');
        const existingEndDate = moment(existingLeave.endDate).format('YYYY-MM-DD');
        const leaveEndDate = moment(leaveData.endDate).format('YYYY-MM-DD');

        // const _startDate = leaveData.startDate;
        // const _endDate = leaveData.endDate || _startDate;
        const _startDate = leaveStartDate;
        const _endDate = leaveData.endDate ? leaveEndDate : leaveStartDate;
        const leaveAddedSameDate = await leaveModel.findOne({
            user: leaveData.user,
            _id: { $ne: _id },
            $or: [
                {
                    startDate: { $gte: _startDate, $lte: _endDate }
                },
                {
                    endDate: { $gte: _startDate, $lte: _endDate }
                },
                {
                    startDate: { $lte: _startDate },
                    endDate: { $gte: _endDate }
                }
            ]
        });
        if (leaveAddedSameDate) {
            return handleError(res, "Leave already exists for selected date range.", 400);
        }
        if (leaveType !== leaveLabelKeys.manualHours) {
            if (req.body.sandwichLeave) {
                leaveData.sandwichLeave = req.body.sandwichLeave;
            } else if (existingStartDate !== leaveStartDate || existingEndDate !== leaveEndDate) {
                leaveData.sandwichLeave = await detectSandwichLeave(
                    leaveData.startDate,
                    leaveData.endDate,
                );
            }
        }

        leaveData.startDate = leaveStartDate;
        leaveData.endDate = leaveEndDate;

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
        const updateData = { status: status };
        if (status === leaveLabelKeys.rejected) {
            updateData.rejectedReason = rejectedReason;
        } else if (status === leaveLabelKeys.pending) {
            updateData.rejectedReason = null;
        } else if (status === leaveLabelKeys.approved) {
            updateData.rejectedReason = null;
        }
        const leaveList = await leaveModel.findByIdAndUpdate(
            { _id: id }, { $set: updateData }, { new: true }
        );
        const userId = leaveList.user
        const user = await UserModel.findOne({ _id: userId })
        const formattedDate = new Date(leaveList.startDate).toISOString().split('T')[0];
        let settings = await AppSettingModel.findOne();
        if (!settings) {
            settings = new AppSettingModel();
        }
        const commonData = {
            userName: fromCamelCaseToLabel(user.fullName),
            leaveType: fromCamelCaseToLabel(leaveList.leaveType),
            leaveCategory: fromCamelCaseToLabel(leaveList.leaveCategory),
            startDate: formattedDate,
            reason: fromCamelCaseToLabel(
                leaveList.status === leaveLabelKeys.rejected ? leaveList.rejectedReason : leaveList.reason
            ),
            status: fromCamelCaseToLabel(leaveList.status)
        };
        if (leaveList.leaveType === leaveLabelKeys.fullDay) {
            await sendLeaveEmail({
                template: 'leaveStatusChangeFullDay',
                subject: '',
                to: user.emailAddress,
                from: settings.appSettings.adminEmail,
                data: {
                    ...commonData,
                    dayType: fromCamelCaseToLabel(leaveList.dayType)
                }
            });
        }
        if (leaveList.leaveType === leaveLabelKeys.halfDay) {
            await sendLeaveEmail({
                template: 'leaveStatusChangeHalfDay',
                subject: '',
                to: user.emailAddress,
                from: settings.appSettings.adminEmail,
                data: {
                    ...commonData,
                    leaveDay: 4.5,
                    hours: leaveList.hours,
                    leaveHalfDayType: fromCamelCaseToLabel(leaveList.leaveHalfDayType),
                }
            });
        }
        if (leaveList.leaveType === leaveLabelKeys.manualHours) {
            await sendLeaveEmail({
                template: 'leaveStatusChange',
                subject: '',
                to: user.emailAddress,
                from: settings.appSettings.adminEmail,
                data: {
                    ...commonData,
                    leaveDay: leaveList.hours,
                    leaveHours: leaveList.hours,
                }
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
            data: {
                totalLeave: `${empLeave.length} Leaves`,
                totalPaidLeave: `${paidLeave.length} Leaves`,
                unexpectedLeave: `${unexpected.length} Leaves`,
                sandwichLeaves: `${sandwichLeaves.length} Leaves`,
                totalLeaveHours: `${totalLeaveHours} Hours`,
            }

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