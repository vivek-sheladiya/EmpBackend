const {
    handleError,
} = require("../utils/utils");
const moment = require('moment');

const { basicSalaryModel } = require('../Models/basicSalaryModel');
const { salaryReportModel } = require('../Models/salaryReportModel');
const { leaveModel } = require('../Models/LeaveModel');
const { manualHoursModel } = require('../Models/manualHoursModel');

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
        const now = moment();
        const year = now.year();
        const month = now.month();
        const startOfMonth = moment([year, month]).subtract(1, 'month');
        console.log("startOfMonth", startOfMonth)
        const endOfMonth = moment(startOfMonth).endOf('month');
        const today = moment();
        const allBasicSalaries = await basicSalaryModel.find().populate('user', 'fullName');
        const newReports = [];
        for (const item of allBasicSalaries) {
            const salaryStartDate = moment(item.startDate).startOf('month');
            let iterDate = moment(salaryStartDate);
            console.log('iterDate:', iterDate.format('YYYY-MM-DD'));
            console.log('Current Month:', iterDate.format('YYYY-MM'));
            console.log('Start of Month:', startOfMonth.format('YYYY-MM-DD'));
            console.log('End of Month:', endOfMonth.format('YYYY-MM-DD'));

            // const endOfMonth = moment().endOf('month');
            // const isMonthCompleted = now.isSame(endOfMonth, 'day');

            while (iterDate.isSameOrBefore(today, 'month')) {
                const startOfMonth = moment(iterDate).startOf('month');
                const endOfMonth = moment(iterDate).subtract(1, 'month').endOf('month');
                const effectiveEndDate = moment.min(endOfMonth, today);
                console.log("effectiveEndDate", effectiveEndDate)
                const effectiveStartDate = moment.max(startOfMonth, salaryStartDate);
                const effectiveEndDate1 = moment.min(endOfMonth, today).format('YYYY-MM-DD');
                console.log("effectiveEndDate1", effectiveEndDate1)
                const effectiveStartDate1 = moment.max(startOfMonth, salaryStartDate).format('YYYY-MM-DD');
                const durationDays = effectiveEndDate.diff(effectiveStartDate, 'days') + 1;
                const totalWorkingHours = durationDays * 9;
                const userLeave = await leaveModel.find({
                    user: item.user,
                    startDate: { $gte: effectiveEndDate1, $lte: effectiveStartDate1 },
                    status: 'approved'
                });
                console.log("userLeave", userLeave)
                const totalLeaveHours = userLeave.reduce((total, leave) => {
                    if (leave.hours && typeof leave.hours === 'string') {
                        const hours = parseFloat(leave.hours.split(' ')[0]);
                        const actualHours = isNaN(hours) ? 0 : hours;
                        let effectiveHours = leave.sandwichLeave ? actualHours * 2 : actualHours;
                        if (leave.isUnexpected) {
                            const leaveYear = moment(leave.startDate).year();
                            const sameYearUnexpectedLeaves = userLeave.filter(l =>
                                l.isUnexpected &&
                                moment(l.startDate).year() === leaveYear &&
                                moment(l.startDate).isSameOrBefore(moment(leave.startDate))
                            );
                            const countBeforeOrEqual = sameYearUnexpectedLeaves.length;
                            if (countBeforeOrEqual > 12) {
                                effectiveHours *= 3;
                            } else if (countBeforeOrEqual > 3) {
                                effectiveHours *= 2;
                            }
                        }
                        return total + effectiveHours;
                    }
                    return total;
                }, 0);
                const hourlyRate = item.basicSalary / totalWorkingHours;
                const leaveDeduction = totalLeaveHours * hourlyRate;
                const netSalary = Math.max(item.basicSalary - leaveDeduction, 0);
                const reportData = {
                    user: item.user._id,
                    userName: item.user.fullName,
                    basicSalary: item.basicSalary,
                    leaveHours: totalLeaveHours,
                    deductionAmount: parseFloat(leaveDeduction.toFixed(2)),
                    netSalary: parseFloat(netSalary.toFixed(2)),
                    date: startOfMonth.format("YYYY-MM-DD"),
                };
                const existingReport = await salaryReportModel.findOne({
                    user: item.user._id,
                    date: startOfMonth.format("YYYY-MM-DD"),
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

            // while (iterDate.isSameOrBefore(today, 'month')) {
            //     // Use iterDate directly to calculate start and end of the current month
            //     const currentMonthStart = moment(iterDate).startOf('month');
            //     const currentMonthEnd = moment(iterDate).endOf('month');

            //     const effectiveEndDate = moment.min(currentMonthEnd, today);
            //     const effectiveStartDate = moment.max(currentMonthStart, salaryStartDate);

            //     const durationDays = effectiveEndDate.diff(effectiveStartDate, 'days') + 1;
            //     const totalWorkingHours = durationDays * 9;

            //     // Leave calculations and other logic remain unchanged

            //     const reportData = {
            //         user: item.user._id,
            //         userName: item.user.fullName,
            //         basicSalary: item.basicSalary,
            //         leaveHours: totalLeaveHours,
            //         deductionAmount: parseFloat(leaveDeduction.toFixed(2)),
            //         netSalary: parseFloat(netSalary.toFixed(2)),
            //         date: currentMonthStart.format("YYYY-MM-DD"),  // Use currentMonthStart
            //     };

            //     const existingReport = await salaryReportModel.findOne({
            //         user: item.user._id,
            //         date: currentMonthStart.format("YYYY-MM-DD"),  // Use currentMonthStart
            //     });

            //     if (existingReport) {
            //         await salaryReportModel.updateOne(
            //             { _id: existingReport._id },
            //             { $set: reportData }
            //         );
            //     } else {
            //         newReports.push(reportData);
            //     }

            //     iterDate.add(1, 'month');
            // }

        }
        if (newReports.length > 0) {
            const createdReports = await salaryReportModel.insertMany(newReports);
        }
        const dataList = await salaryReportModel.find({}).populate('user', 'fullName');
        const formattedLeave = formatLeaveList(dataList);
        return res.status(201).json({
            success: true,
            message: "Salary reports generated for all years and months.",
            data: formattedLeave,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
};



module.exports = {
    addUpdateBasicSalary,
    basicSalaryList,
    deleteBasicSalary,
    generateSalaryReports
}