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
        const startOfMonth = moment([year, month]);
        const endOfMonth = moment(startOfMonth).endOf('month');
        const today = moment();
        const allBasicSalaries = await basicSalaryModel.find().populate('user', 'fullName');
        const newReports = [];
        for (const item of allBasicSalaries) {
            const userId = item.user._id;
            const salaryStartDate = moment(item.startDate).startOf('month');
            const currentMonth = moment().startOf('month');
            let iterDate = moment(salaryStartDate);
            while (iterDate.isSameOrBefore(currentMonth)) {
                const startOfMonth = moment(iterDate).startOf('month');
                const endOfMonth = moment(iterDate).endOf('month');
                const effectiveEndDate = moment.min(endOfMonth, today);
                const effectiveStartDate = moment.max(startOfMonth, salaryStartDate);
                const durationDays = effectiveEndDate.diff(effectiveStartDate, 'days') + 1;
                const totalWorkingHours = durationDays * 9;
                const userLeave = await leaveModel.find({
                    user: userId,
                    startDate: { $gte: effectiveStartDate.toDate(), $lte: effectiveEndDate.toDate() },
                    status: 'approved'
                });
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
                            } else {
                                console.log(`Normal cut applied (leave ${countBeforeOrEqual}):`, effectiveHours);
                            }
                        }
                        return total + effectiveHours;
                    }
                    return total;
                }, 0);
                const hourlyRate = item.basicSalary / totalWorkingHours;
                const leaveDeduction = totalLeaveHours * hourlyRate;
                const netSalary = Math.max(item.basicSalary - leaveDeduction, 0);
                newReports.push({
                    user: userId,
                    userName: item.user.fullName,
                    basicSalary: item.basicSalary,
                    leaveHours: totalLeaveHours,
                    deductionAmount: parseFloat(leaveDeduction.toFixed(2)),
                    netSalary: parseFloat(netSalary.toFixed(2)),
                    month: startOfMonth.format("YYYY-MM"),
                });
                iterDate.add(1, 'month');
            }
        }
        const createdReports = await salaryReportModel.insertMany(newReports);
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