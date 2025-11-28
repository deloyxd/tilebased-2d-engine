const http = require("http");
const app = require("./app");
const config = require("./config/env");

const server = http.createServer(app);

server.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${config.port}`);
});
