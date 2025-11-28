const { verifyToken } = require("../utils/token");
const { cookieName } = require("../config/env");

function extractToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) {
    return header.substring(7).trim();
  }
  if (req.cookies && req.cookies[cookieName]) {
    return req.cookies[cookieName];
  }
  return null;
}

function authenticate(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ message: "Authentication required." });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

module.exports = authenticate;
