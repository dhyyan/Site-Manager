const express = require('express');
const { getWorkers, createWorker, updateWorker, deleteWorker } = require('../controllers/workerController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getWorkers)
  .post(createWorker);

router.route('/:id')
  .put(updateWorker)
  .delete(deleteWorker);

module.exports = router;