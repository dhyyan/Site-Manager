const express = require("express");
const router = express.Router();

router.get("/ping", (req, res) => {
  res.json({ status: "alive", time: new Date() });
});

module.exports = router;
