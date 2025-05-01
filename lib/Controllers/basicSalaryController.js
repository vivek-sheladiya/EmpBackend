const {
    handleError,
} = require("../utils/utils");
const moment = require('moment');
const mongoose = require('mongoose');

const { basicSalaryModel } = require('../Models/basicSalaryModel');
const { salaryReportModel } = require('../Models/salaryReportModel');
const { leaveModel } = require('../Models/LeaveModel');
const { manualHoursModel } = require('../Models/manualHoursModel');
const {HolidayEventModel} = require("../Models/HolidayEventModel");

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

                const totalLeaveHours = calculateTotalLeaveHours(userLeave, allHolidays);
                const hourlyRate = item.basicSalary / totalWorkingHours;
                const leaveDeduction = Math.round(totalLeaveHours * hourlyRate);
                const netSalary = Math.max(Math.round(item.basicSalary - leaveDeduction), 0);

                const reportDate = startOfMonth.format("YYYY-MM-DD");
                const reportData = {
                    user: item.user._id,
                    userName: item.user.fullName,
                    basicSalary: item.basicSalary,
                    leaveHours: totalLeaveHours,
                    deductionAmount: leaveDeduction,
                    netSalary: netSalary,
                    date: reportDate,
                    salaryReportType: 'leaveWise'
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

module.exports = {
    addUpdateBasicSalary,
    basicSalaryList,
    deleteBasicSalary,
    generateSalaryReports
}