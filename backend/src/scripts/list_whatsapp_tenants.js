require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function listWhatsAppTenants() {
  try {
    console.log("\n📱 Liste des configurations WhatsApp dans la base de données:\n");

    // Récupérer tous les ChannelIdentity WhatsApp
    const identities = await prisma.channelIdentity.findMany({
      where: { channel: "WHATSAPP" },
      include: {
        tenant: {
          include: {
            users: {
              select: {
                email: true,
                name: true,
              },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (identities.length === 0) {
      console.log("❌ Aucune configuration WhatsApp trouvée dans la base de données.");
      console.log("\n💡 Lors de l'inscription, le numéro WhatsApp devrait être automatiquement enregistré.");
      process.exit(0);
    }

    console.log(`✅ ${identities.length} configuration(s) WhatsApp trouvée(s):\n`);

    for (const identity of identities) {
      const user = identity.tenant.users[0];
      const config = await prisma.channelConfig.findFirst({
        where: {
          tenantId: identity.tenantId,
          channel: "WHATSAPP",
        },
      });

      const credentials = config?.credentials;
      const phoneNumberId = credentials && typeof credentials === "object" 
        ? credentials.phoneNumberId 
        : null;

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`📋 Tenant: ${identity.tenant.name}`);
      console.log(`   ID: ${identity.tenant.id}`);
      console.log(`   Email: ${user?.email || "N/A"}`);
      console.log(`   Nom: ${user?.name || "N/A"}`);
      console.log(`   Entreprise: ${identity.tenant.companyName || "Non renseigné"}`);
      console.log(`\n📱 ChannelIdentity:`);
      console.log(`   External ID (numéro saisi): ${identity.externalId}`);
      console.log(`   Label: ${identity.label || "N/A"}`);
      console.log(`   Créé le: ${identity.createdAt.toLocaleString()}`);
      console.log(`\n⚙️  ChannelConfig:`);
      if (config) {
        console.log(`   Status: ${config.status}`);
        if (phoneNumberId) {
          console.log(`   Phone Number ID Meta: ${phoneNumberId}`);
          console.log(`   ✅ Configuré pour recevoir des messages`);
        } else {
          console.log(`   Phone Number ID Meta: ❌ Non configuré`);
          console.log(`   ⚠️  Ne peut pas recevoir de messages Meta`);
        }
      } else {
        console.log(`   ❌ Aucune configuration trouvée`);
      }
      console.log("");
    }

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n💡 Pour mettre à jour le phone_number_id d'un tenant:");
    console.log("   node src/scripts/update_phone_number_id.js <TENANT_ID> <PHONE_NUMBER_ID>");
    console.log("\n💡 Pour vérifier un tenant spécifique:");
    console.log("   node src/scripts/check_tenant_whatsapp.js <email_du_tenant>");

  } catch (error) {
    console.error("❌ Erreur:", error);
  } finally {
    await prisma.$disconnect();
  }
}

listWhatsAppTenants();
