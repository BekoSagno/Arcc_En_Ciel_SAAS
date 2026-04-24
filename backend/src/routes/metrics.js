const express = require("express");
const { prisma } = require("../services/prisma");
const { resolveTenantId } = require("../services/tenantContext");
const { getIaConsumptionByDay, getIaUsageTotals } = require("../services/metricsService");
const { getTenantQuota } = require("../services/quotaService");

const router = express.Router();

const startOfDay = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

router.get("/metrics/overview", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const today = startOfDay();

    const [activeConversations, manualConversations, inbound, outbound] =
      await Promise.all([
        prisma.conversation.count({
          where: { tenantId, status: "OPEN" },
        }),
        prisma.conversation.count({
          where: { tenantId, status: "MANUAL_MODE" },
        }),
        prisma.message.count({
          where: {
            tenantId,
            direction: "INBOUND",
            createdAt: { gte: today },
          },
        }),
        prisma.message.count({
          where: {
            tenantId,
            direction: "OUTBOUND",
            createdAt: { gte: today },
          },
        }),
      ]);

    const totalMessages = inbound + outbound;
    const responseRate = totalMessages
      ? Math.round((outbound / totalMessages) * 100)
      : 0;

    return res.status(200).json({
      data: {
        activeConversations,
        manualConversations,
        messagesToday: totalMessages,
        responseRate,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/metrics/channels", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const channels = await prisma.conversation.groupBy({
      by: ["channel"],
      where: { tenantId },
      _count: { channel: true },
    });

    return res.status(200).json({
      data: channels.map((item) => ({
        channel: item.channel,
        count: item._count.channel,
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/metrics/usage", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const since = startOfDay();
    const [whatsappCount, tokenUsage, costSum] = await Promise.all([
      prisma.message.count({
        where: {
          tenantId,
          createdAt: { gte: since },
          direction: "OUTBOUND",
          rawPayload: {
            path: ["type"],
            equals: "reply",
          },
        },
      }),
      prisma.message.aggregate({
        where: { tenantId, createdAt: { gte: since } },
        _sum: { tokenUsage: true },
      }),
      prisma.message.aggregate({
        where: { tenantId, createdAt: { gte: since } },
        _sum: { costUsd: true },
      }),
    ]);

    return res.status(200).json({
      data: {
        whatsappMessages: whatsappCount,
        tokenUsage: tokenUsage._sum.tokenUsage || 0,
        costUsd: costSum._sum.costUsd || 0,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/metrics/channel-usage", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const since = startOfDay();
    const messages = await prisma.message.findMany({
      where: { tenantId, createdAt: { gte: since } },
      include: { conversation: true },
    });

    const buckets = {};
    for (const message of messages) {
      const channel = message.conversation?.channel || "UNKNOWN";
      if (!buckets[channel]) {
        buckets[channel] = { channel, messages: 0, costUsd: 0, tokens: 0 };
      }
      buckets[channel].messages += 1;
      buckets[channel].costUsd += message.costUsd || 0;
      buckets[channel].tokens += message.tokenUsage || 0;
    }

    return res.status(200).json({ data: Object.values(buckets) });
  } catch (error) {
    return next(error);
  }
});

// Consommation IA (messages/tokens/cost) par jour pour le tenant
router.get("/metrics/ia-consumption", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const days = Number(req.query.days || 30);
    const data = await getIaConsumptionByDay(tenantId, { days });

    return res.status(200).json({ data });
  } catch (error) {
    return next(error);
  }
});

// État du quota IA pour le tenant (mensuel)
router.get("/metrics/ia-quota", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    const { quota, used } = await getTenantQuota(tenantId);
    const remaining = quota === 0 ? null : Math.max(quota - used, 0);
    const percent = quota === 0 ? null : Math.min(100, Math.round((used / quota) * 100));

    return res.status(200).json({
      data: {
        quota,
        used,
        remaining,
        percent,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Usage IA du jour (messages IA envoyés aujourd'hui + tokens)
router.get("/metrics/ia-today", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const [messagesToday, tokensToday] = await Promise.all([
      prisma.message.count({
        where: {
          tenantId,
          direction: "OUTBOUND",
          createdAt: { gte: start },
        },
      }),
      prisma.message.aggregate({
        where: {
          tenantId,
          direction: "OUTBOUND",
          createdAt: { gte: start },
        },
        _sum: { tokenUsage: true },
      }),
    ]);

    return res.status(200).json({
      data: {
        messagesToday,
        tokensToday: tokensToday._sum.tokenUsage || 0,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Usage IA sur une plage (totaux + par jour) pour un tenant
router.get("/metrics/ia-usage", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }
    const days = Number(req.query.days || 30);
    const [byDay, totals] = await Promise.all([
      getIaConsumptionByDay(tenantId, { days }),
      getIaUsageTotals(tenantId, { days }),
    ]);
    return res.status(200).json({ data: { byDay, totals } });
  } catch (error) {
    return next(error);
  }
});

router.get("/metrics/ai-indicators", async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    // Mode manuel actif (conversations en MANUAL_MODE)
    const manualConversations = await prisma.conversation.count({
      where: { tenantId, status: "MANUAL_MODE" },
    });

    // Temps moyen de réponse (basé sur les messages OUTBOUND avec createdAt)
    const outboundMessages = await prisma.message.findMany({
      where: {
        tenantId,
        direction: "OUTBOUND",
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Dernières 24h
      },
      include: {
        conversation: {
          include: {
            messages: {
              where: { direction: "INBOUND" },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    let totalResponseTime = 0;
    let responseCount = 0;
    for (const outbound of outboundMessages) {
      const lastInbound = outbound.conversation.messages[0];
      if (lastInbound) {
        const responseTime = outbound.createdAt.getTime() - lastInbound.createdAt.getTime();
        if (responseTime > 0 && responseTime < 300000) { // Moins de 5 minutes
          totalResponseTime += responseTime;
          responseCount += 1;
        }
      }
    }
    const avgResponseTimeSeconds = responseCount > 0 
      ? Math.round(totalResponseTime / responseCount / 1000)
      : 0;

    // Relances après 24h (conversations avec nextReminderAt dans le futur)
    const now = new Date();
    const reminders24h = await prisma.conversation.count({
      where: {
        tenantId,
        nextReminderAt: {
          gte: now,
          lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // Prochaines 7 jours
        },
        lastInboundAt: {
          lte: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Plus de 24h depuis dernier inbound
        },
      },
    });

    // Précision RAG (basé sur les messages avec tokenUsage > 0, indiquant une réponse IA générée)
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [totalAIReponses, totalReponses] = await Promise.all([
      prisma.message.count({
        where: {
          tenantId,
          direction: "OUTBOUND",
          tokenUsage: { gt: 0 },
          createdAt: { gte: last7Days },
        },
      }),
      prisma.message.count({
        where: {
          tenantId,
          direction: "OUTBOUND",
          createdAt: { gte: last7Days },
        },
      }),
    ]);

    const ragAccuracy = totalReponses > 0
      ? Math.round((totalAIReponses / totalReponses) * 100)
      : 0;

    return res.status(200).json({
      data: {
        manualConversations,
        avgResponseTimeSeconds,
        reminders24h,
        ragAccuracy,
      },
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
