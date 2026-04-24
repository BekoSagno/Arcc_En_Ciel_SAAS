require("dotenv").config();

/**
 * Script pour trouver le Phone Number ID Meta depuis différentes sources
 */

console.log("\n🔍 Recherche du Phone Number ID Meta...\n");

// Méthode 1 : Depuis le .env
const envPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
if (envPhoneNumberId) {
  console.log("✅ Trouvé dans le fichier .env:");
  console.log(`   WHATSAPP_PHONE_NUMBER_ID = ${envPhoneNumberId}\n`);
} else {
  console.log("❌ Non trouvé dans le fichier .env\n");
}

// Méthode 2 : Instructions pour Meta Developer Dashboard
console.log("📋 Pour trouver le Phone Number ID dans Meta Developer Dashboard:");
console.log("   1. Va sur https://developers.facebook.com/apps/");
console.log("   2. Sélectionne ton application Meta");
console.log("   3. Dans le menu de gauche, clique sur 'WhatsApp'");
console.log("   4. Clique sur 'API Setup' ou 'Configuration'");
console.log("   5. Tu verras 'Phone number ID' avec l'ID (ex: 917809738090702)\n");

// Méthode 3 : Instructions pour les logs
console.log("📋 Pour trouver le Phone Number ID depuis les logs:");
console.log("   1. Envoie un message WhatsApp au numéro de test");
console.log("   2. Regarde les logs du backend");
console.log("   3. Tu devrais voir dans les logs:");
console.log("      [WEBHOOK] Données extraites: {");
console.log("        phoneNumberId: '917809738090702'  ← C'est ça !");
console.log("      }");
console.log("   4. Ou dans le payload complet:");
console.log("      'metadata': { 'phone_number_id': '917809738090702' }\n");

// Méthode 4 : Vérifier dans la base de données
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log("📋 Vérification dans la base de données:\n");
    
    const configs = await prisma.channelConfig.findMany({
      where: {
        channel: "WHATSAPP",
        credentials: { not: null },
      },
      include: {
        tenant: {
          include: {
            users: { select: { email: true }, take: 1 },
          },
        },
      },
    });

    if (configs.length > 0) {
      console.log(`✅ ${configs.length} configuration(s) trouvée(s) avec credentials:\n`);
      configs.forEach((config) => {
        const creds = config.credentials;
        if (creds && typeof creds === "object" && creds.phoneNumberId) {
          console.log(`   Tenant: ${config.tenant.name}`);
          console.log(`   Email: ${config.tenant.users[0]?.email || "N/A"}`);
          console.log(`   Phone Number ID: ${creds.phoneNumberId}`);
          console.log("");
        }
      });
    } else {
      console.log("❌ Aucune configuration avec credentials trouvée dans la base de données.\n");
    }

    const identities = await prisma.channelIdentity.findMany({
      where: { channel: "WHATSAPP" },
      include: {
        tenant: {
          include: {
            users: { select: { email: true }, take: 1 },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    if (identities.length > 0) {
      console.log(`📱 Derniers ChannelIdentity WhatsApp (${identities.length}):\n`);
      identities.forEach((identity) => {
        console.log(`   Tenant: ${identity.tenant.name}`);
        console.log(`   Email: ${identity.tenant.users[0]?.email || "N/A"}`);
        console.log(`   External ID: ${identity.externalId}`);
        console.log(`   (Note: Si c'est un numéro de téléphone comme +224..., ce n'est PAS le Phone Number ID Meta)`);
        console.log("");
      });
    }

  } catch (error) {
    console.error("Erreur:", error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();

console.log("\n💡 Résumé:");
console.log("   Le Phone Number ID Meta est un ID technique (ex: 917809738090702)");
console.log("   Il est différent du numéro de téléphone visible (ex: +1 555 172 1454)");
console.log("   Meta l'envoie toujours dans les webhooks, même en local");
console.log("   Il est OBLIGATOIRE pour que le système fonctionne\n");
