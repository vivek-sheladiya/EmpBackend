const validateLeaveData = (data) => {
    const { leave_type, start_date, end_date, leaves, leave_category, reason } = data;
    if (!leave_type || !['Full Day', 'Half Day', 'Manual Hours'].includes(leave_type)) {
        return { valid: false, message: "Invalid or missing leave type." };
    }
    if (!leaves || leaves.trim() === '') {
        return { valid: false, message: "Leaves field is required." };
    }
    if (!leave_category || !['Paid(Sick)', 'Unpaid'].includes(leave_category)) {
        return { valid: false, message: "Invalid or missing leave category." };
    }
    if (!reason || reason.trim() === '') {
        return { valid: false, message: "Reason is required." };
    }
    const date = /^\d{4}-\d{2}-\d{2}$/;
    if (!start_date || !date.test(start_date)) {
        return { valid: false, message: "Start date is required and must be in YYYY-MM-DD format." };
    }
    if (leave_type === 'Full Day') {
        if (!end_date || !date.test(end_date)) {
            return { valid: false, message: "End date is required for Full Day and must be in YYYY-MM-DD format." };
        }
        if (start_date > end_date) {
            return { valid: false, message: "End date must be greater than or equal to start date." };
        }
    }
    return { valid: true };
};


module.exports = { validateLeaveData };
