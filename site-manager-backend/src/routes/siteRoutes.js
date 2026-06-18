const express = require('express');
const { getSites, createSite, updateSite, deleteSite, getSiteStats } = require('../controllers/siteController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

// Protect all routes
router.use(protect);

router.route('/')
  .get(getSites)
  .post(createSite);

router.route('/:id/stats')
  .get(getSiteStats);

router.route('/:id')
  .put(updateSite)
  .delete(deleteSite);

module.exports = router;