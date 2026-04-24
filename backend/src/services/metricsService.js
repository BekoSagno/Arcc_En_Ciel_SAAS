const { prisma } = require("./prisma");

/**
 * Consommation IA par jour pour un tenant (messages IA = OUTBOUND avec tokenUsage>0)
 */
async function getIaConsumptionByDay(tenantId, { days = 30 } = {}) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const messages = await prisma.message.findMany({
    where: {
      tenantId,
      direction: "OUTBOUND",
      createdAt: { gte: since },
    },
    select: {
      createdAt: true,
      tokenUsage: true,
      costUsd: true,
    },
  });

  const byDay = {};
  for (const m of messages) {
    const d = m.createdAt.toISOString().slice(0, 10);
    if (!byDay[d]) {
      byDay[d] = { date: d, messages: 0, tokens: 0, costUsd: 0 };
    }
    byDay[d].messages += 1;
    byDay[d].tokens += m.tokenUsage || 0;
    byDay[d].costUsd += m.costUsd || 0;
  }

  return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Usage IA agrégé (totaux) pour un tenant sur X jours
 */
async function getIaUsageTotals(tenantId, { days = 30 } = {}) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [messageCount, aggregates] = await Promise.all([
    prisma.message.count({
      where: {
        tenantId,
        direction: "OUTBOUND",
        createdAt: { gte: since },
      },
    }),
    prisma.message.aggregate({
      where: {
        tenantId,
        direction: "OUTBOUND",
        createdAt: { gte: since },
      },
      _sum: { tokenUsage: true, costUsd: true },
    }),
  ]);

  return {
    messages: messageCount,
    tokens: aggregates._sum.tokenUsage || 0,
    costUsd: aggregates._sum.costUsd || 0,
  };
}

/**
 * Consommation IA globale par tenant (vue superadmin)
 */
async function getIaConsumptionByTenant({ days = 30 } = {}) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await prisma.message.groupBy({
    by: ["tenantId"],
    where: {
      direction: "OUTBOUND",
      createdAt: { gte: since },
    },
    _sum: { tokenUsage: true, costUsd: true },
    _count: { _all: true },
  });

  const tenantIds = rows.map((r) => r.tenantId);
  const tenants = await prisma.tenant.findMany({
    where: { id: { in: tenantIds } },
    select: { id: true, name: true },
  });
  const map = Object.fromEntries(tenants.map((t) => [t.id, t.name]));

  return rows.map((r) => ({
    tenantId: r.tenantId,
    tenantName: map[r.tenantId] || r.tenantId,
    messages: r._count._all,
    tokens: r._sum.tokenUsage || 0,
    costUsd: r._sum.costUsd || 0,
  }));
}

module.exports = { getIaConsumptionByDay, getIaConsumptionByTenant, getIaUsageTotals };
