require("dotenv").config();

const http = require("http");
const { app } = require("./app");
const { setupWebsocket } = require("./services/websocket");

const port = process.env.PORT || 4000;

const server = http.createServer(app);

// Initialiser Socket.io sur le même serveur HTTP
setupWebsocket(server);

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`🚀 Arcc En Ciel backend running on port ${port}`);
  console.log(`📡 Webhook Meta: POST http://localhost:${port}/webhook`);
  console.log(`🔍 Health check: GET http://localhost:${port}/health`);
});
