const {
    handleError, UserRole, userDataQuery,
} = require("../utils/utils");
const moment = require('moment');
const { LeaveModel } = require('../Models/LeaveModel');
const { HolidayEventModel } = require("../Models/HolidayEventModel");
const { UserModel } = require('../Models/UserModel')
const mailer = require('../utils/smtp_mailer');
const ejs = require("ejs");
const { AppSettingModel } = require('../Models/AppSettingModel')
const { transporter, sendLeaveEmail } = require("../utils/smtp_mailer");

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

const isSaturdayRuleOn = false;
const perDayHours = 9;

const convertToCamelCase = (text = '') =>
    text.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

// const getRemainingLeave = async (leaveBody) => {
//     const checkUserPaidLeaveLeave = async (type) => {
//         const date = new Date(leaveBody.startDate);
//         const range = {
//             monthly: [new Date(date.getFullYear(), date.getMonth(), 1), new Date(date.getFullYear(), date.getMonth() + 1, 0)],
//             yearly: [new Date(date.getFullYear(), 0, 1), new Date(date.getFullYear(), 11, 31)],
//         };
//
//         const [start, end] = range[type] || range['monthly'];
//         const startDateOnly = start.toISOString().split('T')[0];
//         const endDateOnly = end.toISOString().split('T')[0];
//
//         const leaves = await LeaveModel.find({
//             user: leaveBody.user,
//             leaveCategory: leaveBody.leaveCategory,
//             $expr: {
//                 $and: [
//                     {$lte: [{$substr: ["$startDate", 0, 10]}, endDateOnly]},
//                     {$gte: [{$substr: ["$endDate", 0, 10]}, startDateOnly]}
//                 ]
//             }
//         });
//         console.log("leaveBody", leaves);
//
//         return leaves.reduce((sum, leave) => sum + calculateLeaveDays(leave.startDate, leave.endDate), 0);
//     };
//
//     const usedYearly = await checkUserPaidLeaveLeave('yearly');
//     const usedMonthly = await checkUserPaidLeaveLeave('monthly');
//
//     return {
//         usedYearly: usedYearly,
//         usedMonthly: usedMonthly,
//     };
// };

const getRemainingLeave = async (leaveBody, id) => {
    const leaveStart = moment(leaveBody.startDate).startOf('day');
    const leaveEnd = leaveBody.endDate ? moment(leaveBody.endDate).endOf('day') : leaveStart.clone().endOf('day');

    const yearStart = leaveStart.clone().startOf('year');
    const yearEnd = leaveStart.clone().endOf('year');

    const monthStart = leaveStart.clone().startOf('month');
    const monthEnd = leaveStart.clone().endOf('month');

    const allLeaves = await LeaveModel.find({
        user: leaveBody.user,
        leaveCategory: leaveLabelKeys.paid,
    });

    const formattedLeave = id ? allLeaves.map(leave => leave._id !== id) : allLeaves;

    let usedYearly = 0;
    let usedMonthly = 0;

    for (const leave of formattedLeave) {
        const leaveStartDate = moment(leave.startDate).startOf('day');
        const leaveEndDate = moment(leave.endDate || leave.startDate).endOf('day');

        for (
            let day = leaveStartDate.clone();
            day.isSameOrBefore(leaveEndDate);
            day.add(1, 'day')
        ) {
            usedYearly++;

            if (day.isBetween(monthStart, monthEnd, undefined, '[]')) {
                usedMonthly++;
            }
        }
    }

    return {
        usedYearly,
        usedMonthly
    };
};


