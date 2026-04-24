const express = require("express");
const { getIaConsumptionByTenant } = require("../services/metricsService");
const { adminAuthMiddleware } = require("../middleware/adminAuth");
const { prisma } = require("../services/prisma");

const router = express.Router();

// Protection superadmin
router.use("/admin", adminAuthMiddleware);

// Consommation IA globale par tenant (superadmin)
router.get("/admin/metrics/ia-consumption", async (req, res, next) => {
  try {
    const days = Number(req.query.days || 30);
    const data = await getIaConsumptionByTenant({ days });
    return res.status(200).json({ data });
  } catch (error) {
    return next(error);
  }
});

// Quotas IA par tenant (vue superadmin)
router.get("/admin/metrics/ia-quotas", async (req, res, next) => {
  try {
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        aiMonthlyQuotaMessages: true,
        aiQuotaPeriodStart: true,
      },
    });

    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const rows = await prisma.message.groupBy({
      by: ["tenantId"],
      where: {
        direction: "OUTBOUND",
        tokenUsage: { gt: 0 },
        createdAt: { gte: startOfMonth },
      },
      _count: { _all: true },
    });
    const usedMap = Object.fromEntries(rows.map((r) => [r.tenantId, r._count._all]));

    const data = tenants.map((t) => {
      const quota = t.aiMonthlyQuotaMessages || 0;
      const used = usedMap[t.id] || 0;
      const remaining = quota === 0 ? null : Math.max(quota - used, 0);
      const percent = quota === 0 ? null : Math.min(100, Math.round((used / quota) * 100));
      return {
        tenantId: t.id,
        tenantName: t.name,
        quota,
        used,
        remaining,
        percent,
      };
    });

    return res.status(200).json({ data });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
