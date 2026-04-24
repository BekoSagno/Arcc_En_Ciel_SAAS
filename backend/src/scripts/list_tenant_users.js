require("dotenv").config();

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const tenantName = process.argv[2];

  if (!tenantName) {
    console.log("\nUsage:");
    console.log("  node src/scripts/list_tenant_users.js \"Nom du tenant\"\n");
    process.exit(1);
  }

  const tenant = await prisma.tenant.findFirst({
    where: { name: tenantName },
    include: { users: true },
  });

  if (!tenant) {
    console.log(`❌ Aucun tenant trouvé avec le nom "${tenantName}"`);
    return;
  }

  console.log(`\n🏪 Tenant: ${tenant.name} (${tenant.id})`);
  if (!tenant.users || tenant.users.length === 0) {
    console.log("❌ Aucun utilisateur associé à ce tenant.\n");
  } else {
    console.log(`✅ ${tenant.users.length} utilisateur(s):\n`);
    tenant.users.forEach((u) => {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`ID   : ${u.id}`);
      console.log(`Nom  : ${u.name || "N/A"}`);
      console.log(`Email: ${u.email}`);
      console.log(`Role : ${u.role}`);
    });
    console.log("");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

