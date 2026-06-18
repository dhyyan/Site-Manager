const express = require('express');
const router = express.Router();
const Advance = require('../models/Advance');
const Worker = require('../models/Worker');

// POST /api/advances - Give new advance
router.post('/', async (req, res) => {
  try {
    const { workerId, amount, dateGiven, notes } = req.body;
    if (!workerId || amount <= 0) return res.status(400).json({ msg: 'Invalid data' });

    const advance = new Advance({ worker: workerId, amount, dateGiven: dateGiven || new Date(), notes });
    await advance.save();
    res.json({ msg: 'Advance recorded', advance });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// GET /api/advances/:workerId - Get history for a worker
router.get('/:workerId', async (req, res) => {
  try {
    const advances = await Advance.find({ worker: req.params.workerId }).sort({ dateGiven: -1 });
    res.json(advances);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;