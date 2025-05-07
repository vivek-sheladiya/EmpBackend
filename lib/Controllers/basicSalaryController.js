const {
    handleError,
} = require("../utils/utils");
const moment = require('moment');
const mongoose = require('mongoose');

const { basicSalaryModel } = require('../Models/basicSalaryModel');
const { salaryReportModel } = require('../Models/salaryReportModel');
const { leaveModel } = require('../Models/LeaveModel');
const { manualHoursModel } = require('../Models/manualHoursModel');
const { HolidayEventModel } = require("../Models/HolidayEventModel");
const { AppSettingModel } = require("../Models/AppSettingModel");
const { punchReportModel } = require("../Models/punchReportModel");
const {decrypt} = require("../../encryptSalary");

const formatLeaveList = (leaveList) => {
    return leaveList.map(leave => ({
        ...leave._doc,
        user: {
            userId: leave.user._id,
            fullName: leave.user.fullName
        }
    }));
};
const basicSalaryList = async (req, res) => {
    try {
        const basicSalaryList = await basicSalaryModel.find({}).populate('user', 'fullName');
        const formattedLeave = formatLeaveList(basicSalaryList);
        return res.status(201).json({ success: true, message: "Basic Salary List Get Successfully.", data: formattedLeave });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

const addUpdateBasicSalary = async (req, res) => {
    try {
        const id = req.params._id;
        const { user, startDate, basicSalary, code } = req.body;

        if (!id) {
            if (!user) return handleError(res, "User is required.", 400);
            if (!startDate) {
                return handleError(res, "Start date is required", 400);
            }
            if (!basicSalary || !code) {
                return handleError(res, "basic salary and code is required.", 400);
            }
            const basicSalaryAdd = await basicSalaryModel.create(req.body);
            const basicSalaryList = await basicSalaryModel.find({}).populate('user', 'fullName');
            const formattedLeave = formatLeaveList(basicSalaryList);
            return res.status(201).json({ success: true, message: "Basic Salary Added Successfully.", data: formattedLeave });
        } else {
            if (!startDate) {
                return handleError(res, "Start date is required", 400);
            }
            const basicSalaryUpdate = await basicSalaryModel.findByIdAndUpdate({ _id: id }, req.body, { new: true });
            const basicSalaryList = await basicSalaryModel.find({}).populate('user', 'fullName');
            const formattedLeave = formatLeaveList(basicSalaryList);
            return res.status(201).json({ success: true, message: "Basic Salary Updated Successfully.", data: formattedLeave });
        }
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

const deleteBasicSalary = async (req, res) => {
    try {
        const id = req.params._id;
        const basicSalaryDelete = await basicSalaryModel.findByIdAndDelete({ _id: id })
        if (!basicSalaryDelete) {
            return handleError(res, "basic salary not found.", 400);
        }
        const dataList = await basicSalaryModel.find({}).populate('user', 'fullName');
        const formattedLeave = formatLeaveList(dataList);
        return res.status(201).json({ success: true, message: "Basic Salary Deleted Successfully.", data: formattedLeave });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

const generateSalaryReports = async (req, res) => {
    try {
        const { users, years, months, deduct, bonus } = req.body;

        let user = req.params.user || req.query.user;
        let year = req.params.year || req.query.year;
        let month = req.params.month || req.query.month;

        // Validate ObjectId
        if (user && !mongoose.Types.ObjectId.isValid(user)) {
            if (!year && !month) {
                year = user;
                user = undefined;
            } else {
                user = undefined;
            }
        }

        let start, end;
        if (year && month) {
            const paddedMonth = String(month).padStart(2, '0');
            const startDate = new Date(`${year}-${paddedMonth}-01T00:00:00.000Z`);
            const endDate = moment(startDate).add(1, 'month').toDate();
            start = moment(startDate).format('YYYY-MM-DD');
            end = moment(endDate).format('YYYY-MM-DD');
        } else if (year) {
            const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
            const endDate = new Date(`${parseInt(year) + 1}-01-01T00:00:00.000Z`);
            start = moment(startDate).format('YYYY-MM-DD');
            end = moment(endDate).format('YYYY-MM-DD');
        }

        const today = moment();
        const lastMonth = moment().subtract(1, 'month');
        const allBasicSalaries = await basicSalaryModel.find().populate('user', 'fullName');

        const newReports = [];
        for (const item of allBasicSalaries) {
            const salaryStartDate = moment(item.startDate).startOf('month');
            let iterDate = moment(salaryStartDate);

            while (iterDate.isSameOrBefore(lastMonth, 'month')) {
                const startOfMonth = moment(iterDate).startOf('month');
                const endOfMonth = moment(iterDate).endOf('month');

                const effectiveStartDate = moment.max(startOfMonth, salaryStartDate);
                const effectiveEndDate = moment.min(endOfMonth, today);

                const effectiveStartDate1 = effectiveStartDate.format('YYYY-MM-DD');
                const effectiveEndDate1 = effectiveEndDate.format('YYYY-MM-DD');

                const durationDays = effectiveEndDate.diff(effectiveStartDate, 'days') + 1;
                const totalWorkingHours = durationDays * 9;

                const userLeave = await leaveModel.find({
                    user: item.user,
                    startDate: { $gte: effectiveStartDate1, $lte: effectiveEndDate1 },
                    status: 'approved'
                });

                const allHolidays = await HolidayEventModel.find({ isLeaveOnDay: true }).lean();

                const reportDates = `${years}-${String(months).padStart(2, '0')}-01`;

                const totalLeaveHours = calculateTotalLeaveHours(userLeave, allHolidays);
                const hourlyRate = item.basicSalary / totalWorkingHours;
                let leaveDeduction = Math.round(totalLeaveHours * hourlyRate);

                console.log("leaveDeduction", leaveDeduction);

                // if (updateDeduct) {
                //     console.log("Updating deduction");
                //     let deductValue = leaveDeduction + Number(deduct) - Number(bonus);
                //     leaveDeduction = deductValue;
                //     console.log("Updated deductValue (leaveDeduction)", leaveDeduction);
                // }
                const isTargetUser = users?.includes(String(item.user._id)) &&
                    String(iterDate.format("YYYY")) === String(years) &&
                    String(iterDate.format("MM")) === String(months);

                if (isTargetUser) {
                    let deductValue = leaveDeduction + Number(deduct) - Number(bonus);
                    leaveDeduction = deductValue;
                }
                console.log("leaveDeduction after if check", leaveDeduction);
                const netSalary = Math.max(Math.round(item.basicSalary - leaveDeduction), 0);
                console.log("Net Salary:", netSalary);

                const reportDate = startOfMonth.format("YYYY-MM-DD");
                const reportData = {
                    user: item.user._id,
                    userName: item.user.fullName,
                    basicSalary: item.basicSalary,
                    leaveHours: totalLeaveHours,
                    deductionAmount: leaveDeduction,
                    netSalary: netSalary,
                    date: reportDate,
                    reportType: 'leaveWise'
                };

                const existingReport = await salaryReportModel.findOne({
                    user: item.user._id,
                    date: reportDate,
                });

                if (existingReport) {
                    await salaryReportModel.updateOne(
                        { _id: existingReport._id },
                        { $set: reportData }
                    );
                } else {
                    newReports.push(reportData);
                }

                iterDate.add(1, 'month');
            }
        }

        if (newReports.length > 0) {
            await salaryReportModel.insertMany(newReports);
        }

        const filters = {};
        if (user) filters.user = user;
        if (start && end) filters.date = { $gte: start, $lt: end };

        const dataList = await salaryReportModel
            .find(filters)
            .populate('user', 'fullName');

        const formattedLeave = formatLeaveList(dataList);
        return res.status(201).json({
            success: true,
            message: "Salary reports generated.",
            data: formattedLeave,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
};


// const generateSalaryReports = async (req, res) => {
//     try {
//         let user = req.params.user || req.query.user;
//         let year = req.params.year || req.query.year;
//         let month = req.params.month || req.query.month;
//         if (user && !mongoose.Types.ObjectId.isValid(user)) {
//             if (!year && !month) {
//                 year = user;
//                 user = undefined;
//             } else {
//                 user = undefined;
//             }
//         }
//         const filter = user ? { user } : {};
//         let start, end;
//         if (year && month) {
//             const paddedMonth = String(month).padStart(2, '0');
//             const startDate = new Date(`${year}-${paddedMonth}-01T00:00:00.000Z`);
//             const endDate = moment(startDate).add(1, 'month').toDate();
//             start = moment(startDate).format('YYYY-MM-DD');
//             end = moment(endDate).format('YYYY-MM-DD');
//         } else if (year) {
//             const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
//             const endDate = new Date(`${parseInt(year) + 1}-01-01T00:00:00.000Z`);
//             start = moment(startDate).format('YYYY-MM-DD');
//             end = moment(endDate).format('YYYY-MM-DD');
//         }
//         const today = moment();
//         const lastMonth = moment().subtract(1, 'month');
//         const allBasicSalaries = await basicSalaryModel.find().populate('user', 'fullName');
//         const newReports = [];
//         for (const item of allBasicSalaries) {
//             const salaryStartDate = moment(item.startDate).startOf('month');
//             let iterDate = moment(salaryStartDate);
//             while (iterDate.isSameOrBefore(lastMonth, 'month')) {
//                 const startOfMonth = moment(iterDate).startOf('month');
//                 const endOfMonth = moment(iterDate).endOf('month');
//                 const effectiveStartDate = moment.max(startOfMonth, salaryStartDate);
//                 const effectiveEndDate = moment.min(endOfMonth, today);
//                 const effectiveStartDate1 = effectiveStartDate.format('YYYY-MM-DD');
//                 const effectiveEndDate1 = effectiveEndDate.format('YYYY-MM-DD');
//                 const durationDays = effectiveEndDate.diff(effectiveStartDate, 'days') + 1;
//                 const totalWorkingHours = durationDays * 9;
//                 const userLeave = await leaveModel.find({
//                     user: item.user,
//                     startDate: { $gte: effectiveStartDate1, $lte: effectiveEndDate1 },
//                     status: 'approved'
//                 });
//                 const allHolidays = await HolidayEventModel.find({ isLeaveOnDay: true }).lean();
//
//                 const totalLeaveHours = calculateTotalLeaveHours(userLeave, allHolidays);
//
//                 const hourlyRate = item.basicSalary / totalWorkingHours;
//                 const leaveDeduction = Math.round(totalLeaveHours * hourlyRate);
//                 const netSalary = Math.max(Math.round(item.basicSalary - leaveDeduction), 0);
//                 const reportDate = startOfMonth.format("YYYY-MM-DD");
//                 const reportData = {
//                     user: item.user._id,
//                     userName: item.user.fullName,
//                     basicSalary: item.basicSalary,
//                     leaveHours: totalLeaveHours,
//                     deductionAmount: parseFloat(leaveDeduction.toFixed(2)),
//                     netSalary: parseFloat(netSalary.toFixed(2)),
//                     date: reportDate,
//                     salaryReportType: 'leaveWise'
//                 };
//                 const existingReport = await salaryReportModel.findOne({
//                     user: item.user._id,
//                     date: reportDate,
//                 });
//                 if (existingReport) {
//                     await salaryReportModel.updateOne(
//                         { _id: existingReport._id },
//                         { $set: reportData }
//                     );
//                 } else {
//                     newReports.push(reportData);
//                 }
//                 iterDate.add(1, 'month');
//             }
//         }
//         if (newReports.length > 0) {
//             await salaryReportModel.insertMany(newReports);
//         }
//         const dateFilter = (start && end) ? { date: { $gte: start, $lt: end } } : {};
//         const dataList = await salaryReportModel
//             .find({
//                 ...filter,
//                 ...dateFilter
//             })
//             .populate('user', 'fullName');
//
//         const formattedLeave = formatLeaveList(dataList);
//         return res.status(201).json({
//             success: true,
//             message: "Salary reports generated.",
//             data: formattedLeave,
//         });
//     } catch (err) {
//         return res.status(500).json({
//             success: false,
//             message: err.message,
//         });
//     }
// };

function calculateTotalLeaveHours(userLeaves) {
    userLeaves.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    let totalUnexpectedCount = 0;
    let totalUnexpectedDays = 0;
    let totalHours = 0;
    let sandwichBlockActive = false;

    for (const leave of userLeaves) {
        if (!leave.hours) continue;

        const rawHours = parseFloat(leave.hours.split(' ')[0]);
        if (isNaN(rawHours)) continue;

        let effectiveHours = rawHours;

        // --- Sandwich Leave Bonus: only once per continuous block ---
        if (leave.sandwichLeave) {
            if (!sandwichBlockActive) {
                effectiveHours += 9;
                sandwichBlockActive = true;
            }
            // else: do not add bonus again
        } else {
            sandwichBlockActive = false; // reset sandwich block
        }

        // --- Unexpected Leave Penalty ---
        if (leave.isUnexpected) {
            totalUnexpectedCount++;

            const start = moment(leave.startDate);
            const end = leave.endDate ? moment(leave.endDate) : start;
            const leaveDays = end.diff(start, 'days') + 1;
            totalUnexpectedDays += leaveDays;

            if (totalUnexpectedDays > 12) {
                effectiveHours *= 3;
            } else if (totalUnexpectedCount > 4) {
                effectiveHours *= 2;
            }
        }

        totalHours += effectiveHours;
    }

    return totalHours;
}

// const leaveWiseSalaryReports = async (salaryReportType) => {
//     const today = moment();
//     const lastMonth = moment().subtract(1, 'month');
//     const allBasicSalaries = await basicSalaryModel.find().populate('user', 'fullName');

//     const newReports = [];

//     for (const item of allBasicSalaries) {
//         const salaryStartDate = moment(item.startDate).startOf('month');
//         let iterDate = moment(salaryStartDate);

//         while (iterDate.isSameOrBefore(lastMonth, 'month')) {
//             const startOfMonth = moment(iterDate).startOf('month');
//             const endOfMonth = moment(iterDate).endOf('month');

//             const effectiveStartDate = moment.max(startOfMonth, salaryStartDate);
//             const effectiveEndDate = moment.min(endOfMonth, today);

//             const effectiveStartDate1 = effectiveStartDate.format('YYYY-MM-DD');
//             const effectiveEndDate1 = effectiveEndDate.format('YYYY-MM-DD');

//             const durationDays = effectiveEndDate.diff(effectiveStartDate, 'days') + 1;
//             const totalWorkingHours = durationDays * 9;

//             const userLeave = await leaveModel.find({
//                 user: item.user,
//                 startDate: { $gte: effectiveStartDate1, $lte: effectiveEndDate1 },
//                 status: 'approved'
//             });

//             const allHolidays = await HolidayEventModel.find({ isLeaveOnDay: true }).lean();

//             const totalLeaveHours = calculateTotalLeaveHours(userLeave, allHolidays);
//             const hourlyRate = item.basicSalary / totalWorkingHours;
//             const leaveDeduction = Math.round(totalLeaveHours * hourlyRate);
//             const netSalary = Math.max(Math.round(item.basicSalary - leaveDeduction), 0);

//             const reportDate = startOfMonth.format("YYYY-MM-DD");
//             const reportData = {
//                 user: item.user._id,
//                 userName: item.user.fullName,
//                 basicSalary: item.basicSalary,
//                 leaveHours: totalLeaveHours,
//                 deductionAmount: leaveDeduction,
//                 netSalary: netSalary,
//                 date: reportDate,
//                 salaryReportType
//             };

//             const existingReport = await salaryReportModel.findOne({
//                 user: item.user._id,
//                 date: reportDate,
//             });

//             if (existingReport) {
//                 await salaryReportModel.updateOne(
//                     { _id: existingReport._id },
//                     { $set: reportData }
//                 );
//             } else {
//                 newReports.push(reportData);
//             }

//             iterDate.add(1, 'month');
//         }
//     }

//     if (newReports.length > 0) {
//         await salaryReportModel.insertMany(newReports);
//     }
// };



// const allTypeWiseSalaryReports = async (req, reportType) => {
//
//     let user = req.query.user;
//     let year = req.query.year;
//     let month = req.query.month;
//
//     if (user && !mongoose.Types.ObjectId.isValid(user)) {
//         if (!year && !month) {
//             year = user;
//             user = undefined;
//         } else {
//             user = undefined;
//         }
//     }
//
//     let start, end;
//     if (year && month) {
//         const paddedMonth = String(month).padStart(2, '0');
//         const startDate = new Date(`${year}-${paddedMonth}-01T00:00:00.000Z`);
//         const endDate = moment(startDate).add(1, 'month').toDate();
//         start = moment(startDate).format('YYYY-MM-DD');
//         end = moment(endDate).format('YYYY-MM-DD');
//     } else if (year) {
//         const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
//         const endDate = new Date(`${parseInt(year) + 1}-01-01T00:00:00.000Z`);
//         start = moment(startDate).format('YYYY-MM-DD');
//         end = moment(endDate).format('YYYY-MM-DD');
//     }
//     const today = moment();
//     const allBasicSalaries = await basicSalaryModel.find().populate('user', 'fullName');
//     const newReports = [];
//     const appSettings = await AppSettingModel.findOne();
//     const monthlyTotalHours = appSettings.monthlyTotalHours;
//
//     for (const item of allBasicSalaries) {
//         const salaryStartDate = moment(item.startDate).startOf('month');
//         let iterDate = moment(salaryStartDate);
//
//         while (iterDate.isBefore(today.clone().startOf('month'), 'month')) {
//             const startOfMonth = moment(iterDate).startOf('month');
//             const endOfMonth = moment(iterDate).endOf('month');
//             const effectiveStartDate = moment.max(startOfMonth, salaryStartDate);
//             const effectiveEndDate = endOfMonth;
//             const reportDate = iterDate.format('YYYY-MM-DD');
//
//             let reportData = {
//                 user: item.user._id,
//                 userName: item.user.fullName,
//                 basicSalary: item.basicSalary,
//                 date: reportDate,
//                 reportType,
//             };
//
//             if (reportType === 'leaveWise') {
//                 const userLeave = await leaveModel.find({
//                     user: item.user,
//                     startDate: { $gte: effectiveStartDate.format('YYYY-MM-DD'), $lte: effectiveEndDate.format('YYYY-MM-DD') },
//                     status: 'approved'
//                 });
//
//                 const allHolidays = await HolidayEventModel.find({ isLeaveOnDay: true }).lean();
//                 const totalLeaveHours = calculateTotalLeaveHours(userLeave, allHolidays);
//                 const durationDays = effectiveEndDate.diff(effectiveStartDate, 'days') + 1;
//                 const totalWorkingHours = durationDays * 9;
//                 const hourlyRate = item.basicSalary / totalWorkingHours;
//                 const leaveDeduction = Math.round(totalLeaveHours * hourlyRate);
//                 const netSalary = Math.max(Math.round(item.basicSalary - leaveDeduction), 0);
//
//                 Object.assign(reportData, {
//                     leaveHours: totalLeaveHours,
//                     deductionAmount: leaveDeduction,
//                     netSalary
//                 });
//             } else if (reportType === 'punchWise') {
//
//                 const userPunchReports = await punchReportModel.find({
//                     user: item.user,
//                     'punchReport.date': {
//                         $gte: effectiveStartDate.format('YYYY-DD-MM'),
//                         $lte: effectiveEndDate.format('YYYY-DD-MM')
//                     },
//                 });
//                 console.log("userPunchReports", userPunchReports)
//                 if (userPunchReports.length === 0) {
//                     iterDate.add(1, 'month');
//                     continue;
//                 }
//
//                 const allPunches = [];
//                 userPunchReports.forEach(report => {
//                     report.punchReport.forEach(entry => {
//                         if (
//                             new Date(entry.date) >= effectiveStartDate.toDate() &&
//                             new Date(entry.date) <= effectiveEndDate.toDate()
//                         ) {
//                             allPunches.push({
//                                 date: entry.date,
//                                 status: entry.status,
//                                 workingHours: entry.workingHours,
//                                 missingHours: entry.missingHours,
//                                 punchList: entry.punchList.map(p => ({
//                                     time: p.time,
//                                     type: p.type
//                                 }))
//                             });
//                         }
//                     });
//                 });
//
//                 function hhmmToMinutes(hhmm) {
//                     if (!hhmm) return 0;
//                     if (typeof hhmm === 'number') return Math.round(hhmm * 60);
//                     const [hours, minutes] = hhmm.split(':').map(Number);
//                     return hours * 60 + (minutes || 0);
//                 }
//
//                 let totalWorkingMinutes = 0;
//                 let totalMissingMinutes = 0;
//                 allPunches.forEach(entry => {
//                     totalWorkingMinutes += hhmmToMinutes(entry.workingHours);
//                     totalMissingMinutes += hhmmToMinutes(entry.missingHours);
//                 });
//
//                 const workingHours = Math.floor(totalWorkingMinutes / 60);
//                 const workingMins = totalWorkingMinutes % 60;
//                 const missingHours = Math.floor(totalMissingMinutes / 60);
//                 const missingMins = totalMissingMinutes % 60;
//
//                 const monthName = iterDate.format('MMMM').toLowerCase();
//                 const expectedTotalHours = monthlyTotalHours[monthName] || 0;
//                 const actualTotalHours = workingHours + (workingMins / 60);
//                 const difference = expectedTotalHours - actualTotalHours;
//                 const totalWorkingTimeInMinutes = hhmmToMinutes(`${expectedTotalHours}:00`);
//                 const salaryPerMinute = item.basicSalary / totalWorkingTimeInMinutes;
//                 const deduction = salaryPerMinute * totalMissingMinutes;
//                 const netSalary = item.basicSalary - deduction;
//                 Object.assign(reportData, {
//                     totalWorkingTime: { hours: workingHours, minutes: workingMins },
//                     totalMissingTime: { hours: missingHours, minutes: missingMins },
//                     leaveHours: missingHours,
//                     punches: allPunches,
//                     expectedTotalHours,
//                     deductionAmount: deduction.toFixed(2),
//                     differenceFromExpected: difference.toFixed(2),
//                     netSalary: netSalary.toFixed(2)
//                 });
//             }
//
//             const existingReport = await salaryReportModel.findOne({
//                 user: item.user._id,
//                 date: reportDate,
//                 reportType
//             });
//
//             if (existingReport) {
//                 await salaryReportModel.updateOne(
//                     { _id: existingReport._id },
//                     { $set: reportData }
//                 );
//             } else {
//                 newReports.push(reportData);
//             }
//
//             iterDate.add(1, 'month');
//         }
//     }
//     if (newReports.length > 0) {
//         await salaryReportModel.insertMany(newReports);
//     }
//     const filters = {};
//     if (user) filters.user = user;
//     if (start && end) filters.date = { $gte: start, $lt: end };
//     if (reportType) filters.reportType = reportType;
//
//     const dataList = await salaryReportModel
//         .find(filters)
//         .populate('user', 'fullName');
//
//     const formattedLeave = formatLeaveList(dataList);
//     return formattedLeave
// };

const allTypeWiseSalaryReports = async (query) => {
    const { user: rawUser, year: rawYear, month: rawMonth, reportType } = query;
    let user = rawUser;
    let year = rawYear;
    let month = rawMonth;

    if (user && !mongoose.Types.ObjectId.isValid(user)) {
        if (!year && !month) {
            year = user;
            user = undefined;
        } else {
            user = undefined;
        }
    }

    let start, end;
    if (year && month) {
        const startDate = moment(`${year}-${String(month).padStart(2, '0')}-01`);
        start = startDate.format('YYYY-MM-DD');
        end = startDate.clone().add(1, 'month').format('YYYY-MM-DD');
    } else if (year) {
        const startDate = moment(`${year}-01-01`);
        start = startDate.format('YYYY-MM-DD');
        end = startDate.clone().add(1, 'year').format('YYYY-MM-DD');
    }

    const today = moment();
    const allBasicSalaries = await basicSalaryModel.find().populate('user', 'fullName');
    const appSettings = await AppSettingModel.findOne();
    const monthlyTotalHours = appSettings.monthlyTotalHours;

    for (const item of allBasicSalaries) {
        const salaryStart = moment(item.startDate).startOf('month');
        let iterDate = salaryStart.clone();

        while (iterDate.isBefore(today.clone().startOf('month'))) {
            const startOfMonth = iterDate.clone().startOf('month');
            const endOfMonth = iterDate.clone().endOf('month');
            const effectiveStart = moment.max(startOfMonth, salaryStart);
            const reportDate = iterDate.format('YYYY-MM-DD');

            let reportData = {
                user: item.user._id,
                userName: item.user.fullName,
                basicSalary: item.basicSalary,
                date: reportDate,
                deductionAmount: null,
                reportType
            };

            if (reportType === 'leaveWise') {
                const userLeaves = await leaveModel.find({
                    user: item.user,
                    isDeductible: true,
                    startDate: { $gte: effectiveStart.format('YYYY-MM-DD'), $lte: endOfMonth.format('YYYY-MM-DD') },
                    status: 'approved'
                });

                const holidays = await HolidayEventModel.find({ isLeaveOnDay: true }).lean();
                const totalLeaveHours = calculateTotalLeaveHours(userLeaves, holidays);
                const totalWorkingHours = endOfMonth.diff(effectiveStart, 'days') * 9 + 9;
                const hourlyRate = item.basicSalary / totalWorkingHours;
                const leaveDeduction = Math.round(totalLeaveHours * hourlyRate);
                const netSalary = Math.max(Math.round(item.basicSalary - leaveDeduction), 0);

                Object.assign(reportData, {
                    leaveHours: totalLeaveHours,
                    deductionAmount: leaveDeduction,
                    netSalary
                });
            }

            else if (reportType === 'punchWise') {
                const userPunchReports = await punchReportModel.find({
                    user: item.user,
                    'punchReport.date': {
                        $gte: effectiveStart.format('YYYY-MM-DD'),
                        $lte: endOfMonth.format('YYYY-MM-DD')
                    }
                });

                if (!userPunchReports.length) {
                    iterDate.add(1, 'month');
                    continue;
                }

                const allPunches = [];
                for (const report of userPunchReports) {
                    for (const punch of report.punchReport) {
                        if (
                            moment(punch.date).isBetween(effectiveStart, endOfMonth, 'day', '[]') && punch.isDeductible
                        ) {
                            allPunches.push({
                                date: punch.date,
                                status: punch.status,
                                workingHours: punch.workingHours,
                                missingHours: punch.missingHours,
                                punchList: punch.punchList.map(p => ({
                                    time: p.time,
                                    type: p.type
                                }))
                            });
                        }
                    }
                }

                const toMinutes = (hhmm) => {
                    if (!hhmm) return 0;
                    const [h, m] = hhmm.split(':').map(Number);
                    return h * 60 + (m || 0);
                };

                let totalWorkingMin = 0;
                let totalMissingMin = 0;
                allPunches.forEach(entry => {
                    totalWorkingMin += toMinutes(entry.workingHours);
                    totalMissingMin += toMinutes(entry.missingHours);
                });

                const workingHours = Math.floor(totalWorkingMin / 60);
                const workingMins = totalWorkingMin % 60;
                const missingHours = Math.floor(totalMissingMin / 60);
                const missingMins = totalMissingMin % 60;

                const monthName = iterDate.format('MMMM').toLowerCase();
                const expectedHours = monthlyTotalHours[monthName] || 0;
                const totalSalaryMinutes = expectedHours * 60;
                const perMinuteRate = item.basicSalary / totalSalaryMinutes;
                const deduction = perMinuteRate * totalMissingMin;
                const netSalary = item.basicSalary - deduction;

                Object.assign(reportData, {
                    totalWorkingTime: { hours: workingHours, minutes: workingMins },
                    totalMissingTime: { hours: missingHours, minutes: missingMins },
                    leaveHours: missingHours,
                    punches: allPunches,
                    expectedTotalHours: expectedHours,
                    deductionAmount: deduction.toFixed(0),
                    differenceFromExpected: (expectedHours - (totalWorkingMin / 60)).toFixed(0),
                    netSalary: netSalary.toFixed(0)
                });
            }

            const salaryReportData = await salaryReportModel.findOne(
                {
                    user: item.user._id,
                    date: reportDate,
                    reportType
                }
            );

            const basicSalary = parseFloat(decrypt(item.basicSalary));
            const originalDeduction = parseFloat(reportData.deductionAmount || "0");
            const bonusAmount = parseFloat(salaryReportData.bonus || "0");
            const deductAmount = parseFloat(salaryReportData.deduct || "0");

            const updatedDeduction = Math.max((originalDeduction - bonusAmount) + deductAmount, 0);
            const updatedNetSalary = basicSalary - updatedDeduction;

            reportData.deductionAmount = updatedDeduction;
            reportData.netSalary = updatedNetSalary;

            // console.log("getData=>", {
            //     basicSalary: basicSalary,
            //     existingDeduction: originalDeduction,
            //     bonusAmount: bonusAmount,
            //     deductAmount: deductAmount,
            //     updatedDeduction: updatedDeduction,
            //     netSalary: updatedNetSalary,
            // })

            // console.log("getData=>", reportData)

            await salaryReportModel.findOneAndUpdate(
                {
                    user: item.user._id,
                    date: reportDate,
                    reportType
                },
                { $set: reportData },
                { upsert: true }
            );

            iterDate.add(1, 'month');
        }
    }

    const filters = {};
    if (user) filters.user = user;
    if (start && end) filters.date = { $gte: start, $lt: end };
    if (reportType) filters.reportType = reportType;

    const reports = await salaryReportModel.find(filters).populate('user', 'fullName');
    return formatLeaveList(reports);
};


const generateSalary = async (req, res) => {
    try {
        const list = await allTypeWiseSalaryReports(req.query);
        return res.status(200).json({
            success: true,
            message: 'Salary reports generated successfully.',
            data: list,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

const updateSalary = async (req, res) => {
    try {
        const { users, years, months, deduct } = req.body;

        const reportDate = `${years}-${String(months).padStart(2, '0')}-01`;
        const existingReport = await salaryReportModel.findOne({
            user: users,
            date: reportDate,
        });

        if (!existingReport) {
            return res.status(404).json({
                success: false,
                message: 'Salary report not found for the given user and date.',
            });
        }

        const leaveDeduction = existingReport.deductionAmount;
        // const extraDeduct = parseFloat(deduct || 0);
        const totalDeduction = Number(leaveDeduction) + Number(deduct);
        // const totalDeduction = leaveDeduction + extraDeduct;
        const netSalary = Math.max(Math.round(existingReport.basicSalary - totalDeduction), 0);

        const updatedReport = {
            deductionAmount: totalDeduction,
            netSalary: netSalary,
            manualDeduction: deduct,
        };

        await salaryReportModel.updateOne(
            { _id: existingReport._id },
            { $set: updatedReport }
        );

        return res.status(200).json({
            success: true,
            message: 'Salary report updated successfully.',
            data: updatedReport,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

const updateSalaryReport = async (req, res) => {
    try {
        const { _id, user, bonus = "0", deduct = "0", removedLeave = [], removedPunch = [] } = req.body;

        // 1. Update Punch Report
        for (const punch of removedPunch) {
            const { date, isDeductible } = punch;

            await punchReportModel.updateOne(
                { user, 'punchReport.date': date },
                {
                    $set: {
                        'punchReport.$.isDeductible': isDeductible
                    }
                }
            );
        }

        // 2. Update Leaves
        for (const leave of removedLeave) {
            await leaveModel.updateOne(
                { _id: leave._id },
                {
                    $set: {
                        isDeductible: leave.isDeductible
                    }
                }
            );
        }

        // 3. Update Salary Report
        const salaryReport = await salaryReportModel.findById(_id);

        if (!salaryReport) {
            return res.status(404).json({
                success: false,
                message: "Salary report not found."
            });
        }

        const basicSalary = parseFloat(decrypt(salaryReport.basicSalary));
        const existingDeduction = parseFloat(decrypt(salaryReport.deductionAmount || "0"));
        const bonusAmount = parseFloat(bonus || "0");
        const deductAmount = parseFloat(deduct || "0");

        const updatedDeduction = Math.max((existingDeduction - bonusAmount) + deductAmount, 0);
        const netSalary = basicSalary - updatedDeduction;

        console.log("updateData=>", {
            basicSalary: basicSalary,
            existingDeduction: existingDeduction,
            bonusAmount: bonusAmount,
            deductAmount: deductAmount,
            updatedDeduction: updatedDeduction,
            netSalary: netSalary,
        })

        salaryReport.bonus = bonus ? bonus.toString() : null;
        salaryReport.deduct = deduct ? deduct.toString() : null;
        salaryReport.deductionAmount = updatedDeduction.toString();
        salaryReport.netSalary = netSalary.toString();

        await salaryReport.save();

        const list = await allTypeWiseSalaryReports(req.body.query);

        return res.status(200).json({
            success: true,
            message: "Salary report updated successfully.",
            data: list
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


module.exports = {
    addUpdateBasicSalary,
    basicSalaryList,
    deleteBasicSalary,
    generateSalaryReports,
    generateSalary,
    updateSalary,
    updateSalaryReport
}