const {
    handleError,
} = require("../utils/utils");
const { punchReportModel } = require("../Models/punchReportModel");
const { AppSettingModel } = require("../Models/AppSettingModel");
const xlsx = require('xlsx');
const fs = require('fs');


const punchDataGet = async (req, res) => {
    try {
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
            console.log("lunchBreakMinutes", lunchBreakMinutes)
            let missingMinutes;
            if (workingTotalMinutes === 0) {
                missingMinutes = Math.max(0, totalMinutes - lunchBreakMinutes);
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
                { empCode: empCode },
                {
                    $setOnInsert: {
                        empCode: empCode,
                        userName: empName
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

module.exports = {
    punchDataGet
}