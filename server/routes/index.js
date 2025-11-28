const express = require("express");
const router = express.Router();

const authRoutes = require("./authRoutes");
const healthRoutes = require("./healthRoutes");
const authenticate = require("../middleware/authenticate");

router.use("/", healthRoutes);
router.use("/auth", authRoutes);

router.get("/protected/ping", authenticate, (req, res) => {
  res.json({ message: "pong", user: req.user });
});

module.exports = router;
