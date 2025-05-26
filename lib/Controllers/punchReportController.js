const {
    handleError, leaveLabelKeys,
} = require("../utils/utils");
const { punchReportModel } = require("../Models/punchReportModel");
const { AppSettingModel } = require("../Models/AppSettingModel");
const { basicSalaryModel } = require('../Models/basicSalaryModel');
const { salaryReportModel } = require('../Models/salaryReportModel');
const { LeaveModel } = require('../Models/LeaveModel');
const moment = require('moment');
const xlsx = require('xlsx');
const fs = require('fs');
const mongoose = require("mongoose");
const { checkSandwichLeave } = require("./LeaveControllerNew");

// const getPunchReports = async (req, res) => {
//     try {
//         let user = req.query.user;
//         let year = req.query.year;
//         let month = req.query.month;
//
//         console.log("user", user, year, month);
//
//         if (user && !mongoose.Types.ObjectId.isValid(user)) {
//             if (!year && !month) {
//                 year = user;
//                 user = undefined;
//             } else {
//                 user = undefined;
//             }
//         }
//
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
//         // const today = moment();
//         // const allBasicSalaries = await basicSalaryModel.find().populate('user', 'fullName');
//         // const newReports = [];
//         // const appSettings = await AppSettingModel.findOne();
//         // const monthlyTotalHours = appSettings.monthlyTotalHours;
//
//         const punchReportsList = await punchReportModel.find({}).populate('user', 'fullName');
//         const list = punchReportsList.map(punchData => {
//             return {
//                 ...punchData._doc,
//                 user: {
//                     userId: punchData.user._id,
//                     fullName: punchData.user.fullName
//                 }
//             };
//         });
//         return res.status(201).json({
//             success: true,
//             message: "Punch data get successfully.",
//             data: list,
//         });
//     } catch (err) {
//         return res.status(500).json({
//             success: false,
//             message: err.message,
//         });
//     }
// }

