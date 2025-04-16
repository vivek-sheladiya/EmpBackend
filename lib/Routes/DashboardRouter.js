const {
    getEmployeeDashboardData,
    getAdminDashboardData,
} = require('../Controllers/DashboardController');

const router = require('express').Router();

router.get('/empDashboard/:userId', getEmployeeDashboardData);
router.get('/adminDashboard', getAdminDashboardData);

module.exports = router;