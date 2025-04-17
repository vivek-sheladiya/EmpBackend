const {
    handleError,
} = require("../utils/utils");
const { leaveModel } = require('../Models/LeaveModel')


const list = async (req, res) => {
    try {
        const leaveList = await leaveModel.find({}).populate('employee', 'fullName')
        return res.status(201).json({
            success: true,
            message: "leave get Successfully.",
            leaveList
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
            employee: userId
        }).populate('employee', 'fullName');
        return res.status(201).json({
            success: true,
            message: "employee leave get Successfully.",
            empLeave
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
        const body = req.body;
        const { leave_category, start_date } = req.body;
        const userId = req.user._id
        if (leave_category === 'Paid(Sick)') {
            const date = new Date(start_date);
            const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            const startOfYear = new Date(date.getFullYear(), 0, 1);
            const endOfYear = new Date(date.getFullYear(), 11, 31);

            const startOfMonthStr = startOfMonth.toISOString().split('T')[0];
            const endOfMonthStr = endOfMonth.toISOString().split('T')[0];
            const startOfYearStr = startOfYear.toISOString().split('T')[0];
            const endOfYearStr = endOfYear.toISOString().split('T')[0];

            const paidLeavesThisMonth = await leaveModel.find({
                employee: userId,
                leave_category: 'Paid(Sick)',
                start_date: {
                    $gte: startOfMonthStr,
                    $lte: endOfMonthStr,
                },
            });
            if (paidLeavesThisMonth.length >= 2) {
                return handleError(res, "Only 2 paid leaves allowed per month.", 400);
            }
            const paidLeavesThisYear = await leaveModel.find({
                employee: userId,
                leave_category: 'Paid(Sick)',
                start_date: {
                    $gte: startOfYearStr,
                    $lte: endOfYearStr,
                },
            });
            if (paidLeavesThisYear.length >= 12) {
                return handleError(res, "Only 12 paid leaves allowed per year.", 400);
            }
        }
        const EmpLeave = await leaveModel.create(body);
        EmpLeave.employee = userId;
        await EmpLeave.save();
        return res.status(201).json({
            success: true,
            message: "Leave Added Successfully."
        });
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
        return res.status(201).json({
            success: true,
            message: "Leave Deleted Successfully.",
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
        const { status } = req.body;
        const leaveList = await leaveModel.findByIdAndUpdate({ _id: id }, { $set: { status: status } }, { new: true, runValidators: true });
        if (!leaveList) {
            return handleError(res, "Leave Not Found.", 400);
        }
        return res.status(201).json({
            success: true,
            message: "Leave Status Change Successfully."
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

module.exports = {
    addLeave,
    deleteLeave,
    list,
    empLeaveList,
    LeaveStatusChange
}