const getPunchReports = async (req, res) => {
    try {
        let { user, year, month } = req.query;
        const currentDate = moment();
        if (!year || !month) {
            const previousMonth = currentDate.clone().subtract(1, 'month');
            year = previousMonth.year();
            month = previousMonth.month();

        } else {
            year = parseInt(year);
            month = parseInt(month) - 1;
        }

        const query = user ? { user } : {};
        const allPunchReports = await punchReportModel.find(query).populate('user', 'fullName');

        const filteredData = [];

        for (const punchData of allPunchReports) {
            let filteredPunches = punchData.punchReport.filter(pr => {
                const date = moment(pr.date, "YYYY-MM-DD");
                return date.year() === year && date.month() === month;
            });

            if (filteredPunches.length === 0 && (!req.query.year || !req.query.month)) {
                // Fallback: find latest available past month with data
                const pastReports = punchData.punchReport
                    .filter(pr => moment(pr.date, "YYYY-MM-DD").isBefore(currentDate, 'month'))
                    .sort((a, b) => moment(b.date).diff(moment(a.date)));

                let fallbackMonth = null;
                let fallbackYear = null;

                for (const report of pastReports) {
                    const reportDate = moment(report.date, "YYYY-MM-DD");
                    const y = reportDate.year();
                    const m = reportDate.month();

                    const exists = punchData.punchReport.filter(pr => {
                        const d = moment(pr.date, "YYYY-MM-DD");
                        return d.year() === y && d.month() === m;
                    });

                    if (exists.length > 0) {
                        fallbackMonth = m;
                        fallbackYear = y;
                        filteredPunches = exists;
                        break;
                    }
                }
            }

            if (filteredPunches.length > 0) {
                filteredData.push({
                    ...punchData._doc,
                    punchReport: filteredPunches
                });
            }
        }

        return res.status(200).json({
            success: true,
            message: "Punch data retrieved successfully.",
            data: filteredData
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
};

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
        const { empCode, user, punchReport } = req.body;
        const { date, punchList, status, workingHours, missingHours } = punchReport;
        const doc = await punchReportModel.findOne({ _id: id });
        if (!doc) {
            return res.status(404).json({ success: false, message: "Document not found." });
        }
        const report = doc.punchReport.find(r => r.date === date);
        if (!report) {
            return res.status(404).json({ success: false, message: "Date not found in punchReport." });
        }
        const requestPunchTypes = new Map();
        for (const p of punchList) {
            requestPunchTypes.set(p.type.toLowerCase(), p.time);
        }
        for (const punch of punchList) {

            const { type, time } = punch;
            const lowerType = type.toLowerCase();

            if (lowerType.startsWith("out")) {
                const inType = "in" + lowerType.slice(3);
                const inTimeInRequest = requestPunchTypes.get(inType);

                if (!inTimeInRequest || inTimeInRequest.trim() === "") {
                    const inFromDb = report.punchList.find(
                        p => p.type.toLowerCase() === inType && typeof p.time === "string" && p.time.trim() !== ""
                    );
                    if (!inFromDb) {
                        return res.status(400).json({
                            success: false,
                            message: `Cannot update '${type}' because '${inType}' does not have a valid time.`,
                        });
                    }
                }
            }
        }
        for (const punch of punchList) {
            const punchItem = report.punchList.find(p => p.type === punch.type);
            if (punchItem) {
                punchItem.time = punch.time;
            } else {
                report.punchList.push({ type: punch.type, time: punch.time });
            }
        }

        const calculateWorkingHours = (punchList) => {
            let totalMinutes = 0;

            for (let i = 1; i <= 9; i++) {
                const inPunch = punchList.find(p => p.type.toLowerCase() === `in${i}`);
                const outPunch = punchList.find(p => p.type.toLowerCase() === `out${i}`);

                if (inPunch?.time && outPunch?.time && inPunch.time.includes(":") && outPunch.time.includes(":")) {
                    const [inH, inM] = inPunch.time.split(":").map(Number);
                    let [outH, outM] = outPunch.time.split(":").map(Number);

                    const inMinutes = inH * 60 + inM;
                    let outMinutes = outH * 60 + outM;

                    if (outMinutes < inMinutes) {
                        outH += 12;
                        outMinutes = outH * 60 + outM;
                    }

                    const duration = outMinutes - inMinutes;
                    if (duration > 0) {
                        totalMinutes += duration;
                    }
                }
            }

            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;

            return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
        };

        report.workingHours = calculateWorkingHours(report.punchList);

        const expectedHours = "08:15";
        const [expH, expM] = expectedHours.split(":").map(Number);
        const expectedMinutes = expH * 60 + expM;

        const [wrkH, wrkM] = report.workingHours.split(":").map(Number);
        const workedMinutes = wrkH * 60 + wrkM;

        let missingMinutes = expectedMinutes - workedMinutes;
        if (missingMinutes < 0) missingMinutes = 0;

        const missingH = Math.floor(missingMinutes / 60);
        const missingM = missingMinutes % 60;

        report.missingHours = `${missingH.toString().padStart(2, "0")}:${missingM.toString().padStart(2, "0")}`;

        report.status = status || report.status;
        doc.empCode = empCode;
        doc.user = user;
        await doc.save();
        const dataList = await punchReportModel.find({}).populate('user', 'fullName');

        return res.status(200).json({
            success: true,
            message: "Punch data updated successfully.",
            data: dataList,
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
                    reportType: 'punchWise'
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

        return res.status(200).json({
            success: true,
            message: "Punch data updated successfully.",
            data: dataList,
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message,
        });
    }
}
// =============================

const getLeaveDateMap = (userLeaves) => {
    const leaveDateMap = new Map();

    for (const leave of userLeaves) {
        const start = moment(leave.startDate);
        const end = leave.endDate ? moment(leave.endDate) : start;
        for (let date = start.clone(); date.isSameOrBefore(end); date.add(1, 'day')) {
            const dateStr = date.format('YYYY-MM-DD');
            const matchedDateEntry = leave.deductHoursDateWise.find(
                (entry) => entry.date === dateStr
            );
            const plainLeave = leave.toObject(); // convert Mongoose doc to plain JS object

            plainLeave.deductForDate = {
                date: dateStr,
                deductHours: matchedDateEntry ? matchedDateEntry.deductHours : 0,
                deductMinutes: matchedDateEntry ? matchedDateEntry.deductMinutes : 0
            };

            leaveDateMap.set(dateStr, plainLeave);
        }
    }

    return leaveDateMap;
};

const storePunchReportsEX = async (req, res) => {
    try {
        const { userId } = req.body;
        const filePath = req.file.path;

        const workbook = xlsx.readFile(filePath);

        if (workbook.SheetNames.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No sheets found in the uploaded Excel file.'
            });
        }

        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!worksheet) {
            return res.status(400).json({
                success: false,
                message: 'Worksheet not found in the uploaded file.'
            });
        }

        const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

        let empName = '';
        let empCode = '';
        const headersRowIndex = 11;
        const result = [];

        const userLeaves = await LeaveModel.find({ user: userId });
        const approvedLeaveDates = getLeaveDateMap(userLeaves);

        for (const rowValues of rawData) {
            const rowIndex = rawData.indexOf(rowValues);
            if (rowIndex < headersRowIndex) {
                rowValues.forEach(cell => {
                    if (typeof cell === 'string') {
                        if (cell.includes("Emp.Name:-")) {
                            empName = cell.split("Emp.Name:-")[1]?.trim();
                        }
                        if (cell.includes("Emp.Code:-")) {
                            empCode = cell.split("Emp.Code:-")[1]?.trim();
                        }
                    }
                });
            }

            if (rowIndex >= headersRowIndex && rowValues[1]) {
                const dateExcel = rowValues[1];
                let formattedDate;

                if (typeof dateExcel === 'number') {
                    const jsDate = new Date((dateExcel - 25567 - 1) * 86400 * 1000);
                    formattedDate = jsDate.toISOString().split('T')[0];
                } else if (typeof dateExcel === 'string') {
                    const parts = dateExcel.split('/');
                    if (parts.length === 3) {
                        const day = parts[0].padStart(2, '0');
                        const month = parts[1].padStart(2, '0');
                        const year = parts[2];
                        formattedDate = `${year}-${month}-${day}`;
                    } else {
                        console.log("Invalid date format string, skipping row");
                        continue;
                    }
                } else {
                    console.log("Invalid date detected, skipping row");
                    continue;
                }

                const isTimeFormat = (str) => /^\d{1,2}:\d{2}$/.test(str);

                let punchList = [];
                let W_Hrs = '';
                let status = '';

                for (let i = 2; i < rowValues.length; i++) {
                    const time = rowValues[i];
                    const punchIndex = Math.floor((i - 2) / 2) + 1;

                    if (time && typeof time === 'string') {
                        if (!isTimeFormat(time)) {
                            if (!status) {
                                status = time;
                            }
                        } else {
                            punchList.push({
                                time,
                                type: i % 2 === 0 ? `In${punchIndex}` : `Out${punchIndex}`
                            });
                        }
                    }
                }

                // console.log("rowValues[24]", rowValues[24]);

                W_Hrs = rowValues[24] ? rowValues[24] : '0:00';

                if (rowValues[24]) {

                }

                let missingMinutes = 0;
                let isDeductible = true;
                const [hoursStr, minutesStr] = W_Hrs.split(':');
                const hours = parseInt(hoursStr, 10);
                const minutes = parseInt(minutesStr, 10);
                const workingHourDecimal = hours + (minutes / 60);

                const requiredHour = 8.25;

                if (workingHourDecimal < requiredHour) {
                    missingMinutes = Math.round((requiredHour - workingHourDecimal) * 60);
                } else {
                    isDeductible = false;
                }

                let missingHours = Math.floor(missingMinutes / 60);
                let remainingMinutes = missingMinutes % 60;

                let formattedMissingTime = `${missingHours}:${remainingMinutes.toString().padStart(2, '0')}`;

                if (missingHours <= 0 && remainingMinutes <= 0) {
                    formattedMissingTime = null;
                }

                if (!W_Hrs || W_Hrs === '0:00') {
                    W_Hrs = null;
                }

                if (status === 'WO') {
                    formattedMissingTime = null;
                    W_Hrs = null;
                }

                const statusEntry = punchList.find(p => p.time === 'A' || p.time === 'WO');
                if (statusEntry) {
                    status = statusEntry.time;
                }

                punchList = punchList.filter(punch => punch.time !== W_Hrs);

                const completePunchList = [];
                const punchMap = new Map();

                for (const punch of punchList) {
                    const match = punch.type.match(/(In|Out)(\d+)/);
                    if (match) {
                        const [, type, index] = match;
                        const key = parseInt(index);
                        if (!punchMap.has(key)) {
                            punchMap.set(key, {});
                        }
                        punchMap.get(key)[type] = punch.time;
                    }
                }

                for (let i = 1; i <= 9; i++) {
                    const punches = punchMap.get(i) || {};
                    completePunchList.push({
                        type: `In${i}`,
                        time: punches.In ?? null
                    });
                    completePunchList.push({
                        type: `Out${i}`,
                        time: punches.Out ?? null
                    });
                }

                punchList = completePunchList;

                let deductForDate;

                if (status === 'A') {
                    if (approvedLeaveDates.has(formattedDate)) {
                        const leaveInfo = approvedLeaveDates.get(formattedDate);
                        deductForDate = leaveInfo.deductForDate;
                        deductForDate.isUnexpected = leaveInfo.isUnexpected;
                        deductForDate.sandwichLeave = leaveInfo.sandwichLeave;
                        deductForDate.leaveCategory = leaveInfo.leaveCategory;
                        deductForDate.isLeaveOnDay = true;
                    } else {
                        let isSandwichLeave = await checkSandwichLeave({
                            dbStartDate: formattedDate,
                            dbEndDate: formattedDate
                        });
                        let isUnexpected = !!(formattedDate && moment(formattedDate).diff(moment(), 'day') < 3);
                        const createLeave = {
                            user: userId,
                            hours: "9 hours",
                            leaveCategory: leaveLabelKeys.unpaid,
                            startDate: formattedDate,
                            endDate: formattedDate,
                            isUnexpected: isUnexpected,
                            sandwichLeave: isSandwichLeave,
                        }
                        deductForDate = await updateLeaveDeductHours(createLeave);
                    }
                }

                result.push({
                    date: formattedDate,
                    punchList,
                    status,
                    workingHours: W_Hrs,
                    missingHours: formattedMissingTime,
                    isDeductible: isDeductible,
                    deductForDate: deductForDate,
                });
            }
        }

        fs.unlink(req.file.path, (err) => {
            if (err) {
                console.error("Error deleting file:", err);
            } else {
                console.log("Uploaded file deleted successfully.");
            }
        });


        let existingReport = await punchReportModel.findOne({ user: userId });

        if (existingReport) {
            const newDates = new Set(result.map(entry => entry.date));

            const filteredOldPunches = existingReport.punchReport.filter(entry => !newDates.has(entry.date));

            existingReport.punchReport = [...filteredOldPunches, ...result];

            existingReport.empCode = empCode;
            await existingReport.save();

        } else {
            const report = new punchReportModel({
                user: userId,
                empCode,
                punchReport: result
            });

            await report.save();

        }

        const list = await punchReportModel.find({}).populate('user', 'fullName');

        return res.status(200).json({
            success: true,
            message: "Punch sheet successfully.",
            data: list
        });


    } catch (err) {
        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};

async function updateLeaveDeductHours(leaveData) {
    const userLeaves = await LeaveModel.find({ user: leaveData.user });

    userLeaves.push(leaveData);

    let totalUnexpectedCount = 0;
    let totalUnexpectedDays = 0;
    let lastDailyHour = 0;

    for (let i = 0; i < userLeaves.length; i++) {
        const rawHours = parseFloat(userLeaves[i].hours.split(' ')[0]);
        const start = moment(userLeaves[i].startDate);
        const end = userLeaves[i].endDate ? moment(userLeaves[i].endDate) : start;
        const leaveDays = end.diff(start, 'days') + 1;

        let dayHours = rawHours > 9 ? rawHours / leaveDays : rawHours;

        if (userLeaves[i].isUnexpected) {
            totalUnexpectedCount++;
            totalUnexpectedDays++;

            if (totalUnexpectedDays > 12) {
                dayHours *= 3;
            } else if (totalUnexpectedCount > 4) {
                dayHours *= 2;
            }
        }

        if (i === userLeaves.length - 1) {
            lastDailyHour = dayHours;
        }
    }

    const dateArray = [];

    dateArray.push({
        date: leaveData.startDate,
        deductHours: `${lastDailyHour}`,
        deductMinutes: lastDailyHour > 0 ? `${lastDailyHour * 60}` : "0",
        isUnexpected: leaveData.isUnexpected,
        sandwichLeave: leaveData.sandwichLeave,
        isLeaveOnDay: false,
    });

    if (leaveData.sandwichLeave && dateArray.length > 1) {
        if(dateArray[dateArray.length - 1]) {
            dateArray[dateArray.length - 1].deductHours += 9;
        }
        if(dateArray[dateArray.length - 1]) {
            dateArray[dateArray.length - 1].deductMinutes += (9 * 60);
        }
    }

    if (dateArray.length === 1) {
        return { ...dateArray[0] };
    } else {
        return dateArray;
    }
}

const clearPunchReportTable = async (req, res) => {
    try {
        await punchReportModel.deleteMany({});
        res.status(200).send({ message: 'All data deleted successfully' });
    } catch (error) {
        res.status(500).send({ message: 'Error deleting data', error: error.message });
    }
}

const clearSalaryReportTable = async (req, res) => {
    try {
        await salaryReportModel.deleteMany({});
        res.status(200).send({ message: 'All data deleted successfully' });
    } catch (error) {
        res.status(500).send({ message: 'Error deleting data', error: error.message });
    }
}

module.exports = {
    getPunchReports,
    deletePunchReports,
    updatePunchReports,
    salaryReportsGenerate,
    storePunchReportsEX,
    clearPunchReportTable,
    clearSalaryReportTable
}