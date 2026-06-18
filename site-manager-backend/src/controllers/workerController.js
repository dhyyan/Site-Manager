const Worker = require("../models/Worker");

/**
 * GET /api/workers?page=1&limit=10&search=john&sortBy=firstName&order=asc
 */
const getWorkers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      sortBy = "createdAt",
      order = "desc",
      status = "all",
    } = req.query;

    // Validate pagination inputs
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    // Build search query
    const searchQuery = {};
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      searchQuery.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { employeeNo: searchRegex },
        { designation: searchRegex },
        { mobNo: searchRegex },
      ];
    }

    // Build sort object
    const sortOrder = order.toLowerCase() === "asc" ? 1 : -1;
    const sortObj = { [sortBy]: sortOrder };

    // Check for expiring documents if status filter is used
    if (status === "expiring") {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const today = new Date();

      searchQuery.$or = (searchQuery.$or || []).concat([
        { visaExpDate: { $lt: thirtyDaysFromNow, $gte: today } },
        { laborCardExpDate: { $lt: thirtyDaysFromNow, $gte: today } },
        { emiratesIdExpDate: { $lt: thirtyDaysFromNow, $gte: today } },
        { passportExpDate: { $lt: thirtyDaysFromNow, $gte: today } },
      ]);
    } else if (status === "expired") {
      const today = new Date();
      searchQuery.$or = (searchQuery.$or || []).concat([
        { visaExpDate: { $lt: today } },
        { laborCardExpDate: { $lt: today } },
        { emiratesIdExpDate: { $lt: today } },
        { passportExpDate: { $lt: today } },
      ]);
    }

    // Execute query with pagination
    const [workers, total] = await Promise.all([
      Worker.find(searchQuery).sort(sortObj).skip(skip).limit(limitNum).lean(),
      Worker.countDocuments(searchQuery),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      data: workers,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalRecords: total,
        limit: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (err) {
    console.error("Get Workers Error:", err);
    res.status(500).json({
      success: false,
      msg: "Server error",
      error: err.message,
    });
  }
};

/**
 * POST /api/workers
 */
const createWorker = async (req, res) => {
  try {
    const worker = new Worker(req.body);
    await worker.save();
    res.status(201).json({
      success: true,
      data: worker,
      msg: "Worker created successfully",
    });
  } catch (err) {
    console.error("Create Worker Error:", err);
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      if (field === "employeeNo") {
        return res.status(400).json({
          success: false,
          msg: "Employee No already exists. Please use a different number.",
        });
      }
      return res.status(400).json({
        success: false,
        msg: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
      });
    }
  }
};

/**
 * PUT /api/workers/:id
 */
const updateWorker = async (req, res) => {
  try {
    const worker = await Worker.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!worker) {
      return res.status(404).json({
        success: false,
        msg: "Worker not found",
      });
    }
    res.json({
      success: true,
      data: worker,
      msg: "Worker updated successfully",
    });
  } catch (err) {
    console.error("Update Worker Error:", err);
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({
        success: false,
        msg: `${field} already exists`,
      });
    }
    res.status(400).json({
      success: false,
      msg: err.message,
    });
  }
};

/**
 * DELETE /api/workers/:id (Soft delete / block)
 */
const deleteWorker = async (req, res) => {
  try {
    const worker = await Worker.findById(req.params.id);
    if (!worker) {
      return res.status(404).json({ success: false, msg: "Worker not found" });
    }
    
    worker.isActive = worker.isActive === undefined ? false : !worker.isActive;
    await worker.save();
    
    res.json({
      success: true,
      msg: worker.isActive ? "Worker unblocked successfully" : "Worker deleted successfully",
      data: worker
    });
  } catch (err) {
    console.error("Delete Worker Error:", err);
    res.status(500).json({ success: false, msg: err.message });
  }
};

module.exports = { getWorkers, createWorker, updateWorker, deleteWorker };
