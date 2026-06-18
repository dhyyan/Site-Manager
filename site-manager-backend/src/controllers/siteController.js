const Site = require('../models/Site');

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

module.exports = { getSites, createSite, updateSite, deleteSite };