function calculateLeaveDays(startDate, endDate) {
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date(startDate);
    const diffTime = end - start;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

const addUpdateLeave = async (req, res) => {
    try {
        let leaveBody = req.body;
        const { id } = req.params;

        let settings = await AppSettingModel.findOne(undefined, undefined, undefined);
        if (!settings) {
            settings = new AppSettingModel();
        }

        let dbLeave = null;
        if (id) {
            dbLeave = await LeaveModel.findById(id);
            if (!dbLeave) {
                return handleError(res, "Leave not found", 400);
            }
        }

        if (id && dbLeave) {
            leaveBody = {
                ...dbLeave._doc,
                ...leaveBody
            };
        }

        const yearlyLimit = settings?.appSettings?.yearlyPaidLeave ?? 0;
        const monthlyLimit = settings?.appSettings?.monthlyMaxPaidLeave ?? 0;

        if (!leaveBody.user) {
            return handleError(res, "User is required", 400);
        }

        if (!leaveBody.reason) {
            return handleError(res, "Reason is required.", 400);
        }

        if (!leaveBody.startDate) {
            return handleError(res, "Start date is required.", 400);
        }

        if (!leaveBody.leaveCategory || ![leaveLabelKeys.paid, leaveLabelKeys.unpaid].includes(leaveBody.leaveCategory)) {
            return handleError(res, `Leave category is required.(Ex: ${convertToCamelCase(leaveLabelKeys.paid)} or ${convertToCamelCase(leaveLabelKeys.unpaid)})`, 400);
        }

        if (leaveBody.leaveType) {
            if (leaveBody.leaveType === leaveLabelKeys.fullDay) {
                if (!leaveBody.dayType) {
                    return handleError(res, `Day type is required.(Ex: ${convertToCamelCase(leaveLabelKeys.singleDay)} or ${convertToCamelCase(leaveLabelKeys.multipleDay)})`, 400);
                }

                if (leaveBody.dayType === leaveLabelKeys.multipleDay) {
                    if (!leaveBody.endDate) {
                        return handleError(res, "End date is required.", 400);
                    }

                    if (moment(leaveBody.startDate).isAfter(moment(leaveBody.endDate))) {
                        return handleError(res, "End date must be greater than or equal to start date.", 400);
                    }
                }
            }

            if (leaveBody.leaveType === leaveLabelKeys.halfDay) {
                if (!leaveBody.leaveHalfDayType) {
                    return handleError(res, `Half day type is required.(Ex: ${convertToCamelCase(leaveLabelKeys.firstHalf)} or ${convertToCamelCase(leaveLabelKeys.secondHalf)})`, 400);
                }
            }

            if (leaveBody.leaveType === leaveLabelKeys.manualHours) {
                if (!leaveBody.startTime) {
                    return handleError(res, "Start time is required.", 400);
                }

                if (!leaveBody.endTime) {
                    return handleError(res, "End time is required.", 400);
                }

                const startTime = moment(leaveBody.startTime, "hh:mm A");
                const endTime = moment(leaveBody.endTime, "hh:mm A");

                if (startTime.isAfter(endTime)) {
                    return handleError(res, "End time must be greater than or equal to start time.", 400);
                }
            }
        } else {
            return handleError(res, `Leave type is required.(Ex: ${convertToCamelCase(leaveLabelKeys.fullDay)} or ${convertToCamelCase(leaveLabelKeys.halfDay)} or ${convertToCamelCase(leaveLabelKeys.manualHours)})`, 400);
        }

        const startDateStr = moment(leaveBody.startDate).format('YYYY-MM-DD');
        const endDateStr = leaveBody.endDate ? moment(leaveBody.endDate).format('YYYY-MM-DD') : startDateStr;

        const leaveQuery = {
            user: leaveBody.user,
            _id: { $ne: id },
            $or: [
                {
                    startDate: { $lte: endDateStr },
                    endDate: { $gte: startDateStr }
                },
                {
                    startDate: startDateStr
                }
            ]
        };

        const existingLeave = await LeaveModel.findOne(leaveQuery);

        if (!id && existingLeave) {
            return handleError(res, `Leave already exists for the selected date(s).`, 400);
        }

        if (id && existingLeave) {
            return handleError(res, `Another leave already exists for the selected date(s).`, 400);
        }

        if (leaveBody.startDate) {
            leaveBody.startDate = moment(leaveBody.startDate).format('YYYY-MM-DD');
        }

        if (leaveBody.endDate) {
            leaveBody.endDate = moment(leaveBody.endDate).format('YYYY-MM-DD');
        }

        if (leaveBody.leaveCategory === leaveLabelKeys.paid) {
            const result = await getRemainingLeave(leaveBody, id);
            if ((yearlyLimit - result.usedYearly) <= 0) {
                return handleError(res, `Yearly paid leave limit exceeded. Max allowed: ${yearlyLimit}`, 400);
            }
            if ((monthlyLimit - result.usedMonthly) <= 0) {
                return handleError(res, `Monthly paid leave limit exceeded. Max allowed: ${monthlyLimit}`, 400);
            }
            if (leaveBody.dayType === leaveLabelKeys.multipleDay) {
                const totalDays = moment(leaveBody.endDate).diff(moment(leaveBody.startDate), 'days') + 1;
                const remainingLeave = monthlyLimit - result.usedMonthly;
                console.log("remainingLeave", remainingLeave, totalDays)
                if (totalDays > monthlyLimit) {
                    return handleError(res, `You have requested ${totalDays} days, which exceeds the limit of ${monthlyLimit} days. This leave will be marked as unpaid.`, 400);
                }
                if (remainingLeave < totalDays) {
                    return handleError(res, `You have requested ${totalDays} days, but you have only ${remainingLeave} paid leave. This leave will be marked as unpaid.`, 400);
                }
            }
            leaveBody.isDeductible = false;
        }

        // if(id) {
        //     leaveBody.isUnexpected = !!(leaveBody.createdAt && moment(leaveBody.createdAt).diff(moment(), 'day') < 3);
        // } else {
        //     leaveBody.isUnexpected = !!(leaveBody.startDate && moment(leaveBody.startDate).diff(moment(), 'day') < 3);
        // }

        if (!id) {
            leaveBody.isUnexpected = !!(leaveBody.startDate && moment(leaveBody.startDate).diff(moment(), 'day') < 3);
        }

        if (leaveBody.leaveType === leaveLabelKeys.fullDay) {
            if (leaveBody.dayType === leaveLabelKeys.singleDay) {
                leaveBody.hours = `${perDayHours} hours`;
                leaveBody.endDate = null;
                leaveBody.startTime = null;
                leaveBody.endTime = null;
            }

            if (leaveBody.dayType === leaveLabelKeys.multipleDay) {
                const totalDays = moment(leaveBody.endDate).diff(moment(leaveBody.startDate), 'days') + 1;
                leaveBody.hours = `${totalDays * perDayHours} hours`;
                leaveBody.startTime = null;
                leaveBody.endTime = null;
            }
        }

        if (leaveBody.leaveType === leaveLabelKeys.halfDay) {
            if (isSaturdayRuleOn && moment(leaveBody.startDate).day() === 6) {
                return handleError(res, "Half Day leave is not allowed on Saturdays.", 400);
            }
            leaveBody.hours = `${perDayHours / 2} hours`;
            leaveBody.endDate = null;
        }

        if (leaveBody.leaveType === leaveLabelKeys.manualHours) {
            const startTime = moment(leaveBody.startTime, "hh:mm A");
            const endTime = moment(leaveBody.endTime, "hh:mm A");

            if (!startTime.isValid() || !endTime.isValid()) {
                return handleError(res, "Invalid time format. Use hh:mm AM/PM format.", 400);
            }

            const duration = moment.duration(endTime.diff(startTime));
            const totalMinutes = duration.asMinutes();

            const isSaturday = startTime.day() === 6;
            const maxMinutes = isSaturdayRuleOn ? (isSaturday ? 60 : 180) : 180;

            if (totalMinutes > maxMinutes) {
                if (isSaturdayRuleOn && isSaturday) {
                    return handleError(res, "'Manual Hours' leave cannot exceed 1 hour on Saturdays.", 400);
                } else {
                    return handleError(res, "For 'Manual Hours' leave type, the total duration cannot exceed 3 hours.", 400);
                }
            }

            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;

            leaveBody.hours = minutes > 0
                ? `${hours} hours ${minutes} minutes`
                : `${hours} hours`;

            leaveBody.sandwichLeave = false;
        }

        if (leaveBody.leaveType !== leaveLabelKeys.manualHours) {
            let isSandwichLeave = await checkSandwichLeave({ dbStartDate: leaveBody.startDate, dbEndDate: leaveBody.endDate });
            // const startDate = moment(leaveBody.startDate);
            // const endDate = moment(leaveBody.endDate || leaveBody.startDate);
            // let isSandwichLeave = false;
            //
            // const allHolidays = await HolidayEventModel.find({ isLeaveOnDay: true }).lean();
            //
            // for (const holiday of allHolidays) {
            //     const holidayDate = moment(holiday.eventDate);
            //
            //     const isHolidayBetween = holidayDate.isBetween(startDate, endDate, undefined, '[]');
            //     const isBeforeHoliday = endDate.isSame(holidayDate.clone().subtract(1, 'day'));
            //     const isAfterHoliday = startDate.isSame(holidayDate.clone().add(1, 'day'));
            //
            //     if (isHolidayBetween || isBeforeHoliday || isAfterHoliday) {
            //         isSandwichLeave = true;
            //         break;
            //     }
            // }

            if (id) {
                if (dbLeave != null) {
                    const startDate = moment(dbLeave.startDate).format("YYYY-MM-DD");
                    const endDate = dbLeave.endDate ? moment(dbLeave.endDate).format("YYYY-MM-DD") : null;
                    console.log("req.body.sandwichLeave", req.body.sandwichLeave)
                    if (req.body.sandwichLeave === true) {
                        if (!isSandwichLeave) {
                            return handleError(res, "The selected date range leave is not add in sandwich leave", 400);
                        } else {
                            leaveBody.sandwichLeave = true;
                        }
                    } else if (req.body.sandwichLeave === false) {
                        leaveBody.sandwichLeave = false;
                    } else {
                        if (startDate !== leaveBody.startDate || endDate !== leaveBody.endDate) {
                            leaveBody.sandwichLeave = isSandwichLeave;
                        }
                    }
                }
            } else {
                leaveBody.sandwichLeave = isSandwichLeave;
            }
        }

        let leaveApiMessage;

        if (leaveBody.leaveCategory === leaveLabelKeys.paid) {
            leaveBody.sandwichLeave = false;
            leaveBody.isUnexpected = false;
            leaveBody.isDeductible = false;
        }

        if (id) {
            await LeaveModel.findByIdAndUpdate({ _id: id }, leaveBody);
            leaveApiMessage = "Leave updated successfully.";
        } else {

            const users = await UserModel.findOne({ _id: leaveBody.user })
            const commonData = {
                userName: convertToCamelCase(users.fullName),
                leaveType: convertToCamelCase(leaveBody.leaveType),
                leaveCategory: convertToCamelCase(leaveBody.leaveCategory),
                startDate: leaveBody.startDate,
                reason: convertToCamelCase(leaveBody.reason),
            };
            if (leaveBody.leaveType === leaveLabelKeys.fullDay) {
                await sendLeaveEmail({
                    template: 'leaveAddedFullDay',
                    subject: 'Full Day Leave Applied',
                    to: settings.appSettings.adminEmail,
                    from: users.emailAddress,
                    data: {
                        ...commonData,
                        dayType: convertToCamelCase(leaveBody.dayType)
                    }
                });
            }
            if (leaveBody.leaveType === leaveLabelKeys.halfDay) {
                await sendLeaveEmail({
                    template: 'leaveAddedHalfDay',
                    subject: 'Half Day Leave Applied',
                    to: settings.appSettings.adminEmail,
                    from: users.emailAddress,
                    data: {
                        ...commonData,
                        leaveDay: 4.5,
                        hours: leaveBody.hours,
                        leaveHalfDayType: convertToCamelCase(leaveBody.leaveHalfDayType),
                    }
                });
            }
            if (leaveBody.leaveType === leaveLabelKeys.manualHours) {
                await sendLeaveEmail({
                    template: 'leaveAddedManualHours',
                    subject: 'Manual Hour Leave Applied',
                    to: settings.appSettings.adminEmail,
                    from: users.emailAddress,
                    data: {
                        ...commonData,
                        leaveDay: leaveBody.hours,
                        leaveHours: leaveBody.hours,
                    }
                });
            }

            await LeaveModel.create(leaveBody);
            leaveApiMessage = "Leave Added Successfully.";
        }

        await updateLeaveDeductHours(leaveBody.user);
        const loginUser = req.user;

        let leaveList;
        if (loginUser.role === UserRole.Admin) {
            leaveList = await LeaveModel.find({}).populate('user', userDataQuery);
        } else {
            leaveList = await LeaveModel.find({ user: userID }).populate('user', userDataQuery);
        }
        return res.status(201).json({ success: true, message: leaveApiMessage, data: leaveList });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

async function updateLeaveDeductHours(userId) {
    const userLeaves = await LeaveModel.find({ user: userId });

    let totalUnexpectedCount = 0;
    let totalUnexpectedDays = 0;

    for (const leave of userLeaves) {
        const rawHours = parseFloat(leave.hours.split(' ')[0]);
        const start = moment(leave.startDate);
        const end = leave.endDate ? moment(leave.endDate) : start;
        const leaveDays = end.diff(start, 'days') + 1;

        const baseDailyHours = rawHours > 9 ? rawHours / leaveDays : rawHours;

        const dateArray = [];
        const current = moment(start);

        while (current.isSameOrBefore(end, 'day')) {
            const leaveDate = current.format('YYYY-MM-DD');
            let dayHours = baseDailyHours;

            if (leave.isUnexpected) {
                totalUnexpectedCount++;
                totalUnexpectedDays++;

                if (totalUnexpectedDays > 12) {
                    dayHours *= 3;
                } else if (totalUnexpectedCount > 4) {
                    dayHours *= 2;
                }
            }

            if (leave.leaveCategory === leaveLabelKeys.paid) {
                dayHours = dayHours - baseDailyHours;
            }

            dateArray.push({
                date: leaveDate,
                deductHours: dayHours,
                deductMinutes: dayHours > 0 ? dayHours * 60 : 0,
            });

            current.add(1, 'days');
        }

        if (leave.sandwichLeave && dateArray.length > 1) {
            dateArray[dateArray.length - 1].deductHours += 9;
            dateArray[dateArray.length - 1].deductMinutes += (9 * 60);
        }

        if (leave.sandwichLeave && dateArray.length === 1) {
            dateArray[0].deductHours += 9;
            dateArray[0].deductMinutes += (9 * 60);
        }

        leave.deductHoursDateWise = dateArray;

        leave.deductMinutes = dateArray.reduce((sum, day) => (sum + day.deductHours) * 60, 0);
        leave.deductHours = dateArray.reduce((sum, day) => sum + day.deductHours, 0);

        // console.log("dateArray", dateArray);

        await leave.save();
    }
}

// const sendLeaveEmail = async ({ template, subject, to, from, data }) => {
//     try {
//         const html = await ejs.renderFile(`emailtemplates/${template}.ejs`, data);
//         await mailer.sendmail({ from, to, subject, html });
//         console.log("Email sent successfully");
//     } catch (error) {
//         console.error("Failed to send email:", error);
//     }
// };

const checkSandwichLeave = async ({ dbStartDate, dbEndDate }) => {
    const startDate = moment(dbStartDate);
    const endDate = moment(dbEndDate || dbStartDate);
    let isSandwichLeave = false;

    const allHolidays = await HolidayEventModel.find({ isLeaveOnDay: true }).lean();

    for (const holiday of allHolidays) {
        const holidayDate = moment(holiday.eventDate);

        const isHolidayBetween = holidayDate.isBetween(startDate, endDate, undefined, '[]');
        const isBeforeHoliday = endDate.isSame(holidayDate.clone().subtract(1, 'day'));
        const isAfterHoliday = startDate.isSame(holidayDate.clone().add(1, 'day'));

        if (isHolidayBetween || isBeforeHoliday || isAfterHoliday) {
            isSandwichLeave = true;
        }
    }

    return isSandwichLeave;
}

const prepareAndSendLeaveEmail = async ({ leaveData, settings, triggeredBy = 'user' }) => {
    const user = await UserModel.findById(leaveData.user, undefined, undefined).lean();

    const commonData = {
        userName: convertToCamelCase(user.fullName),
        leaveType: convertToCamelCase(leaveData.leaveType),
        leaveCategory: convertToCamelCase(leaveData.leaveCategory),
        startDate: leaveData.startDate,
        reason: convertToCamelCase(leaveData.reason),
    };

    const emailOptions = {
        fullDay: {
            template: 'leaveAddedFullDay',
            subject: 'Full Day Leave Applied',
            data: {
                ...commonData,
                dayType: convertToCamelCase(leaveData.dayType),
            }
        },
        halfDay: {
            template: 'leaveAddedHalfDay',
            subject: 'Half Day Leave Applied',
            data: {
                ...commonData,
                leaveDay: 4.5,
                hours: leaveData.hours,
                leaveHalfDayType: convertToCamelCase(leaveData.leaveHalfDayType),
            }
        },
        manualHours: {
            template: 'leaveAddedManualHours',
            subject: 'Manual Hour Leave Applied',
            data: {
                ...commonData,
                leaveDay: leaveData.hours,
                leaveHours: leaveData.hours,
            }
        }
    };

    const leaveTypeKey = leaveData.leaveType;
    const emailConfig = emailOptions[leaveTypeKey];

    if (emailConfig) {
        await sendLeaveEmail({
            template: emailConfig.template,
            subject: emailConfig.subject,
            to: settings.appSettings.adminEmail,
            from: triggeredBy === 'admin' ? settings.appSettings.adminEmail : user.emailAddress,
            data: emailConfig.data
        });
    }
};

// const getNewLeave = async (req, res) => {
//     try {
//         const fetch = (await import('node-fetch')).default;
//
//         const response = await fetch('https://leave.teqheal.com/api/get-old-leave');
//         const json = await response.json();
//         const oldData = json.data;
//         const newData = [];
//         const perDayHours = 8;
//
//         for (let leave of oldData) {
//             let dayType = leave.leave_day === 1 ? "singleDay" : "multipleDay";
//
//             const transformedLeave = {
//                 user: leave.u_id,
//                 leaveType: mapLeaveType(leave.leave_type),
//                 leaveHalfDayType: mapHalfDayType(leave.fullday_leave_type, leave.halfday_leave_type),
//                 hours: `${leave.leaves} hours`,
//                 dayType,
//                 startDate: leave.start_date,
//                 endDate: leave.end_date,
//                 startTime: leave.hour_start_time,
//                 endTime: leave.hour_end_time,
//                 leaveCategory: mapLeaveCategory(leave.leave_category),
//                 status: mapLeaveStatus(leave.status),
//                 reason: leave.reason,
//                 rejectedReason: leave.reject_reason,
//                 isUnexpected: leave.is_unexpected === 1,
//                 sandwichLeave: leave.is_sandwich === 1,
//                 isDeductible: leave.is_count === 1
//             };
//
//             if (dayType === 'singleDay') {
//                 transformedLeave.hours = `${perDayHours} hours`;
//                 transformedLeave.endDate = null;
//                 transformedLeave.startTime = null;
//                 transformedLeave.endTime = null;
//             }
//
//             if (dayType === 'multipleDay') {
//                 const totalDays = moment(leave.end_date).diff(moment(leave.start_date), 'days') + 1;
//                 transformedLeave.hours = `${totalDays * perDayHours} hours`;
//                 transformedLeave.startTime = null;
//                 transformedLeave.endTime = null;
//             }
//
//             const savedLeave = new LeaveModel(transformedLeave);
//             await savedLeave.save();
//
//             newData.push(savedLeave);
//         }
//
//         return res.status(200).json({
//             success: true,
//             message: 'Leaves stored successfully.',
//             data: newData
//         });
//
//     } catch (err) {
//         return res.status(500).json({
//             success: false,
//             message: err.message,
//         });
//     }
// };
//
// const mapLeaveType = (leaveType) => {
//     switch (leaveType) {
//         case 1:
//             return "fullDay";
//         case 2:
//             return "halfDay";
//         case 3:
//             return "manualHours";
//         default:
//             return "null";
//     }
// };
//
// const mapHalfDayType = (fullDayType, halfDayType) => {
//     if (fullDayType === 1) return "firstHalf";
//     if (halfDayType === 2) return "secondHalf";
//     return "null";
// };
//
// const mapLeaveCategory = (category) => {
//     switch (category) {
//         case 1:
//             return "paid";
//         case 2:
//             return "unpaid";
//         default:
//             return "null";
//     }
// };
//
// const mapLeaveStatus = (status) => {
//     switch (status) {
//         case 1:
//             return "pending";
//         case 2:
//             return "approved";
//         case 3:
//             return "rejected";
//         default:
//             return "null";
//     }
// };

module.exports = {
    addUpdateLeave,
    checkSandwichLeave,
    updateLeaveDeductHours,
}