const {
    handleError,
} = require("../utils/utils");
const moment = require('moment');

const { basicSalaryModel } = require('../Models/basicSalaryModel');
const { salaryReportModel } = require('../Models/salaryReportModel');
const { leaveModel } = require('../Models/LeaveModel');
const { manualHoursModel } = require('../Models/manualHoursModel')

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
            if (!user) return handleError(res, "user is required.", 400);
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
        const allBasicSalaries = await basicSalaryModel.find().populate('user', 'fullName');
        const yearsData = await manualHoursModel.distinct('year');
        const monthNames = [
            "january", "february", "march", "april", "may", "june",
            "july", "august", "september", "october", "november", "december"
        ];
        const newReports = [];
        for (const year of yearsData) {
            const monthlyHoursData = await manualHoursModel.findOne({ year });
            for (const month of monthNames) {
                const monthLower = month.toLowerCase();
                const workingHoursForMonth = monthlyHoursData.monthly_hours[monthLower];
                for (const item of allBasicSalaries) {
                    const userId = item.user._id;
                    const monthNumber = monthNames.indexOf(month);
                    const startOfMonth = new Date(year, monthNumber, 1);
                    const endOfMonth = new Date(year, monthNumber + 1, 0, 23, 59, 59);
                    const userLeave = await leaveModel.find({
                        user: userId,
                        startDate: { $gte: startOfMonth, $lte: endOfMonth }
                    });
                    const totalLeaveHours = userLeave.reduce((total, leave) => {
                        if (leave.hours && typeof leave.hours === 'string') {
                            const hours = parseFloat(leave.hours.split(' ')[0]);
                            return total + (isNaN(hours) ? 0 : hours);
                        }
                        return total;
                    }, 0);
                    let deductionAmount = 0;
                    const perHourSalary = item.basicSalary / workingHoursForMonth;
                    deductionAmount = totalLeaveHours * perHourSalary;
                    deductionAmount = parseFloat(deductionAmount.toFixed(2));
                    const netSalary = parseFloat((item.basicSalary - deductionAmount).toFixed(2));
                    newReports.push({
                        user: userId,
                        userName: item.user.fullName,
                        basicSalary: item.basicSalary,
                        leaveHours: totalLeaveHours,
                        year: year,
                        month: month,
                        workingHoursForMonth,
                        deductionAmount,
                        netSalary
                    });
                }
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