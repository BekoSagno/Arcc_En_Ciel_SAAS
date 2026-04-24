const express = require("express");
const { sendDailyUsageSummary } = require("../services/usageNotifier");

const router = express.Router();

// Protection simple par token
function checkCronToken(req, res, next) {
  const token = req.headers["x-cron-token"] || req.query.token;
  if (!process.env.CRON_TOKEN || token !== process.env.CRON_TOKEN) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

// Déclencher manuellement le récap quotidien IA pour un tenant ou tous
router.post("/cron/daily-usage", checkCronToken, async (req, res, next) => {
  try {
    const { tenantId, days = 1 } = req.body || {};
    if (tenantId) {
      const result = await sendDailyUsageSummary({ tenantId, days });
      return res.status(200).json({ data: result });
    }
    // tous les tenants actifs
    const { prisma } = require("../services/prisma");
    const tenants = await prisma.tenant.findMany({
      where: { status: "active" },
      select: { id: true, name: true },
    });
    const results = [];
    for (const t of tenants) {
      try {
        const r = await sendDailyUsageSummary({ tenantId: t.id, days });
        results.push({ tenantId: t.id, ok: true, totals: r.totals });
      } catch (err) {
        results.push({ tenantId: t.id, ok: false, error: err.message });
      }
    }
    return res.status(200).json({ data: results });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
