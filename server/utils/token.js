const jwt = require("jsonwebtoken");
const { tokenSecret, tokenExpiresIn } = require("../config/env");

function signToken(payload = {}) {
  return jwt.sign(payload, tokenSecret, { expiresIn: tokenExpiresIn });
}

function verifyToken(token) {
  return jwt.verify(token, tokenSecret);
}

module.exports = {
  signToken,
  verifyToken,
};
