const express = require("express");
const { prisma } = require("../services/prisma");
const { broadcastToTenant } = require("../services/websocket");

const router = express.Router();

// Store des connexions SSE actives par tenantId
const sseConnections = new Map();

/**
 * Créer une notification
 */
router.post("/notifications", async (req, res, next) => {
  try {
    const { tenantId, userId, type, title, message, data } = req.body || {};
    const xTenantId = req.headers["x-tenant-id"];

    const finalTenantId = tenantId || xTenantId;
    if (!finalTenantId) {
      return res.status(400).json({ error: "tenantId requis" });
    }

    if (!type || !title || !message) {
      return res.status(400).json({ error: "type, title et message requis" });
    }

    const notification = await prisma.notification.create({
      data: {
        tenantId: finalTenantId,
        userId: userId || null,
        type,
        title,
        message,
        data: data || null,
      },
    });

    // Broadcast en temps réel via SSE
    broadcastNotification(finalTenantId, notification);

    return res.status(201).json(notification);
  } catch (error) {
    console.error("[NOTIFICATIONS] Erreur création:", error);
    return next(error);
  }
});

/**
 * Récupérer les notifications d'un tenant
 */
router.get("/notifications", async (req, res, next) => {
  try {
    const tenantId = req.headers["x-tenant-id"];
    const userId = req.query.userId || null;
    const limit = parseInt(req.query.limit || "50");
    const unreadOnly = req.query.unreadOnly === "true";

    if (!tenantId) {
      return res.status(400).json({ error: "x-tenant-id header requis" });
    }

    const where = {
      tenantId,
      ...(userId ? { userId } : {}),
      ...(unreadOnly ? { read: false } : {}),
    };

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return res.status(200).json(notifications);
  } catch (error) {
    console.error("[NOTIFICATIONS] Erreur récupération:", error);
    return next(error);
  }
});

/**
 * Compter les notifications non lues
 */
router.get("/notifications/unread/count", async (req, res, next) => {
  try {
    const tenantId = req.headers["x-tenant-id"];
    const userId = req.query.userId || null;

    if (!tenantId) {
      return res.status(400).json({ error: "x-tenant-id header requis" });
    }

    const where = {
      tenantId,
      read: false,
      ...(userId ? { userId } : {}),
    };

    const count = await prisma.notification.count({ where });

    return res.status(200).json({ count });
  } catch (error) {
    console.error("[NOTIFICATIONS] Erreur comptage:", error);
    return next(error);
  }
});

/**
 * Marquer une notification comme lue
 */
router.patch("/notifications/:id/read", async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.headers["x-tenant-id"];

    if (!tenantId) {
      return res.status(400).json({ error: "x-tenant-id header requis" });
    }

    const notification = await prisma.notification.update({
      where: {
        id,
        tenantId, // Sécurité : s'assurer que la notification appartient au tenant
      },
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return res.status(200).json(notification);
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Notification introuvable" });
    }
    console.error("[NOTIFICATIONS] Erreur mise à jour:", error);
    return next(error);
  }
});

/**
 * Marquer toutes les notifications comme lues
 */
router.patch("/notifications/read-all", async (req, res, next) => {
  try {
    const tenantId = req.headers["x-tenant-id"];
    const userId = req.body.userId || null;

    if (!tenantId) {
      return res.status(400).json({ error: "x-tenant-id header requis" });
    }

    const where = {
      tenantId,
      read: false,
      ...(userId ? { userId } : {}),
    };

    const result = await prisma.notification.updateMany({
      where,
      data: {
        read: true,
        readAt: new Date(),
      },
    });

    return res.status(200).json({ updated: result.count });
  } catch (error) {
    console.error("[NOTIFICATIONS] Erreur marquage multiple:", error);
    return next(error);
  }
});

/**
 * Server-Sent Events endpoint pour les notifications en temps réel
 */
router.get("/notifications/stream", (req, res) => {
  const tenantId = req.headers["x-tenant-id"];
  if (!tenantId) {
    return res.status(400).json({ error: "x-tenant-id header requis" });
  }

  // Configuration SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Désactiver le buffering nginx

  // Envoyer un message initial de connexion
  res.write(`data: ${JSON.stringify({ type: "connected", tenantId })}\n\n`);

  // Stocker la connexion
  if (!sseConnections.has(tenantId)) {
    sseConnections.set(tenantId, new Set());
  }
  sseConnections.get(tenantId).add(res);

  // Nettoyer lors de la déconnexion
  req.on("close", () => {
    if (sseConnections.has(tenantId)) {
      sseConnections.get(tenantId).delete(res);
      if (sseConnections.get(tenantId).size === 0) {
        sseConnections.delete(tenantId);
      }
    }
    res.end();
  });

  // Envoyer un ping toutes les 30 secondes pour maintenir la connexion
  const pingInterval = setInterval(() => {
    try {
      res.write(`: ping\n\n`);
    } catch (error) {
      clearInterval(pingInterval);
    }
  }, 30000);

  req.on("close", () => {
    clearInterval(pingInterval);
  });
});

/**
 * Fonction helper pour broadcaster une notification à tous les clients connectés d'un tenant
 */
function broadcastNotification(tenantId, notification) {
  if (sseConnections.has(tenantId)) {
    const connections = sseConnections.get(tenantId);
    const message = `data: ${JSON.stringify({ type: "notification", notification })}\n\n`;
    
    connections.forEach((res) => {
      try {
        res.write(message);
      } catch (error) {
        // Connexion fermée, on la retire
        connections.delete(res);
      }
    });

    if (connections.size === 0) {
      sseConnections.delete(tenantId);
    }
  }

  // Broadcast équivalent via Socket.io (temps réel dashboard)
  try {
    broadcastToTenant(tenantId, "notification", {
      type: "notification",
      notification,
    });
  } catch (error) {
    console.error("[NOTIFICATIONS] Erreur broadcast Socket.io:", error);
  }
}

// Exporter la fonction pour utilisation dans d'autres modules
module.exports = { router, broadcastNotification };
