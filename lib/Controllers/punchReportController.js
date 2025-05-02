const {
    handleError,
} = require("../utils/utils");
const { punchReportModel } = require("../Models/punchReportModel");
const { AppSettingModel } = require("../Models/AppSettingModel");
const { basicSalaryModel } = require('../Models/basicSalaryModel');
const { salaryReportModel } = require('../Models/salaryReportModel');
const { leaveModel } = require('../Models/LeaveModel');
const moment = require('moment');
const xlsx = require('xlsx');
const fs = require('fs');

const storePunchReports = async (req, res) => {
    try {
        // const { userId } = req.file.path;
        const { userId } = req.body;
        console.log("userId", userId)
        const filePath = req.file.path;
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        const headersRowIndex = 10;
        const headers = rawData[headersRowIndex] || [];
        let empName = '';
        let empCode = '';
        rawData.forEach((row, index) => {
            if (row.some(cell => typeof cell === 'string')) {
                row.forEach(cell => {
                    if (typeof cell === 'string') {
                        if (cell.includes("Emp.Name:-")) {
                            empName = cell.split("Emp.Name:-")[1]?.trim();
                            console.log("Found empName:", empName);
                        }
                        if (cell.includes("Emp.Code:-")) {
                            empCode = cell.split("Emp.Code:-")[1]?.trim();
                            console.log("Found empCode:", empCode);
                        }
                    }
                });
            }
        });
        const excelDateToJSDate = (serial) => {
            const utc_days = Math.floor(serial - 25569);
            const utc_value = utc_days * 86400;
            const date_info = new Date(utc_value * 1000);
            return date_info.toISOString().split('T')[0];
        };
        const dataRows = rawData.slice(headersRowIndex + 1);
        const result = dataRows.map((row) => {
            const rowData = {};
            headers.forEach((header, index) => {
                if (header) {
                    const key = header.toString().trim();
                    let value = row[index] !== undefined && row[index] !== '' ? row[index] : null;
                    if (key === "Date" && typeof value === "number") {
                        value = excelDateToJSDate(value);
                    }
                    rowData[key] = value;
                }
            });
            return rowData;
        }).filter(row => row["Date"] != null && row["Date"] !== "");
        for (const row of result) {
            let settings = await AppSettingModel.findOne();
            const date = new Date(row["Date"]);
            const day = date.getDay();
            let workingHours = row["W.Hrs"] || "0:00";
            let [workingHrs, workingMins] = workingHours.split(":").map(Number);
            let workingTotalMinutes = workingHrs * 60 + workingMins;
            const totalMinutes = day === 6 ? 4 * 60 : 9 * 60;
            const lunchBreakMinutes = settings.appSettings.breakDuration;
            let missingMinutes;
            if (workingTotalMinutes === 0) {
                missingMinutes = day === 6
                    ? totalMinutes
                    : Math.max(0, totalMinutes - lunchBreakMinutes);
            } else {
                missingMinutes = Math.max(0, totalMinutes - workingTotalMinutes);
            }
            const convertToHoursAndMinutes = (minutes) => {
                const hours = Math.floor(minutes / 60);
                const remainingMinutes = minutes % 60;
                return { hours, minutes: remainingMinutes };
            };
            const workingTime = convertToHoursAndMinutes(workingTotalMinutes);
            const missingTime = convertToHoursAndMinutes(missingMinutes);
            const punchList = [];
            for (let i = 1; i <= 8; i++) {
                const timeIn = row[`In${i}`] && row[`In${i}`].trim() !== '' ? row[`In${i}`] : null;
                const timeOut = row[`Out${i}`] && row[`Out${i}`].trim() !== '' ? row[`Out${i}`] : null;
                if (timeIn) punchList.push({ type: 'in', time: timeIn });
                if (timeOut) punchList.push({ type: 'out', time: timeOut });
            }
            await punchReportModel.findOneAndUpdate(
                { empCode: empCode, "punchReport.date": date },
                {
                    $set: {
                        "punchReport.$.punchList": punchList,
                        "punchReport.$.workingHours": `${workingTime.hours}:${workingTime.minutes.toString().padStart(2, '0')}`,
                        "punchReport.$.missingHours": `${missingTime.hours}:${missingTime.minutes.toString().padStart(2, '0')}`,
                        "punchReport.$.status": row["Status"] || null
                    }
                },
                { new: true }
            ).then(async updated => {
                if (!updated) {
                    await punchReportModel.findOneAndUpdate(
                        { empCode: empCode },
                        {
                            $setOnInsert: {
                                empCode: empCode,
                                // userName: empName
                                user: userId
                            },
                            $push: {
                                punchReport: {
                                    date: date,
                                    punchList: punchList,
                                    workingHours: `${workingTime.hours}:${workingTime.minutes.toString().padStart(2, '0')}`,
                                    missingHours: `${missingTime.hours}:${missingTime.minutes.toString().padStart(2, '0')}`,
                                    status: row["Status"] || null
                                }
                            }
                        },
                        {
                            upsert: true,
                            new: true
                        }
                    );
                }
            });
        }
        fs.unlink(req.file.path, (err) => {
            if (err) {
                console.error("Error deleting file:", err);
            } else {
                console.log("Uploaded file deleted successfully.");
            }
        });
        return res.status(201).json({
            success: true,
            message: "Punch data get successfully.",
            meta: {
                empName,
                empCode
            },
            data: result,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
};

const getPunchReports = async (req, res) => {
    try {
        const punchReportsList = await punchReportModel.find({}).populate('user', 'fullName');
        const list = punchReportsList.map(punchData => {
            return {
                ...punchData._doc,
                user: {
                    userId: punchData.user._id,
                    fullName: punchData.user.fullName
                }
            };
        });
        return res.status(201).json({
            success: true,
            message: "Punch data get successfully.",
            data: list,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

const deletePunchReports = async (req, res) => {
    try {
        const id = req.params._id;
        const deletePunchReports = await punchReportModel.findByIdAndDelete({ _id: id })
        return res.status(201).json({
            success: true,
            message: "Punch data deleted successfully.",
            data: deletePunchReports,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

const updatePunchReports = async (req, res) => {
    try {
        const id = req.params._id;
        const { empCode, userName, punchReport } = req.body;
        const { date, punchList, status, workingHours, missingHours } = punchReport;
        const parsedDate = new Date(date + 'T00:00:00.000Z');
        const updateData = {
            empCode,
            userName,
            "punchReport.$[elem].punchList": punchList,
            "punchReport.$[elem].status": status,
            "punchReport.$[elem].workingHours": workingHours,
            "punchReport.$[elem].missingHours": missingHours
        };
        const updateOptions = {
            arrayFilters: [{ "elem.date": parsedDate }],
            new: true
        };
        const updatedPunchReport = await punchReportModel.findByIdAndUpdate(
            id,
            { $set: updateData },
            updateOptions
        );
        if (!updatedPunchReport) {
            return res.status(404).json({
                success: false,
                message: "Punch report not found.",
            });
        }
        return res.status(200).json({
            success: true,
            message: "Punch data updated successfully.",
            data: updatedPunchReport,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
};

const salaryReportsGenerate = async (req, res) => {
    try {
        const today = moment();
        const lastMonth = moment().subtract(1, 'month');
        const allBasicSalaries = await basicSalaryModel.find().populate('user', 'fullName');
        const newReports = [];
        const appSettings = await AppSettingModel.findOne();
        const monthlyTotalHours = appSettings.monthlyTotalHours;

        for (const item of allBasicSalaries) {
            const salaryStartDate = moment(item.startDate).startOf('month');
            let iterDate = moment(salaryStartDate);

            while (iterDate.isSameOrBefore(today, 'month')) {
                const startOfMonth = moment(iterDate).startOf('month');
                const endOfMonth = moment(iterDate).endOf('month');
                const effectiveStartDate = moment.max(startOfMonth, salaryStartDate);
                const effectiveEndDate = moment.min(endOfMonth, today);
                const userPunchReports = await punchReportModel.find({
                    user: item.user,
                    'punchReport.date': {
                        $gte: effectiveStartDate.toDate(),
                        $lte: effectiveEndDate.toDate()
                    },
                });
                if (userPunchReports.length === 0) {
                    iterDate.add(1, 'month');
                    continue;
                }
                const allPunches = [];
                userPunchReports.forEach(report => {
                    report.punchReport.forEach(entry => {
                        if (
                            new Date(entry.date) >= effectiveStartDate.toDate() &&
                            new Date(entry.date) <= effectiveEndDate.toDate()
                        ) {
                            allPunches.push({
                                date: entry.date,
                                status: entry.status,
                                workingHours: entry.workingHours,
                                missingHours: entry.missingHours,
                                punchList: entry.punchList.map(p => ({
                                    time: p.time,
                                    type: p.type
                                }))
                            });
                        }
                    });
                });

                function hhmmToMinutes(hhmm) {
                    if (!hhmm) return 0;
                    if (typeof hhmm === 'number') return Math.round(hhmm * 60);
                    const [hours, minutes] = hhmm.split(':').map(Number);
                    return hours * 60 + (minutes || 0);
                }
                let totalWorkingMinutes = 0;
                let totalMissingMinutes = 0;
                allPunches.forEach(entry => {
                    const working = hhmmToMinutes(entry.workingHours);
                    const missing = hhmmToMinutes(entry.missingHours);
                    totalWorkingMinutes += working;
                    totalMissingMinutes += missing;
                });
                const workingHours = Math.floor(totalWorkingMinutes / 60);
                const workingMins = totalWorkingMinutes % 60;
                const missingHours = Math.floor(totalMissingMinutes / 60);
                const missingMins = totalMissingMinutes % 60;
                const monthName = iterDate.format('MMMM').toLowerCase();
                const expectedTotalHours = monthlyTotalHours[monthName] || 0;
                const actualTotalHours = workingHours + (workingMins / 60);
                const difference = expectedTotalHours - actualTotalHours;
                const totalWorkingTimeInMinutes = hhmmToMinutes(expectedTotalHours.toString() + ':00');
                const salaryPerMinute = item.basicSalary / totalWorkingTimeInMinutes;
                const deduction = salaryPerMinute * totalMissingMinutes;
                const netSalary = item.basicSalary - deduction;
                reportData = {
                    user: item.user._id,
                    userName: item.user.fullName,
                    basicSalary: item.basicSalary,
                    date: iterDate.format('YYYY-MM-DD'),
                    totalWorkingTime: {
                        hours: workingHours,
                        minutes: workingMins,
                    },
                    totalMissingTime: {
                        hours: missingHours,
                        minutes: missingMins,
                    },
                    punches: allPunches,
                    expectedTotalHours,
                    differenceFromExpected: difference.toFixed(2),
                    netSalary: netSalary.toFixed(2),
                    salaryReportType: 'punchWise'
                }
                const date = iterDate.format('YYYY-MM-DD')
                const existingReport = await salaryReportModel.findOne({
                    user: item.user._id,
                    date: date
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
        const dataList = await salaryReportModel.find({}).populate('user', 'fullName');
        const salaryReports = dataList.map(leave => {
            return {
                ...leave._doc,
                user: {
                    userId: leave.user._id,
                    fullName: leave.user.fullName
                }
            };
        });
        return res.status(200).json({
            success: true,
            message: "Punch data updated successfully.",
            data: salaryReports,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}

module.exports = {
    storePunchReports,
    getPunchReports,
    deletePunchReports,
    updatePunchReports,
    salaryReportsGenerate,
}