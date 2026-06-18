const express = require('express');
const { upsertDaily, getByDate, getRange, getMonthlyAttendance, getSiteAllocationReport, deleteDaily } = require('../controllers/attendanceController');

const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

// routes/attendanceRoutes.js
router.post('/daily', upsertDaily);
router.get('/daily/:date', getByDate);
router.delete('/daily/:id', deleteDaily);
router.get('/range', getRange);
router.get('/allocation-report', getSiteAllocationReport);
router.get('/monthly', getMonthlyAttendance);

module.exports = router;