require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function checkTenantWhatsApp() {
  try {
    const tenantEmail = process.argv[2]; // Email du tenant à vérifier

    if (!tenantEmail) {
      console.log("Usage: node check_tenant_whatsapp.js <email_du_tenant>");
      console.log("Exemple: node check_tenant_whatsapp.js client@example.com");
      process.exit(1);
    }

    // Trouver le tenant par email de l'utilisateur
    const user = await prisma.user.findUnique({
      where: { email: tenantEmail },
      include: { tenant: true },
    });

    if (!user) {
      console.error(`❌ Utilisateur avec l'email "${tenantEmail}" introuvable.`);
      process.exit(1);
    }

    const tenant = user.tenant;
    console.log(`\n📋 Informations du Tenant:`);
    console.log(`   ID: ${tenant.id}`);
    console.log(`   Nom: ${tenant.name}`);
    console.log(`   Email utilisateur: ${user.email}`);
    console.log(`   Nom utilisateur: ${user.name}`);

    // Vérifier ChannelIdentity
    const channelIdentity = await prisma.channelIdentity.findFirst({
      where: {
        tenantId: tenant.id,
        channel: "WHATSAPP",
      },
    });

    console.log(`\n📱 Configuration WhatsApp:`);
    if (channelIdentity) {
      console.log(`   ✅ ChannelIdentity trouvé:`);
      console.log(`      - External ID (numéro WhatsApp): ${channelIdentity.externalId}`);
      console.log(`      - Label: ${channelIdentity.label}`);
    } else {
      console.log(`   ❌ Aucun ChannelIdentity WhatsApp trouvé pour ce tenant.`);
      console.log(`   ⚠️  Le numéro WhatsApp doit être configuré lors de l'inscription.`);
    }

    // Vérifier ChannelConfig
    const channelConfig = await prisma.channelConfig.findFirst({
      where: {
        tenantId: tenant.id,
        channel: "WHATSAPP",
      },
    });

    if (channelConfig) {
      console.log(`   ✅ ChannelConfig trouvé:`);
      console.log(`      - Status: ${channelConfig.status}`);
      const credentials = channelConfig.credentials;
      if (credentials && typeof credentials === "object") {
        console.log(`      - Phone Number ID: ${credentials.phoneNumberId || "Non configuré"}`);
        console.log(`      - WABA ID: ${credentials.wabaId || "Non configuré"}`);
        console.log(`      - Access Token: ${credentials.accessToken ? "✅ Configuré" : "❌ Manquant"}`);
      } else {
        console.log(`      - Credentials: ❌ Non configurés`);
      }
    } else {
      console.log(`   ❌ Aucun ChannelConfig WhatsApp trouvé pour ce tenant.`);
    }

    // Vérifier les sources RAG
    const ragSources = await prisma.rAGSource.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        _count: { select: { chunks: true } },
      },
    });

    console.log(`\n📚 Sources RAG:`);
    if (ragSources.length > 0) {
      ragSources.forEach((source) => {
        console.log(`   - ${source.title} (${source.type}) - ${source.status} - ${source._count.chunks} chunks`);
      });
    } else {
      console.log(`   ⚠️  Aucune source RAG trouvée. L'IA ne pourra pas répondre aux questions.`);
    }

    // Résumé
    console.log(`\n📊 Résumé:`);
    const hasIdentity = !!channelIdentity;
    const hasConfig = !!channelConfig;
    const hasCredentials = channelConfig?.credentials && 
                           typeof channelConfig.credentials === "object" &&
                           channelConfig.credentials.phoneNumberId &&
                           channelConfig.credentials.accessToken;
    const hasRAG = ragSources.length > 0 && ragSources.some(s => s.status === "indexed");

    console.log(`   ${hasIdentity ? "✅" : "❌"} ChannelIdentity configuré`);
    console.log(`   ${hasConfig ? "✅" : "❌"} ChannelConfig créé`);
    console.log(`   ${hasCredentials ? "✅" : "❌"} Credentials Meta configurés`);
    console.log(`   ${hasRAG ? "✅" : "❌"} Sources RAG indexées`);

    if (hasIdentity && hasConfig && hasCredentials && hasRAG) {
      console.log(`\n✅ Le tenant est prêt pour WhatsApp !`);
      console.log(`\n📝 Pour tester:`);
      console.log(`   1. Assure-toi que le backend tourne (npm run dev)`);
      console.log(`   2. Assure-toi que le worker tourne (npm run worker)`);
      console.log(`   3. Assure-toi que ngrok est actif et pointe vers http://localhost:4000`);
      console.log(`   4. Configure le webhook Meta pour pointer vers: https://ton-ngrok-url.ngrok-free.dev/webhook`);
      console.log(`   5. Envoie un message WhatsApp au numéro: ${channelIdentity.externalId}`);
    } else {
      console.log(`\n⚠️  Le tenant n'est pas encore prêt pour WhatsApp.`);
      if (!hasCredentials) {
        console.log(`\n💡 Action requise: Configure les credentials Meta via le dashboard superadmin.`);
      }
      if (!hasRAG) {
        console.log(`\n💡 Action requise: Upload et indexe des documents dans le dashboard client.`);
      }
    }

  } catch (error) {
    console.error("Erreur:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTenantWhatsApp();
