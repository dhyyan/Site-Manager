const Site = require('../models/Site');
const DailyAttendance = require('../models/Attendance');
const mongoose = require('mongoose');

const getSites = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search?.trim() || '';
    const sort = req.query.sort || 'createdAt'; // field to sort by
    const order = req.query.order === 'asc' ? 1 : -1; // asc or desc

    const skip = (page - 1) * limit;

    // Build search query
    const searchQuery = search
      ? {
          $or: [
            { clientName: { $regex: search, $options: 'i' } },
            { siteRefName: { $regex: search, $options: 'i' } },
            { location: { $regex: search, $options: 'i' } },
            { lpoNo: { $regex: search, $options: 'i' } },
            { jobRefNo: { $regex: search, $options: 'i' } },
          ],
        }
      : {};

    const total = await Site.countDocuments(searchQuery);
    const sites = await Site.find(searchQuery)
      .sort({ [sort]: order })
      .skip(skip)
      .limit(limit);

    res.json({
      sites,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    });
  } catch (err) {
    console.error('Get Sites Error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

// POST /api/sites
const createSite = async (req, res) => {
  try {
    const site = new Site(req.body);
    await site.save();
    res.status(201).json(site);
  } catch (err) {
    console.error('Create Site Error:', err);
    res.status(400).json({ msg: err.message });
  }
};

// PUT /api/sites/:id
const updateSite = async (req, res) => {
  try {
    const site = await Site.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!site) return res.status(404).json({ msg: 'Site not found' });
    res.json(site);
  } catch (err) {
    console.error('Update Site Error:', err);
    res.status(400).json({ msg: err.message });
  }
};

// DELETE /api/sites/:id (Soft Delete / Toggle block/unblock)
const deleteSite = async (req, res) => {
  try {
    const site = await Site.findById(req.params.id);
    if (!site) return res.status(404).json({ msg: 'Site not found' });
    
    // Toggle the isActive field
    site.isActive = site.isActive === undefined ? false : !site.isActive;
    await site.save();
    
    res.json({ msg: site.isActive ? 'Site unblocked' : 'Site deleted successfully', site });
  } catch (err) {
    console.error('Delete Site Error:', err);
    res.status(400).json({ msg: err.message });
  }
};

const getSiteStats = async (req, res) => {
  try {
    const { id } = req.params;
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ msg: 'start & end required' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ msg: 'Invalid site ID' });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    endDate.setUTCHours(23, 59, 59, 999);

    const agg = await DailyAttendance.aggregate([
      {
        $match: {
          site: new mongoose.Types.ObjectId(id),
          date: { $gte: startDate, $lte: endDate },
          status: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: "$worker",
          daysWorked: {
            $sum: {
              $cond: [
                { $in: ["$status", [1, 2]] }, 1,
                { $cond: [{ $eq: ["$status", 0.5] }, 0.5, 0] }
              ]
            }
          },
          totalHours: {
            $sum: {
              $cond: [
                { $gt: ["$workingHours", 0] },
                "$workingHours",
                {
                  $cond: [
                    { $in: ["$status", [1, 2]] }, 8,
                    { $cond: [{ $eq: ["$status", 0.5] }, 4, 0] }
                  ]
                }
              ]
            }
          },
          totalOtHours: { $sum: "$otHours" }
        }
      },
      {
        $lookup: {
          from: "workers",
          localField: "_id",
          foreignField: "_id",
          as: "workerInfo"
        }
      },
      {
        $unwind: "$workerInfo"
      },
      {
        $project: {
          _id: 1,
          firstName: "$workerInfo.firstName",
          lastName: "$workerInfo.lastName",
          employeeNo: "$workerInfo.employeeNo",
          daysWorked: 1,
          totalHours: 1,
          totalOtHours: 1,
          netHours: { $add: ["$totalHours", "$totalOtHours"] }
        }
      },
      {
        $sort: { employeeNo: 1 }
      }
    ]);

    const totalManpower = agg.length;
    const totalWorkedHours = agg.reduce((sum, w) => sum + (w.netHours || 0), 0);

    res.json({
      summary: {
        totalManpower,
        totalWorkedHours
      },
      workers: agg
    });
  } catch (err) {
    console.error('Get Site Stats Error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};

module.exports = { getSites, createSite, updateSite, deleteSite, getSiteStats };