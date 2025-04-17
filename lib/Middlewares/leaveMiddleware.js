const { validateLeaveData } = require('../utils/leaveValidation');
const { handleError } = require('../utils/utils');

const leaveValidation = (req, res, next) => {
    const validation = validateLeaveData(req.body);
    if (!validation.valid) {
        return handleError(res, validation.message, 400);
    }
    if (req.body.leave_type !== 'Full Day') {
        req.body.end_date = null;
    }
    next();
};



module.exports = { leaveValidation };


