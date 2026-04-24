const express = require("express");
const { prisma } = require("../services/prisma");
const { resolveTenantId } = require("../services/tenantContext");

const router = express.Router();

router.get("/channels", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const configs = await prisma.channelConfig.findMany({
      where: { tenantId },
      orderBy: { updatedAt: "desc" },
    });

    return res.status(200).json({ data: configs });
  } catch (error) {
    return next(error);
  }
});

/**
 * GET /api/channels/identities - Récupérer les identités de canaux (WhatsApp, etc.)
 */
router.get("/channels/identities", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const channel = req.query.channel; // Optionnel: filtrer par canal

    const where = { tenantId };
    if (channel) {
      where.channel = channel;
    }

    const identities = await prisma.channelIdentity.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({ data: identities });
  } catch (error) {
    return next(error);
  }
});

router.post("/channels", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const { channel, status, credentials } = req.body || {};
    if (!channel) {
      return res.status(400).json({ error: "Channel requis." });
    }

    const config = await prisma.channelConfig.upsert({
      where: {
        tenantId_channel: {
          tenantId,
          channel,
        },
      },
      create: {
        tenantId,
        channel,
        status: status || "inactive",
        credentials: credentials || {},
      },
      update: {
        status: status || "inactive",
        credentials: credentials || {},
      },
    });

    return res.status(201).json({ data: config });
  } catch (error) {
    return next(error);
  }
});

router.patch("/channels/:id/status", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const { status } = req.body || {};
    if (!status) {
      return res.status(400).json({ error: "Status requis." });
    }

    const config = await prisma.channelConfig.update({
      where: { id: req.params.id },
      data: { status },
    });

    return res.status(200).json({ data: config });
  } catch (error) {
    return next(error);
  }
});

router.get("/settings/utility-template", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const setting = await prisma.channelConfig.findFirst({
      where: { tenantId, channel: "WHATSAPP" },
    });

    return res.status(200).json({
      data: {
        template: setting?.credentials?.utilityTemplate || "",
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/settings/utility-template", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const { template } = req.body || {};
    if (!template) {
      return res.status(400).json({ error: "Template requis." });
    }

    const config = await prisma.channelConfig.upsert({
      where: {
        tenantId_channel: { tenantId, channel: "WHATSAPP" },
      },
      create: {
        tenantId,
        channel: "WHATSAPP",
        status: "active",
        credentials: { utilityTemplate: template },
      },
      update: {
        credentials: { utilityTemplate: template },
      },
    });

    return res.status(200).json({ data: config });
  } catch (error) {
    return next(error);
  }
});

/**
 * POST /api/channels/identities - Créer ou mettre à jour une identité de canal (WhatsApp, etc.)
 */
router.post("/channels/identities", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const { channel, externalId, label } = req.body || {};
    if (!channel || !externalId) {
      return res.status(400).json({ error: "Channel et externalId requis." });
    }

    // Normaliser le numéro WhatsApp (ajouter + si absent)
    let normalizedExternalId = externalId.trim();
    if (channel === "WHATSAPP" && !normalizedExternalId.startsWith("+")) {
      normalizedExternalId = `+${normalizedExternalId}`;
    }

    const identity = await prisma.channelIdentity.upsert({
      where: {
        channel_externalId: {
          channel,
          externalId: normalizedExternalId,
        },
      },
      create: {
        tenantId,
        channel,
        externalId: normalizedExternalId,
        label: label || `${channel} Business`,
      },
      update: {
        tenantId,
        label: label || `${channel} Business`,
      },
    });

    return res.status(200).json({ data: identity });
  } catch (error) {
    console.error("[CHANNELS] Erreur création/mise à jour identité:", error);
    return next(error);
  }
});

module.exports = router;
