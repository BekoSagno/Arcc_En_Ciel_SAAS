const { prisma } = require("./prisma");
const { getIaUsageTotals, getIaConsumptionByDay } = require("./metricsService");
const { notifySystem } = require("./notificationService");
const { sendCustomEmail } = require("./emailService");

/**
 * Envoie un récap d'usage IA pour un tenant (par email + notification système).
 * Par défaut : la veille (days=1).
 */
async function sendDailyUsageSummary({ tenantId, days = 1 }) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true },
  });
  if (!tenant) return { sent: false, reason: "tenant_not_found" };

  const totals = await getIaUsageTotals(tenantId, { days });
  const byDay = await getIaConsumptionByDay(tenantId, { days });

  // Notification in-app
  await notifySystem({
    tenantId,
    title: "Récap quotidien IA",
    message: `Messages IA: ${totals.messages}, Tokens: ${totals.tokens}.`,
    data: {
      type: "usage_daily",
      totals,
      byDay,
    },
  });

  // Email au premier admin actif
  const adminUser = await prisma.user.findFirst({
    where: { tenantId, role: "TENANT_ADMIN", status: "active" },
    orderBy: { createdAt: "asc" },
  });

  if (adminUser?.email) {
    const lines = byDay
      .map((d) => `<li><strong>${d.date}</strong> — ${d.messages} messages IA · ${d.tokens} tokens</li>`)
      .join("");

    await sendCustomEmail({
      to: adminUser.email,
      subject: `Récap quotidien IA - ${tenant.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin:0 auto; padding:20px; background:#0b101d; color:#e2e8f0;">
          <h2 style="color:#818cf8;">Récap quotidien IA</h2>
          <p>Tenant : <strong>${tenant.name}</strong></p>
          <p>Totaux (derniers ${days} jour${days > 1 ? "s" : ""}) :</p>
          <ul>
            <li>Messages IA : <strong>${totals.messages}</strong></li>
            <li>Tokens : <strong>${totals.tokens}</strong></li>
            <li>Coût estimé : <strong>$${(totals.costUsd || 0).toFixed(4)}</strong></li>
          </ul>
          <p>Détail par jour :</p>
          <ul>${lines}</ul>
        </div>
      `,
    });
  }

  return { sent: true, totals, byDay };
}

module.exports = { sendDailyUsageSummary };
