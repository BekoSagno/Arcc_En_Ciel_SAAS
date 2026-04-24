const { Server } = require("socket.io");

let io = null;

/**
 * Initialise Socket.io à partir du serveur HTTP principal.
 * On utilise les rooms par tenantId pour isoler les événements.
 */
function setupWebsocket(server) {
  io = new Server(server, {
    cors: {
      origin: (process.env.CORS_ORIGIN || "*").split(",").map((o) => o.trim()).filter(Boolean),
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    const { tenantId } = socket.handshake.query || {};
    if (tenantId && typeof tenantId === "string") {
      // Chaque dashboard rejoint la room de son tenant
      socket.join(tenantId);
      console.log(`[WS] Client connecté pour tenant ${tenantId} (socket ${socket.id})`);
    } else {
      console.log(`[WS] Client connecté sans tenantId (socket ${socket.id})`);
    }

    socket.on("disconnect", () => {
      console.log(`[WS] Client déconnecté (socket ${socket.id})`);
    });
  });

  console.log("✅ Socket.io initialisé");
}

/**
 * Broadcast générique vers tous les clients d'un tenant.
 */
function broadcastToTenant(tenantId, event, payload) {
  if (!io || !tenantId) return;
  io.to(tenantId).emit(event, payload);
}

module.exports = {
  setupWebsocket,
  broadcastToTenant,
};

