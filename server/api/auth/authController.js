const { signToken } = require("../../utils/token");
const { adminPassword, cookieName, isProduction } = require("../../config/env");

function setAuthCookie(res, token) {
  res.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 24, // 1 day
  });
}

exports.login = (req, res) => {
  const { password } = req.body || {};

  if (!password) {
    return res.status(400).json({ message: "Password is required." });
  }

  if (password !== adminPassword) {
    console.log(adminPassword);
    return res.status(401).json({ message: "Invalid password." });
  }

  const token = signToken({ role: "admin", issuedAt: Date.now() });
  setAuthCookie(res, token);
  return res.json({ token });
};

exports.logout = (req, res) => {
  res.clearCookie(cookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
  });
  return res.json({ message: "Logged out." });
};

exports.session = (req, res) => {
  return res.json({ authenticated: true, user: req.user });
};
