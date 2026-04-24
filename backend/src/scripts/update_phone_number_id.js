require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function updatePhoneNumberId() {
  try {
    const [tenantId, phoneNumberId] = process.argv.slice(2);

    if (!tenantId || !phoneNumberId) {
      console.error("\n❌ Usage: node update_phone_number_id.js <TENANT_ID> <PHONE_NUMBER_ID>");
      console.error("\nExemple:");
      console.error("  node update_phone_number_id.js 9b801926-c38a-45ee-903d-47d67e45ef85 917809738090702");
      console.error("\n💡 Pour trouver le TENANT_ID, utilise:");
      console.error("  node src/scripts/list_whatsapp_tenants.js");
      process.exit(1);
    }

    // Vérifier que le tenant existe
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: {
          select: { email: true, name: true },
          take: 1,
        },
      },
    });

    if (!tenant) {
      console.error(`❌ Tenant avec l'ID "${tenantId}" introuvable.`);
      process.exit(1);
    }

    console.log(`\n🔧 Mise à jour du phone_number_id pour le tenant:`);
    console.log(`   Nom: ${tenant.name}`);
    console.log(`   Email: ${tenant.users[0]?.email || "N/A"}`);
    console.log(`   Phone Number ID: ${phoneNumberId}`);

    // Vérifier si un autre tenant utilise déjà ce phone_number_id
    const existingIdentity = await prisma.channelIdentity.findUnique({
      where: {
        channel_externalId: {
          channel: "WHATSAPP",
          externalId: phoneNumberId,
        },
      },
      include: {
        tenant: {
          include: {
            users: { select: { email: true }, take: 1 },
          },
        },
      },
    });

    if (existingIdentity && existingIdentity.tenantId !== tenantId) {
      console.error(`\n❌ ERREUR: Ce phone_number_id est déjà utilisé par un autre tenant:`);
      console.error(`   Tenant: ${existingIdentity.tenant.name}`);
      console.error(`   Email: ${existingIdentity.tenant.users[0]?.email || "N/A"}`);
      console.error(`\n💡 Tu dois d'abord supprimer ou modifier l'ancienne liaison.`);
      process.exit(1);
    }

    // Mettre à jour ou créer le ChannelIdentity
    const identity = await prisma.channelIdentity.upsert({
      where: {
        channel_externalId: {
          channel: "WHATSAPP",
          externalId: phoneNumberId,
        },
      },
      create: {
        tenantId: tenant.id,
        channel: "WHATSAPP",
        externalId: phoneNumberId,
        label: "Meta WhatsApp - Configuration manuelle",
      },
      update: {
        tenantId: tenant.id,
        label: "Meta WhatsApp - Configuration manuelle",
      },
    });

    console.log(`\n✅ ChannelIdentity mis à jour:`);
    console.log(`   ID: ${identity.id}`);
    console.log(`   External ID: ${identity.externalId}`);
    console.log(`   Tenant ID: ${identity.tenantId}`);

    // Vérifier si le ChannelConfig existe et le mettre à jour
    const config = await prisma.channelConfig.findFirst({
      where: {
        tenantId: tenant.id,
        channel: "WHATSAPP",
      },
    });

    if (config) {
      const credentials = config.credentials && typeof config.credentials === "object"
        ? config.credentials
        : {};
      
      credentials.phoneNumberId = phoneNumberId;

      await prisma.channelConfig.update({
        where: { id: config.id },
        data: {
          credentials: credentials,
        },
      });

      console.log(`\n✅ ChannelConfig mis à jour avec le phone_number_id.`);
    } else {
      console.log(`\n⚠️  ChannelConfig non trouvé. Création...`);
      await prisma.channelConfig.create({
        data: {
          tenantId: tenant.id,
          channel: "WHATSAPP",
          status: "inactive",
          credentials: {
            phoneNumberId: phoneNumberId,
          },
        },
      });
      console.log(`✅ ChannelConfig créé.`);
    }

    console.log(`\n🎉 Configuration terminée !`);
    console.log(`\n📝 Prochaines étapes:`);
    console.log(`   1. Configure les autres credentials Meta (wabaId, accessToken) via le dashboard superadmin`);
    console.log(`   2. Assure-toi que le backend et worker tournent`);
    console.log(`   3. Teste en envoyant un message WhatsApp`);

  } catch (error) {
    console.error("\n❌ Erreur:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updatePhoneNumberId();
