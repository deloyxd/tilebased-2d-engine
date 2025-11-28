const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const authenticate = require("../middleware/authenticate");

router.post("/login", authController.login);
router.post("/logout", authController.logout);
router.get("/session", authenticate, authController.session);

module.exports = router;
