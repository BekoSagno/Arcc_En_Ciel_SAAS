require("dotenv").config();
const { prisma } = require("../services/prisma");

/**
 * Script pour lister tous les tenants disponibles
 * Usage: node src/scripts/list_tenants.js
 */

async function listTenants() {
  console.log("=".repeat(80));
  console.log("📋 LISTE DES TENANTS DISPONIBLES");
  console.log("=".repeat(80));
  console.log("");

  const tenants = await prisma.tenant.findMany({
    include: {
      users: {
        select: {
          email: true,
          name: true,
        },
      },
      _count: {
        select: {
          conversations: true,
          messages: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (tenants.length === 0) {
    console.log("❌ Aucun tenant trouvé dans la base de données");
    process.exit(0);
  }

  console.log(`📊 ${tenants.length} tenant(s) trouvé(s):\n`);

  for (const tenant of tenants) {
    console.log("─".repeat(80));
    console.log(`🏢 ${tenant.name}`);
    if (tenant.companyName) {
      console.log(`   Entreprise: ${tenant.companyName}`);
    }
    if (tenant.industry) {
      console.log(`   Secteur: ${tenant.industry}`);
    }
    console.log(`   ID: ${tenant.id}`);
    console.log(`   Statut: ${tenant.status}`);
    console.log(`   Conversations: ${tenant._count.conversations}`);
    console.log(`   Messages: ${tenant._count.messages}`);
    
    if (tenant.users.length > 0) {
      console.log(`   Utilisateurs:`);
      for (const user of tenant.users) {
        console.log(`     - ${user.email}${user.name ? ` (${user.name})` : ""}`);
      }
    }
    console.log("");
  }

  console.log("=".repeat(80));
  console.log("💡 Pour utiliser un tenant dans cleanup_phone_conversations.js:");
  console.log("   - Utilise l'ID (UUID)");
  console.log("   - Ou l'email d'un utilisateur");
  console.log("   - Ou le nom du tenant (entre guillemets si nécessaire)");
  console.log("=".repeat(80));
}

listTenants()
  .catch((error) => {
    console.error("❌ Erreur:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
