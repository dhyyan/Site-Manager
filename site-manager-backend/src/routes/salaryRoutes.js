const express = require('express');
const { getSalaryReport, saveSalary } = require('../controllers/salaryController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();
router.use(protect);

router.get('/', getSalaryReport);
router.post('/wps', saveSalary);

module.exports = router;