#!/usr/bin/env node

/**
 * Script pour envoyer le récap quotidien IA (email + notification système) à tous les tenants actifs.
 * Usage : node src/scripts/send_daily_usage_summary.js [days]
 * Par défaut days=1 (la veille).
 */

require("dotenv").config();
const { prisma } = require("../services/prisma");
const { sendDailyUsageSummary } = require("../services/usageNotifier");

async function main() {
  const days = Number(process.argv[2] || 1);
  console.log(`Envoi des récap IA pour les tenants actifs (days=${days})`);

  const tenants = await prisma.tenant.findMany({
    where: { status: "active" },
    select: { id: true, name: true },
  });

  for (const t of tenants) {
    try {
      const res = await sendDailyUsageSummary({ tenantId: t.id, days });
      console.log(`✅ ${t.name}: messages=${res.totals.messages}, tokens=${res.totals.tokens}`);
    } catch (err) {
      console.error(`❌ ${t.name}:`, err.message);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
