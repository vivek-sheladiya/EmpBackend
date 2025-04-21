const {
    handleError,
} = require("../utils/utils");
const moment = require('moment');

const { basicSalaryModel } = require('../Models/basicSalaryModel');
const { salaryReportModel } = require('../Models/salaryReportModel');
const { leaveModel } = require('../Models/LeaveModel')

const basicSalaryList = async (req, res) => {
    try {
        const basicSalaryList = await basicSalaryModel.find({}).populate('user', 'fullName');
        return res.status(201).json({ success: true, message: "Basic Salary List Get Successfully.", basicSalaryList });
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
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!id) {
            if (!user) return handleError(res, "user is required.", 400);
            if (!startDate || !dateRegex.test(startDate)) {
                return handleError(res, "Start date is required and must be in YYYY-MM-DD format.", 400);
            }
            if (!basicSalary || !code) {
                return handleError(res, "basic salary and code is required.", 400);
            }
            const basicSalaryAdd = await basicSalaryModel.create(req.body);
            return res.status(201).json({ success: true, message: "Basic Salary Added Successfully." });
        } else {
            if (startDate && !dateRegex.test(startDate)) {
                return handleError(res, "Start date must be in YYYY-MM-DD format.", 400);
            }
            const basicSalaryUpdate = await basicSalaryModel.findByIdAndUpdate({ _id: id }, req.body, { new: true });
            return res.status(201).json({ success: true, message: "Basic Salary Updated Successfully." });
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
        return res.status(201).json({ success: true, message: "Basic Salary Deleted Successfully." });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}



const generateSalaryReports = async (req, res) => {
    try {
        const { userId, salaryAdjustmentType = 0, salaryAdjustmentAmount = 0 } = req.body;

        let numericSalaryAdjustment = 0;
        let isBonus = false;
        let isDeduction = false;
        if (salaryAdjustmentType === "bonus") {
            numericSalaryAdjustment = Math.abs(Number(salaryAdjustmentAmount)) || 0; // Bonus is positive
            isBonus = true;
        } else if (salaryAdjustmentType === "deduct") {
            numericSalaryAdjustment = -Math.abs(Number(salaryAdjustmentAmount)) || 0; // Deduction is negative
            isDeduction = true;
        } else {
            numericSalaryAdjustment = Number(salaryAdjustmentType) || 0; // If it's a number, use it directly
        }

        const filter = userId ? { user: userId } : {};
        const allBasicSalaries = await basicSalaryModel.find(filter).populate('user', 'fullName');

        const newReports = [];

        // Helper function to calculate total working hours
        const getTotalWorkingHours = (year, month) => {
            const totalDays = new Date(year, month + 1, 0).getDate();
            let totalHours = 0;
            let saturdayCount = 0;

            for (let day = 1; day <= totalDays; day++) {
                const date = new Date(year, month, day);
                const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday

                if (dayOfWeek === 0) continue; // Sunday: no work

                if (dayOfWeek === 6) { // Saturday
                    saturdayCount++;
                    if ([1, 3, 5].includes(saturdayCount)) {
                        totalHours += 4;
                    }
                } else {
                    totalHours += 9; // Weekdays: 9 hours
                }
            }

            return totalHours;
        };

        // Get current month/year
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        const totalWorkingHours = getTotalWorkingHours(currentYear, currentMonth);

        for (const item of allBasicSalaries) {
            const userId = item.user._id;
            const userLeave = await leaveModel.find({ user: userId });

            const totalLeaveHours = userLeave.reduce((total, leave) => {
                const hours = parseFloat(leave.hours?.split(' ')[0]) || 0;
                return total + hours;
            }, 0);

            const perHourSalary = item.basicSalary / totalWorkingHours;
            const leaveDeductionAmount = totalLeaveHours * perHourSalary;

            const effectiveWorkingHours = totalWorkingHours - totalLeaveHours;
            const calculatedSalary = perHourSalary * effectiveWorkingHours;

            // Apply bonus or deduction based on the adjustment type
            const bonusAmount = isBonus ? numericSalaryAdjustment : 0;
            const deductAmount = isDeduction ? Math.abs(numericSalaryAdjustment) : 0;

            const finalSalary = calculatedSalary + numericSalaryAdjustment;

            newReports.push({
                user: userId,
                userName: item.user.fullName,
                basicSalary: item.basicSalary,
                totalWorkingHours,
                leaveHours: totalLeaveHours,
                perHourSalary: perHourSalary.toFixed(2),
                effectiveWorkingHours,
                deductionSalary: leaveDeductionAmount.toFixed(2),
                calculatedSalary: calculatedSalary.toFixed(2),
                bonusAmount,
                deductAmount,
                salaryAdjustmentType: isBonus ? 'bonus' : (isDeduction ? 'deduct' : 'normal'),
                netSalary: finalSalary.toFixed(2),
                leaveDetails: userLeave,
            });
        }

        console.log("Final Salary Reports:", newReports);

        const createdReports = await salaryReportModel.insertMany(newReports);

        return res.status(201).json({
            success: true,
            message: "Salary reports generated successfully.",
            salaryReports: createdReports,
        });

    } catch (err) {
        console.error("Error generating salary reports:", err);
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
};









// const generateSalaryReports = async (req, res) => {
//     try {
//         const { userId } = req.body;

//         const filter = userId ? { 'user': userId } : {};
//         const allBasicSalaries = await basicSalaryModel.find(filter).populate('user', 'fullName');
//         console.log("allBasicSalaries", allBasicSalaries);

//         const newReports = [];

//         for (const item of allBasicSalaries) {
//             const userId = item.user._id;

//             const userLeave = await leaveModel.find({ user: userId });

//             const totalLeaveHours = userLeave.reduce((total, leave) => {
//                 const hours = parseFloat(leave.hours.split(' ')[0]);
//                 console.log("hours :", hours);
//                 return total + hours;
//             }, 0);
//             console.log("totalLeaveHours::", totalLeaveHours);

//             newReports.push({
//                 user: userId,
//                 userName: item.user.fullName,
//                 basicSalary: item.basicSalary,
//                 leaveDetails: userLeave,
//                 leaveHours: totalLeaveHours
//             });
//         }

//         console.log("newReports", JSON.stringify(newReports, null, 2));

//         const createdReports = await salaryReportModel.insertMany(newReports);

//         return res.status(201).json({
//             success: true,
//             message: "Salary reports generated for new users only.",
//             salaryReports: createdReports,
//         });

//     } catch (err) {
//         return res.status(500).json({
//             success: false,
//             message: err.message,
//         });
//     }
// };


module.exports = {
    addUpdateBasicSalary,
    basicSalaryList,
    deleteBasicSalary,
    generateSalaryReports
}