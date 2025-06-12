const {
    handleError, leaveLabelKeys,
} = require("../utils/utils");
const moment = require('moment');
const mongoose = require('mongoose');

const { basicSalaryModel } = require('../Models/basicSalaryModel');
const { salaryReportModel } = require('../Models/salaryReportModel');
const { LeaveModel } = require('../Models/LeaveModel');
const { HolidayEventModel } = require("../Models/HolidayEventModel");
const { AppSettingModel } = require("../Models/AppSettingModel");
const { punchReportModel } = require("../Models/punchReportModel");
const { decrypt } = require("../../encryptSalary");
const {DailyTimeModel} = require("../Models/DailyTimeModel");

const basicSalaryList = async (req, res) => {
    try {
        const basicSalaryList = await basicSalaryModel.find({}).populate('user', 'fullName');
        return res.status(201).json({
            success: true,
            message: "Basic Salary List Get Successfully.",
            data: basicSalaryList
        });
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
            return res.status(201).json({
                success: true,
                message: "Basic Salary Added Successfully.",
                data: basicSalaryList
            });
        } else {
            if (!startDate) {
                return handleError(res, "Start date is required", 400);
            }
            const basicSalaryUpdate = await basicSalaryModel.findByIdAndUpdate({ _id: id }, req.body, { new: true });
            const basicSalaryList = await basicSalaryModel.find({}).populate('user', 'fullName');
            return res.status(201).json({
                success: true,
                message: "Basic Salary Updated Successfully.",
                data: basicSalaryList
            });
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
        return res.status(201).json({
            success: true,
            message: "Basic Salary Deleted Successfully.",
            data: dataList
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

function sumTotalLeaveHours(userLeaves) {
    userLeaves.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    let totalHours = 0;
    for (const leave of userLeaves) {
        const rawHours = leave.deductHours ? parseFloat(leave.deductHours) : 0;
        totalHours += rawHours;
    }
    return totalHours;
}

function calculateTotalPunchHours(userLeaves) {
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

const getLeaveDateMap = (userLeaves) => {
    try {
        const leaveDateMap = new Map();

        for (const leave of userLeaves) {
            const start = moment(leave.startDate);
            const end = leave.endDate ? moment(leave.endDate) : start;
            for (let date = start.clone(); date.isSameOrBefore(end); date.add(1, 'day')) {
                const dateStr = date.format('YYYY-MM-DD');
                const matchedDateEntry = leave.deductHoursDateWise.find(
                    (entry) => entry.date === dateStr
                );
                const plainLeave = { ...leave };

                plainLeave.deductForDate = {
                    date: dateStr,
                    deductHours: matchedDateEntry.deductHours,
                    deductMinutes: matchedDateEntry.deductMinutes
                };

                leaveDateMap.set(dateStr, plainLeave);
            }
        }

        return leaveDateMap;
    } catch (e) {
        console.log("error->", e);
    }
};

const toMinutes = (hhmm) => {
    if (!hhmm) return 0;
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + (m || 0);
};

// const allTypeWiseSalaryReports = async (query) => {
//     const {user: rawUser, year: rawYear, month: rawMonth, reportType} = query;
//     let user = rawUser;
//     let year = rawYear;
//     let month = rawMonth;
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
//         const startDate = moment(`${year}-${String(month).padStart(2, '0')}-01`);
//         start = startDate.format('YYYY-MM-DD');
//         end = startDate.clone().add(1, 'month').format('YYYY-MM-DD');
//     } else if (year) {
//         const startDate = moment(`${year}-01-01`);
//         start = startDate.format('YYYY-MM-DD');
//         end = startDate.clone().add(1, 'year').format('YYYY-MM-DD');
//     }
//
//     const today = moment();
//     const allBasicSalaries = await basicSalaryModel.find().populate('user', 'fullName');
//     const appSettings = await AppSettingModel.findOne();
//     const monthlyTotalHours = appSettings.monthlyTotalHours;
//
//     for (const item of allBasicSalaries) {
//         const salaryStart = moment(item.startDate).startOf('month');
//         let iterDate = salaryStart.clone();
//         const userLeaves = await LeaveModel.find({user: item.user});
//         const approvedLeaveDates = getLeaveDateMap(userLeaves);
//
//         while (iterDate.isBefore(today.clone().startOf('month'))) {
//             const startOfMonth = iterDate.clone().startOf('month');
//             const endOfMonth = iterDate.clone().endOf('month');
//             const effectiveStart = moment.max(startOfMonth, salaryStart);
//             const reportDate = iterDate.format('YYYY-MM-DD');
//
//             let reportData = {
//                 user: item.user._id,
//                 userName: item.user.fullName,
//                 basicSalary: item.basicSalary,
//                 date: reportDate,
//                 deductionAmount: null,
//                 reportType
//             };
//
//             if (reportType === 'leaveWise') {
//
//                 const userLeaves = await LeaveModel.find({
//                     user: item.user._id,
//                     isDeductible: true,
//                     startDate: {$gte: effectiveStart.format('YYYY-MM-DD'), $lte: endOfMonth.format('YYYY-MM-DD')},
//                     status: leaveLabelKeys.approved
//                 });
//
//                 // const totalLeaveHours = calculateTotalLeaveHours(userLeaves, holidays);
//                 const totalLeaveHours = sumTotalLeaveHours(userLeaves);
//                 const totalPunchHours = calculateTotalPunchHours(userLeaves);
//
//                 const totalWorkingHours = endOfMonth.diff(effectiveStart, 'days') * 9 + 9;
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
//                 let userPunchReports = await punchReportModel.find({
//                     user: item.user,
//                     'punchReport.date': {
//                         $gte: effectiveStart.format('YYYY-MM-DD'),
//                         $lte: endOfMonth.format('YYYY-MM-DD')
//                     }
//                 });
//                 const allHolidays = await HolidayEventModel.find({isLeaveOnDay: true}).lean();
//                 const holidayDateSet = new Set(allHolidays.map(h => moment(h.eventDate).format('YYYY-MM-DD')));
//
//                 for (const report of userPunchReports) {
//                     for (const punch of report.punchReport) {
//                         let deductForDate = null;
//
//                         if (approvedLeaveDates?.has?.(punch.date)) {
//                             const leaveInfo = approvedLeaveDates.get(punch.date);
//
//                             if (leaveInfo?.deductForDate != null) {
//                                 deductForDate = leaveInfo.deductForDate;
//
//                                 deductForDate.isUnexpected = leaveInfo.isUnexpected || deductForDate.isUnexpected;
//                                 deductForDate.sandwichLeave = leaveInfo.sandwichLeave || deductForDate.sandwichLeave;
//                                 deductForDate.isLeaveOnDay = true;
//
//                                 const { deductHours, deductMinutes } = leaveInfo.deductForDate;
//
//                                 deductForDate.deductHours = parseFloat(deductHours ?? 0);
//                                 deductForDate.deductMinutes = parseFloat(deductMinutes ?? 0);
//                             }
//                         }
//
//                         await punchReportModel.findByIdAndUpdate(report._id, {
//                             $set: {
//                                 'punchReport.$[punch].deductForDate': deductForDate
//                             }
//                         }, {
//                             arrayFilters: [{'punch.date': punch.date}]
//                         });
//                     }
//                 }
//
//                 userPunchReports = await punchReportModel.find({
//                     user: item.user,
//                     'punchReport.date': {
//                         $gte: effectiveStart.format('YYYY-MM-DD'),
//                         $lte: endOfMonth.format('YYYY-MM-DD')
//                     }
//                 });
//
//                 if (!userPunchReports.length) {
//                     iterDate.add(1, 'month');
//                     continue;
//                 }
//
//                 let totalWorkingMin = 0;
//                 let totalMissingMin = 0;
//
//                 let totalDeductMin = 0;
//
//                 for (const report of userPunchReports) {
//                     for (const punch of report.punchReport) {
//                         const punchDate = moment(punch.date).format('YYYY-MM-DD');
//
//                         if (holidayDateSet.has(punchDate)) {
//                             continue;
//                         }
//
//                         totalWorkingMin += toMinutes(punch.workingHours);
//                         totalMissingMin += toMinutes(punch.missingHours);
//
//                         if (
//                             moment(punch.date).isBetween(effectiveStart, endOfMonth, 'day', '[]') && punch.isDeductible && punch.status !== 'WO'
//                         ) {
//                             if (punch.status === 'A') {
//                                 if (punch.deductForDate) {
//                                     let calculateDeduct = parseFloat(punch.deductForDate.deductHours)
//                                     // 45/9=5 <= this rules implement here
//                                     calculateDeduct = calculateDeduct * 5;
//                                     totalDeductMin += parseFloat(punch.deductForDate.deductMinutes) - calculateDeduct;
//                                 } else {
//                                     totalDeductMin += toMinutes(punch.missingHours);
//                                 }
//                             } else {
//                                 totalDeductMin += toMinutes(punch.missingHours);
//                             }
//                         }
//                     }
//                 }
//
//                 const monthName = iterDate.format('MMMM').toLowerCase();
//                 const expectedHours = monthlyTotalHours[monthName] || 0;
//                 const totalSalaryMinutes = expectedHours * 60;
//                 const perMinuteRate = item.basicSalary / totalSalaryMinutes;
//                 const deduction = perMinuteRate * totalDeductMin;
//                 const netSalary = item.basicSalary - deduction;
//
//                 Object.assign(reportData, {
//                     totalWorkingMinutes: totalWorkingMin,
//                     totalWorkingHours: totalWorkingMin / 60,
//                     totalMissingMinutes: totalMissingMin,
//                     totalMissingHours: totalMissingMin / 60,
//                     totalDeductMinutes: totalDeductMin,
//                     totalDeductHours: totalDeductMin / 60,
//                     expectedTotalHours: expectedHours,
//                     deductionAmount: deduction.toFixed(0),
//                     netSalary: netSalary.toFixed(0),
//                 });
//             }
//
//             const salaryReportData = await salaryReportModel.findOne(
//                 {
//                     user: item.user._id,
//                     date: reportDate,
//                     reportType
//                 }
//             );
//
//             const basicSalary = parseFloat(decrypt(item.basicSalary));
//             const originalDeduction = parseFloat(reportData.deductionAmount || 0);
//             let bonusAmount = parseFloat(salaryReportData ? decrypt(salaryReportData.bonus) : 0);
//             let deductAmount = parseFloat(salaryReportData ? decrypt(salaryReportData.deduct) : 0);
//
//             if (isNaN(bonusAmount)) {
//                 bonusAmount = 0;
//             }
//             if (isNaN(deductAmount)) {
//                 deductAmount = 0;
//             }
//
//             const updatedDeduction = Math.max((originalDeduction - bonusAmount) + deductAmount, 0);
//             const updatedNetSalary = basicSalary - updatedDeduction;
//
//             reportData.deductionAmount = updatedDeduction;
//             reportData.netSalary = updatedNetSalary;
//
//             await salaryReportModel.findOneAndUpdate(
//                 {
//                     user: item.user._id,
//                     date: reportDate,
//                     reportType
//                 },
//                 {$set: reportData},
//                 {upsert: true}
//             );
//
//             iterDate.add(1, 'month');
//         }
//     }
//
//     const filters = {};
//     if (user) filters.user = user;
//     if (start && end) filters.date = {$gte: start, $lt: end};
//     if (reportType) filters.reportType = reportType;
//
//     const formattedMonth = String(month).padStart(2, "0");
//     const regexDatePrefix = `${year}-${formattedMonth}`; // e.g., "2025-04"
//
//     const hasUnpublished = await salaryReportModel.exists({
//         reportType,
//         date: {$regex: `^${regexDatePrefix}`},
//         isPublished: false,
//     });
//
//     const reports = await salaryReportModel.find(filters).populate('user', 'fullName');
//
//     const formattedReportList = await generateReportObject(reports);
//
//     // formattedReportList = formattedReportList.map(report => ({
//     //     ...report._doc,
//     // }));
//
//     // console.log("formattedReportList", formattedReportList)
//
//     return {
//         list: formattedReportList,
//         month: month,
//         year: year,
//         isPublished: !hasUnpublished,
//     };
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

    const [allBasicSalaries, appSettings, allHolidays, allUserLeaves, allUserPunchReports] = await Promise.all([
        basicSalaryModel.find(undefined, undefined, undefined).populate('user', 'fullName').lean(),
        AppSettingModel.findOne().lean(),
        HolidayEventModel.find({
            eventDate: { $gte: start, $lt: end },
            isLeaveOnDay: true
        }).lean(),
        LeaveModel.find({
            startDate: { $lte: end },
            endDate: { $gte: start }
        }).lean(),
        punchReportModel.find({
            "punchReport.date": { $gte: start, $lt: end }
        }).lean()
    ]);

    const monthlyTotalHours = appSettings.monthlyTotalHours;
    const holidayDateSet = new Set(allHolidays.map(h => moment(h.eventDate).format('YYYY-MM-DD')));

    const salaryReportBulkOps = [];
    const punchReportBulkOps = [];

    // const allBasicSalaries = await basicSalaryModel.find(undefined, undefined, undefined).populate('user', 'fullName');
    // const appSettings = await AppSettingModel.findOne(undefined, undefined, undefined);
    // const monthlyTotalHours = appSettings.monthlyTotalHours;

    for (const item of allBasicSalaries) {
        const salaryStart = moment(item.startDate).startOf('month');
        let iterDate = salaryStart.clone();
        // const userLeaves = await LeaveModel.find({ user: item.user });
        const userLeaves = allUserLeaves.filter(leave => leave.user.toString() === item.user._id.toString());
        const approvedLeaveDates = getLeaveDateMap(userLeaves);

        while (iterDate.isBefore(today.clone().startOf('month'))) {
            const startOfMonth = iterDate.clone().startOf('month');
            const endOfMonth = iterDate.clone().endOf('month');
            const effectiveStart = moment.max(startOfMonth, salaryStart);
            const reportDate = iterDate.format('YYYY-MM-DD');

            const existingReport = await salaryReportModel.findOne({
                user: item.user._id,
                date: reportDate,
                reportType
            });

            const preservedBasicSalary = existingReport ? existingReport.basicSalary : item.basicSalary;

            let reportData = {
                user: item.user._id,
                userName: item.user.fullName,
                basicSalary: preservedBasicSalary,
                date: reportDate,
                deductionAmount: null,
                reportType
            };

            if (reportType === 'leaveWise') {
                // const userLeaves = await LeaveModel.find({
                //     user: item.user._id,
                //     isDeductible: true,
                //     startDate: { $gte: effectiveStart.format('YYYY-MM-DD'), $lte: endOfMonth.format('YYYY-MM-DD') },
                //     status: leaveLabelKeys.approved
                // });
                const userLeavesInMonth = userLeaves.filter(leave =>
                    leave.isDeductible &&
                    leave.status === leaveLabelKeys.approved &&
                    moment(leave.startDate).isBetween(effectiveStart, endOfMonth, null, '[]')
                );
                // const totalPunchHours = calculateTotalPunchHours(userLeavesInMonth);

                const totalLeaveHours = sumTotalLeaveHours(userLeavesInMonth);
                const totalWorkingDays = endOfMonth.diff(effectiveStart, 'days') + 1;
                const totalWorkingHours = totalWorkingDays * 9;
                const hourlyRate = preservedBasicSalary / totalWorkingHours;
                const leaveDeduction = Math.round(totalLeaveHours * hourlyRate);
                const netSalary = Math.max(Math.round(preservedBasicSalary - leaveDeduction), 0);

                Object.assign(reportData, {
                    leaveHours: totalLeaveHours,
                    deductionAmount: leaveDeduction,
                    netSalary
                });
            } else if (reportType === 'punchWise') {
                let userPunchReports = allUserPunchReports.filter(report =>
                    report.user.toString() === item.user._id.toString() &&
                    report.punchReport.some(punch =>
                        moment(punch.date).isBetween(effectiveStart, endOfMonth, null, '[]')
                    )
                );

                for (const report of userPunchReports) {
                    for (const punch of report.punchReport) {
                        let deductForDate = null;

                        if (approvedLeaveDates?.has?.(punch.date)) {
                            const leaveInfo = approvedLeaveDates.get(punch.date);

                            if (leaveInfo?.deductForDate != null) {
                                deductForDate = leaveInfo.deductForDate;

                                deductForDate.isUnexpected = leaveInfo.isUnexpected || deductForDate.isUnexpected;
                                deductForDate.sandwichLeave = leaveInfo.sandwichLeave || deductForDate.sandwichLeave;
                                deductForDate.isLeaveOnDay = true;

                                const { deductHours, deductMinutes } = leaveInfo.deductForDate;

                                deductForDate.deductHours = parseFloat(deductHours ?? 0);
                                deductForDate.deductMinutes = parseFloat(deductMinutes ?? 0);
                            }
                        }

                        if(deductForDate) {
                            const updatedReport = await punchReportModel.findByIdAndUpdate(
                                report._id,
                                {
                                    $set: {
                                        'punchReport.$[punch].deductForDate': deductForDate
                                    }
                                },
                                {
                                    arrayFilters: [{ 'punch.date': punch.date }],
                                    new: true  // This ensures the updated document is returned
                                }
                            );
                        }

                    }
                }
                //
                // userPunchReports = await punchReportModel.find({
                //     user: item.user,
                //     'punchReport.date': {
                //         $gte: effectiveStart.format('YYYY-MM-DD'),
                //         $lte: endOfMonth.format('YYYY-MM-DD')
                //     }
                // });

                if (!userPunchReports.length) {
                    iterDate.add(1, 'month');
                    continue;
                }

                let totalWorkingMin = 0;
                let totalMissingMin = 0;

                let totalDeductMin = 0;

                for (const report of userPunchReports) {
                    for (const punch of report.punchReport) {
                        const punchDate = moment(punch.date).format('YYYY-MM-DD');

                        if (holidayDateSet.has(punchDate)) {
                            continue;
                        }

                        totalWorkingMin += toMinutes(punch.workingHours);
                        totalMissingMin += toMinutes(punch.missingHours);

                        if (
                            moment(punch.date).isBetween(effectiveStart, endOfMonth, 'day', '[]') && punch.isDeductible && punch.status !== 'WO'
                        ) {
                            if (punch.status === 'A') {
                                if (punch.deductForDate) {
                                    let calculateDeduct = parseFloat(punch.deductForDate.deductHours)
                                    // 45/9=5 <= this rules implement here
                                    calculateDeduct = calculateDeduct * 5;
                                    totalDeductMin += parseFloat(punch.deductForDate.deductMinutes) - calculateDeduct;
                                } else {
                                    totalDeductMin += toMinutes(punch.missingHours);
                                }
                            } else {
                                totalDeductMin += toMinutes(punch.missingHours);
                            }
                        }
                    }
                }

                const monthName = iterDate.format('MMMM').toLowerCase();
                const expectedHours = monthlyTotalHours[monthName] || 0;
                const totalSalaryMinutes = expectedHours * 60;
                const perMinuteRate = preservedBasicSalary / totalSalaryMinutes;
                const deduction = perMinuteRate * totalDeductMin;
                const netSalary = preservedBasicSalary - deduction;

                Object.assign(reportData, {
                    totalWorkingMinutes: totalWorkingMin,
                    totalWorkingHours: totalWorkingMin / 60,
                    totalMissingMinutes: totalMissingMin,
                    totalMissingHours: totalMissingMin / 60,
                    totalDeductMinutes: totalDeductMin,
                    totalDeductHours: totalDeductMin / 60,
                    expectedTotalHours: expectedHours,
                    deductionAmount: deduction.toFixed(0),
                    netSalary: netSalary.toFixed(0),
                });
            }

            const salaryReportData = await salaryReportModel.findOne(
                {
                    user: item.user._id,
                    date: reportDate,
                    reportType
                }
            );

            const basicSalary = parseFloat(decrypt(preservedBasicSalary));
            const originalDeduction = parseFloat(reportData.deductionAmount || 0);
            let bonusAmount = parseFloat(salaryReportData ? decrypt(salaryReportData.bonus) : 0);
            let deductAmount = parseFloat(salaryReportData ? decrypt(salaryReportData.deduct) : 0);

            if (isNaN(bonusAmount)) {
                bonusAmount = 0;
            }
            if (isNaN(deductAmount)) {
                deductAmount = 0;
            }

            // const updatedDeduction = Math.max((originalDeduction - bonusAmount) + deductAmount, 0);
            const updatedDeduction = Math.max(originalDeduction + deductAmount, 0);
            const updatedNetSalary = ((basicSalary - updatedDeduction) + bonusAmount);

            reportData.deductionAmount = updatedDeduction;
            reportData.netSalary = updatedNetSalary;

            // await salaryReportModel.findOneAndUpdate(
            //     {
            //         user: item.user._id,
            //         date: reportDate,
            //         reportType
            //     },
            //     { $set: reportData },
            //     { upsert: true }
            // );

            salaryReportBulkOps.push({
                updateOne: {
                    filter: {
                        user: item.user._id,
                        date: reportDate,
                        reportType
                    },
                    update: { $set: reportData },
                    upsert: true
                }
            });

            iterDate.add(1, 'month');
        }
    }

    if (salaryReportBulkOps.length > 0) {
        await salaryReportModel.bulkWrite(salaryReportBulkOps);
    }

    const filters = {};
    if (user) filters.user = user;
    if (start && end) filters.date = { $gte: start, $lt: end };
    if (reportType) filters.reportType = reportType;

    const formattedMonth = String(month).padStart(2, "0");
    const regexDatePrefix = `${year}-${formattedMonth}`; // e.g., "2025-04"

    const hasUnpublished = await salaryReportModel.exists({
        reportType,
        date: { $regex: `^${regexDatePrefix}` },
        isPublished: false,
    });

    const reports = await salaryReportModel.find(filters).populate('user', 'fullName');

    const formattedReportList = await generateReportObject(reports);

    // formattedReportList = formattedReportList.map(report => ({
    //     ...report._doc,
    // }));

    // console.log("formattedReportList", formattedReportList)

    return {
        list: formattedReportList,
        month: month,
        year: year,
        isPublished: !hasUnpublished,
    };
};

const generateReportObject = async (reports) => {
    let formattedReportList = [];
    const allHolidays = await HolidayEventModel.find({ isLeaveOnDay: true }).lean();
    const holidayDateSet = new Set(allHolidays.map(h => moment(h.eventDate).format('YYYY-MM-DD')));

    const allDailyTimes = await DailyTimeModel.find({});

    for (const report of reports) {

        const reportDate = moment(report.date).startOf('month');
        const startOfMonth = reportDate.clone().startOf('month');
        const endOfMonth = reportDate.clone().endOf('month');
        const effectiveStart = moment.max(startOfMonth, reportDate);

        const userLeaves = await LeaveModel.find({
            user: report.user._id,
            startDate: { $gte: effectiveStart.format('YYYY-MM-DD'), $lte: endOfMonth.format('YYYY-MM-DD') },
            status: leaveLabelKeys.approved
        });

        const filteredLeaveData = userLeaves.filter(entry => {
            if (entry.leaveCategory === leaveLabelKeys.unpaid) {
                return true;
            }
            if (entry.leaveCategory === leaveLabelKeys.paid &&
                Array.isArray(entry.deductHoursDateWise) &&
                entry.deductHoursDateWise.length > 0) {
                return entry.deductHoursDateWise.some(deductData => parseFloat(deductData.deductHours) > 0);
            }
            return false;
        });

        const punchReportData = await punchReportModel.findOne({ user: report.user._id });

        let lowWorkingHourDays = [];
        if (punchReportData && punchReportData.punchReport) {
            lowWorkingHourDays = punchReportData.punchReport.filter(entry => {
                const filteredTimeData = allDailyTimes.find(item => item.date === entry.date);
                const requiredMinutes = Math.round((filteredTimeData?.totalHour ?? 0) * 60);

                const entryDate = moment(entry.date);
                const formattedEntryDate = entryDate.format('YYYY-MM-DD');
                const entryMinutes = toMinutes(entry.workingHours);

                if (holidayDateSet.has(formattedEntryDate)) {
                    return false;
                }

                const isLeaveOnDay = entry.deductForDate?.isLeaveOnDay === true;

                return (
                    entryDate.isBetween(startOfMonth, endOfMonth, 'day', '[]') &&
                    entry.status !== 'WO' &&
                    !isLeaveOnDay &&
                    entryMinutes < requiredMinutes
                );
            });
        }

        formattedReportList.push({
            ...report._doc,
            leaveList: filteredLeaveData,
            punchList: lowWorkingHourDays,
        })
    }

    return formattedReportList;
}

const generateSalaryReports = async (req, res) => {
    try {
        const data = await allTypeWiseSalaryReports(req.query);
        // const data = await generateTypeWiseReport(req.query);

        return res.status(200).json({
            success: true,
            message: 'Salary reports generated successfully.',
            data: data.list,
            month: data.month,
            year: data.year,
            isPublished: data.isPublished
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
};

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
        const { _id, user, bonus = "0", deduct = "0", removedLeave = [], removedPunch = [], description } = req.body;

        console.log("req.body", req.body)

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
            await LeaveModel.updateOne(
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

        // console.log("updateData=>", {
        //     basicSalary: basicSalary,
        //     existingDeduction: existingDeduction,
        //     bonusAmount: bonusAmount,
        //     deductAmount: deductAmount,
        //     updatedDeduction: updatedDeduction,
        //     netSalary: netSalary,
        // })

        salaryReport.description = description ? description : null;
        salaryReport.bonus = bonus ? bonus.toString() : null;
        salaryReport.deduct = deduct ? deduct.toString() : null;
        salaryReport.deductionAmount = updatedDeduction.toString();
        salaryReport.netSalary = netSalary.toString();

        await salaryReport.save();

        const data = await allTypeWiseSalaryReports(req.body.query);

        return res.status(200).json({
            success: true,
            message: "Salary report updated successfully.",
            data: data.list,
            month: data.month,
            year: data.year,
            isPublished: data.isPublished
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

const publishSalaryReport = async (req, res) => {
    try {
        const { reportType, year, month } = req.body;

        if (!reportType || !year || !month) {
            return res.status(400).json({ success: false, message: "reportType, year, and month are required" });
        }

        const regexDatePrefix = `${year}-${String(month).padStart(2, '0')}`;

        const result = await salaryReportModel.updateMany(
            {
                reportType,
                date: { $regex: `^${regexDatePrefix}` },
            },
            { $set: { isPublished: true } }
        );

        const data = await allTypeWiseSalaryReports(req.body.query);

        return res.status(200).json({
            success: true,
            message: `${result.modifiedCount} reports updated to published.`,
            data: data.list,
            month: data.month,
            year: data.year,
            isPublished: data.isPublished
        });

    } catch (err) {
        console.error("Error updating salary reports:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const getUserWiseReport = async (req, res) => {
    try {
        const userId = req.user._id;
        const reportData = await salaryReportModel.find({
            user: userId,
            isPublished: true
        }).populate('user', 'fullName');

        return res.status(200).json({
            success: true,
            message: 'Salary report fetch successfully',
            data: reportData
        });

    } catch (err) {
        console.error("Error updating salary reports:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
};

function toRadians(degrees) {
    return degrees * (Math.PI / 180);
}

function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

const salaryCodeVerify = async (req, res) => {
    try {
        const userId = req.user._id;
        const { code, latitude, longitude } = req.body;

        const userLat = latitude;
        const userLong = longitude;
        // const userLat = "21.208271355868966";
        // const userLong = "72.8463645382779";

        if (!userLat && !userLong) {
            return res.status(400).json({ success: false, message: "Location not detected." });
        }

        const officeLat = 21.20823379544576;
        const officeLong = 72.84645418479938;

        const distance = getDistanceFromLatLonInMeters(userLat, userLong, officeLat, officeLong);

        if (distance <= 100) {
            console.log('User is within 100 meters of the office.');
            return res.status(400).json({
                success: false,
                message: "You are inside the allowed zone. Code verification is only allowed outside 100 meters."
            });
        } else {
            const basicSalaryData = await basicSalaryModel.findOne({
                user: userId,
            });

            if (code === basicSalaryData.code) {
                return res.status(200).json({
                    success: true,
                    message: 'Code matched successfully.',
                });
            } else {
                return res.status(400).json({ success: false, message: "Invalid code. Please try again." });
            }
            console.log('User is NOT within 100 meters of the office.');
        }
    } catch (err) {
        console.error("Error updating salary reports:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const generateTypeWiseReport = async (query) => {
    const { user: rawUser, year: rawYear, month: rawMonth, reportType } = query;
    let user = rawUser;
    let year = rawYear;
    let month = rawMonth;

    if (user && !mongoose.Types.ObjectId.isValid(user)) {
        user = undefined;
    }
    if (!year) {
        year = moment().year();
    }
    if (!month) {
        month = moment().subtract(1, 'month').month() + 1;
    }
    if (!user) {
        user = undefined;
    }

    let start, end;
    if (year && month) {
        const startDate = moment().year(year).month(month - 1).startOf('month');
        start = startDate.format('YYYY-MM-DD');
        end = startDate.clone().add(1, 'month').format('YYYY-MM-DD');
    } else if (year) {
        const startDate = moment().year(year).startOf('year');
        start = startDate.format('YYYY-MM-DD');
        end = startDate.clone().add(1, 'year').format('YYYY-MM-DD');
    }

    console.log("dsfsgs", start, end);

    const today = moment();

    const [allBasicSalaries, appSettings, allHolidays] = await Promise.all([
        basicSalaryModel.find().populate('user', 'fullName').lean(),
        AppSettingModel.findOne().lean(),
        HolidayEventModel.find({ isLeaveOnDay: true }).lean()
    ]);

    const monthlyTotalHours = appSettings.monthlyTotalHours;
    const holidayDateSet = new Set(allHolidays.map(h => moment(h.eventDate).format('YYYY-MM-DD')));

    const allUserIds = allBasicSalaries.map(item => item.user._id);
    const [allUserLeaves, allUserPunchReports] = await Promise.all([
        LeaveModel.find({ user: { $in: allUserIds } }).lean(),
        punchReportModel.find({ user: { $in: allUserIds } }).lean()
    ]);

    const salaryReportBulkOps = [];
    const punchReportBulkOps = [];

    for (const item of allBasicSalaries) {
        const salaryStart = moment(item.startDate).startOf('month');
        let iterDate = salaryStart.clone();

        const userLeaves = allUserLeaves.filter(leave => leave.user.toString() === item.user._id.toString());

        while (iterDate.isBefore(today.clone().startOf('month'))) {
            const startOfMonth = iterDate.clone().startOf('month');
            const endOfMonth = iterDate.clone().endOf('month');
            const effectiveStart = moment.max(startOfMonth, salaryStart);
            const reportDate = iterDate.format('YYYY-MM-DD');

            const existingReport = await salaryReportModel.findOne({
                user: item.user._id,
                date: reportDate,
                reportType
            }).lean();

            const preservedBasicSalary = existingReport ? existingReport.basicSalary : item.basicSalary;


            let reportData = {
                user: item.user._id,
                userName: item.user.fullName,
                basicSalary: preservedBasicSalary,
                date: reportDate,
                deductionAmount: null,
                reportType
            };

            if (reportType === 'leaveWise') {
                const userLeavesInMonth = userLeaves.filter(leave =>
                    leave.isDeductible &&
                    leave.status === leaveLabelKeys.approved &&
                    moment(leave.startDate).isBetween(effectiveStart, endOfMonth, null, '[]')
                );

                const totalLeaveHours = sumTotalLeaveHours(userLeavesInMonth);
                const totalWorkingDays = endOfMonth.diff(effectiveStart, 'days') + 1;
                const totalWorkingHours = totalWorkingDays * 9;
                const hourlyRate = preservedBasicSalary / totalWorkingHours;
                const leaveDeduction = Math.round(totalLeaveHours * hourlyRate);
                const netSalary = Math.max(Math.round(preservedBasicSalary - leaveDeduction), 0);

                Object.assign(reportData, {
                    leaveHours: totalLeaveHours,
                    deductionAmount: leaveDeduction,
                    netSalary
                });
            } else if (reportType === 'punchWise') {
                const userPunchReports = allUserPunchReports.filter(report =>
                    report.user.toString() === item.user._id.toString() &&
                    report.punchReport.some(punch =>
                        moment(punch.date).isBetween(effectiveStart, endOfMonth, null, '[]')
                    )
                );

                if (!userPunchReports.length) {
                    iterDate.add(1, 'month');
                    continue;
                }

                let totalWorkingMin = 0;
                let totalMissingMin = 0;
                let totalDeductMin = 0;

                for (const report of userPunchReports) {
                    for (const punch of report.punchReport) {
                        const punchDate = moment(punch.date).format('YYYY-MM-DD');

                        if (holidayDateSet.has(punchDate)) {
                            continue;
                        }

                        totalWorkingMin += toMinutes(punch.workingHours);
                        totalMissingMin += toMinutes(punch.missingHours);

                        if (
                            moment(punch.date).isBetween(effectiveStart, endOfMonth, 'day', '[]') && punch.isDeductible && punch.status !== 'WO'
                        ) {
                            if (punch.status === 'A') {
                                if (punch.deductForDate) {
                                    let calculateDeduct = parseFloat(punch.deductForDate.deductHours)
                                    // 45/9=5 <= this rules implement here
                                    calculateDeduct = calculateDeduct * 5;
                                    totalDeductMin += parseFloat(punch.deductForDate.deductMinutes) - calculateDeduct;
                                } else {
                                    totalDeductMin += toMinutes(punch.missingHours);
                                }
                            } else {
                                totalDeductMin += toMinutes(punch.missingHours);
                            }
                        }
                    }
                }

                const monthName = iterDate.format('MMMM').toLowerCase();
                const expectedHours = monthlyTotalHours[monthName] || 0;
                const totalSalaryMinutes = expectedHours * 60;
                const perMinuteRate = preservedBasicSalary / totalSalaryMinutes;
                const deduction = perMinuteRate * totalDeductMin;
                const netSalary = preservedBasicSalary - deduction;

                Object.assign(reportData, {
                    totalWorkingMinutes: totalWorkingMin,
                    totalWorkingHours: totalWorkingMin / 60,
                    totalMissingMinutes: totalMissingMin,
                    totalMissingHours: totalMissingMin / 60,
                    totalDeductMinutes: totalDeductMin,
                    totalDeductHours: totalDeductMin / 60,
                    expectedTotalHours: expectedHours,
                    deductionAmount: deduction.toFixed(0),
                    netSalary: netSalary.toFixed(0),
                });
            }

            const salaryReportData = await salaryReportModel.findOne({
                user: item.user._id,
                date: reportDate,
                reportType
            }).lean();

            const basicSalary = parseFloat(decrypt(preservedBasicSalary));
            const originalDeduction = parseFloat(reportData.deductionAmount || 0);
            let bonusAmount = parseFloat(salaryReportData ? decrypt(salaryReportData.bonus) : 0);
            let deductAmount = parseFloat(salaryReportData ? decrypt(salaryReportData.deduct) : 0);

            if (isNaN(bonusAmount)) {
                bonusAmount = 0;
            }
            if (isNaN(deductAmount)) {
                deductAmount = 0;
            }

            const updatedDeduction = Math.max(originalDeduction + deductAmount, 0);
            const updatedNetSalary = ((basicSalary - updatedDeduction) + bonusAmount);

            reportData.deductionAmount = updatedDeduction;
            reportData.netSalary = updatedNetSalary;

            salaryReportBulkOps.push({
                updateOne: {
                    filter: {
                        user: item.user._id,
                        date: reportDate,
                        reportType
                    },
                    update: { $set: reportData },
                    upsert: true
                }
            });

            iterDate.add(1, 'month');
        }
    }

    if (salaryReportBulkOps.length > 0) {
        await salaryReportModel.bulkWrite(salaryReportBulkOps);
    }

    const filters = {};
    if (user) filters.user = user;
    if (start && end) filters.date = { $gte: start, $lt: end };
    if (reportType) filters.reportType = reportType;

    const formattedMonth = String(month).padStart(2, "0");
    const regexDatePrefix = `${year}-${formattedMonth}`;

    const hasUnpublished = await salaryReportModel.exists({
        reportType,
        date: { $regex: `^${regexDatePrefix}` },
        isPublished: false,
    });

    const reports = await salaryReportModel.find(filters).populate('user', 'fullName').lean();

    const formattedReportList = await generateReportObject(reports);

    return {
        list: formattedReportList,
        month: month,
        year: year,
        isPublished: !hasUnpublished,
    };
};

module.exports = {
    addUpdateBasicSalary,
    basicSalaryList,
    deleteBasicSalary,
    generateSalaryReports,
    updateSalary,
    updateSalaryReport,
    publishSalaryReport,
    getUserWiseReport,
    salaryCodeVerify,
}