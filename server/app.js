const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const routes = require("./api");
const config = require("./config/env");

const app = express();

const CLIENT_ORIGIN = [
  "http://localhost:5500",
  "https://islandventure.web.app",
];

app.disable("x-powered-by");
app.use(helmet());
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (CLIENT_ORIGIN.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  morgan(config.isProduction ? "combined" : "dev", {
    skip: () => config.nodeEnv === "test",
  })
);

app.get("/", (req, res) => {
  res.json({ message: "API is running" });
});

app.use("/api", routes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found." });
});

app.use((error, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error(error);
  res.status(500).json({ message: "Internal server error." });
});

module.exports = app;
