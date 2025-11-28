const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const routes = require("./routes");
const config = require("./config/env");

const app = express();

const allowedOrigins = config.clientOrigins;
const corsOptions = allowedOrigins.includes("*")
  ? { origin: true, credentials: true }
  : { origin: allowedOrigins, credentials: true };

app.disable("x-powered-by");
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  morgan(config.isProduction ? "combined" : "dev", {
    skip: () => config.nodeEnv === "test",
  })
);

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
