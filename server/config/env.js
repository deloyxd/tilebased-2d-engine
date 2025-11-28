const path = require("path");
const dotenv = require("dotenv");

const envPath = path.resolve(process.cwd(), ".env");
dotenv.config({ path: envPath });

const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 8080,
  adminPassword: process.env.ADMIN_PASSWORD || "",
  tokenSecret: process.env.AUTH_TOKEN_SECRET || "",
  tokenExpiresIn: process.env.AUTH_TOKEN_EXPIRES_IN || "2h",
  cookieName: process.env.AUTH_COOKIE_NAME || "islandventure_auth",
};

config.isProduction = config.nodeEnv === "production";

module.exports = config;
