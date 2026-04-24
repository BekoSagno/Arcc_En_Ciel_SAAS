require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function manageMappings() {
  const command = process.argv[2];
  const senderPhone = process.argv[3];
  const tenantIdOrEmail = process.argv[4];

  if (!command || command === "help") {
    console.log("\n📋 Gestion des mappings TestNumberMapping\n");
    console.log("Usage:");
    console.log("  node manage_test_mappings.js list                    # Lister tous les mappings");
    console.log("  node manage_test_mappings.js add <phone> <tenant_id> # Ajouter un mapping");
    console.log("  node manage_test_mappings.js add <phone> <email>     # Ajouter via email du tenant");
    console.log("  node manage_test_mappings.js remove <phone>          # Supprimer un mapping");
    console.log("  node manage_test_mappings.js enable <phone>          # Activer un mapping");
    console.log("  node manage_test_mappings.js disable <phone>         # Désactiver un mapping");
    console.log("\nExemples:");
    console.log("  node manage_test_mappings.js add +224626606960 charles04@gmail.com");
    console.log("  node manage_test_mappings.js add +224623858991 40cc2abb-3bbc-48b9-b295-ae889e225fed");
    console.log("  node manage_test_mappings.js list");
    process.exit(0);
  }

  try {
    if (command === "list") {
      const mappings = await prisma.testNumberMapping.findMany({
        include: {
          tenant: {
            include: {
              users: { select: { email: true, name: true }, take: 1 },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      if (mappings.length === 0) {
        console.log("\n❌ Aucun mapping trouvé.\n");
        return;
      }

      console.log(`\n✅ ${mappings.length} mapping(s) trouvé(s):\n`);
      mappings.forEach((mapping) => {
        const user = mapping.tenant.users[0];
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`📱 Numéro: ${mapping.senderPhoneNumber}`);
        console.log(`   Tenant: ${mapping.tenant.name} (${mapping.tenantId})`);
        console.log(`   Email: ${user?.email || "N/A"}`);
        console.log(`   Status: ${mapping.isActive ? "✅ Actif" : "❌ Inactif"}`);
        console.log(`   Créé le: ${mapping.createdAt.toLocaleString()}`);
        console.log("");
      });

    } else if (command === "add") {
      if (!senderPhone || !tenantIdOrEmail) {
        console.error("❌ Usage: node manage_test_mappings.js add <phone> <tenant_id|email>");
        process.exit(1);
      }

      // Normaliser le numéro (supprimer espaces, ajouter + si absent)
      let normalizedPhone = senderPhone.trim().replace(/\s+/g, "");
      if (!normalizedPhone.startsWith("+")) {
        normalizedPhone = "+" + normalizedPhone;
      }

      // Résoudre le tenant (par ID ou email)
      let tenant;
      if (tenantIdOrEmail.includes("@")) {
        // C'est un email
        const user = await prisma.user.findUnique({
          where: { email: tenantIdOrEmail },
          include: { tenant: true },
        });
        if (!user) {
          console.error(`❌ Utilisateur avec l'email "${tenantIdOrEmail}" introuvable.`);
          process.exit(1);
        }
        tenant = user.tenant;
      } else {
        // C'est un tenant ID
        tenant = await prisma.tenant.findUnique({
          where: { id: tenantIdOrEmail },
        });
        if (!tenant) {
          console.error(`❌ Tenant avec l'ID "${tenantIdOrEmail}" introuvable.`);
          process.exit(1);
        }
      }

      // Vérifier si un mapping existe déjà pour ce numéro
      const existing = await prisma.testNumberMapping.findUnique({
        where: { senderPhoneNumber: normalizedPhone },
      });

      if (existing) {
        // Mettre à jour le mapping existant
        const updated = await prisma.testNumberMapping.update({
          where: { id: existing.id },
          data: {
            tenantId: tenant.id,
            isActive: true,
          },
        });
        console.log(`\n✅ Mapping mis à jour:`);
        console.log(`   Numéro: ${normalizedPhone}`);
        console.log(`   Tenant: ${tenant.name} (${tenant.id})`);
        console.log(`   Status: ✅ Actif\n`);
      } else {
        // Créer un nouveau mapping
        const created = await prisma.testNumberMapping.create({
          data: {
            senderPhoneNumber: normalizedPhone,
            tenantId: tenant.id,
            isActive: true,
          },
        });
        console.log(`\n✅ Mapping créé:`);
        console.log(`   Numéro: ${normalizedPhone}`);
        console.log(`   Tenant: ${tenant.name} (${tenant.id})`);
        console.log(`   Status: ✅ Actif\n`);
      }

    } else if (command === "remove") {
      if (!senderPhone) {
        console.error("❌ Usage: node manage_test_mappings.js remove <phone>");
        process.exit(1);
      }

      // Normaliser le numéro (supprimer espaces, ajouter + si absent)
      let normalizedPhone = senderPhone.trim().replace(/\s+/g, "");
      if (!normalizedPhone.startsWith("+")) {
        normalizedPhone = "+" + normalizedPhone;
      }
      const deleted = await prisma.testNumberMapping.delete({
        where: { senderPhoneNumber: normalizedPhone },
      });
      console.log(`\n✅ Mapping supprimé pour: ${normalizedPhone}\n`);

    } else if (command === "enable" || command === "disable") {
      if (!senderPhone) {
        console.error(`❌ Usage: node manage_test_mappings.js ${command} <phone>`);
        process.exit(1);
      }

      // Normaliser le numéro (supprimer espaces, ajouter + si absent)
      let normalizedPhone = senderPhone.trim().replace(/\s+/g, "");
      if (!normalizedPhone.startsWith("+")) {
        normalizedPhone = "+" + normalizedPhone;
      }
      const updated = await prisma.testNumberMapping.update({
        where: { senderPhoneNumber: normalizedPhone },
        data: { isActive: command === "enable" },
      });
      console.log(`\n✅ Mapping ${command === "enable" ? "activé" : "désactivé"} pour: ${normalizedPhone}\n`);

    } else {
      console.error(`❌ Commande inconnue: ${command}`);
      console.log("Utilise 'help' pour voir les commandes disponibles.");
      process.exit(1);
    }

  } catch (error) {
    if (error.code === "P2025") {
      console.error(`❌ Mapping introuvable pour ce numéro.`);
    } else {
      console.error("❌ Erreur:", error.message);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

manageMappings();
