/**
 * Script de configuration pour initialiser le Tenant et le Canal WhatsApp
 * Usage: node src/setup_production_test.js
 */

require("dotenv").config();
const { prisma } = require("./services/prisma");

const TENANT_NAME = "Boutique Arcc Test";
// Meta WhatsApp utilise le phone_number_id comme identifiant, pas le numéro
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "917809738090702";
const ADMIN_EMAIL = "admin@boutique-arcc-test.com";
const ADMIN_PASSWORD = "Admin123!"; // Changez ce mot de passe après la première connexion
const ADMIN_NAME = "Admin Boutique Arcc Test";

async function setupProductionTest() {
  console.log("🚀 Démarrage de la configuration...\n");

  try {
    // ============================================
    // ÉTAPE 1 : Vérifier/Créer le Tenant
    // ============================================
    console.log("📦 Étape 1 : Configuration du Tenant...");
    
    // Vérifier d'abord si le ChannelIdentity existe (indépendamment du tenant)
    let existingIdentity = await prisma.channelIdentity.findUnique({
      where: {
        channel_externalId: {
          channel: "WHATSAPP",
          externalId: WHATSAPP_PHONE_NUMBER_ID,
        },
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Vérifier/Créer le Tenant
    let tenant = await prisma.tenant.findUnique({
      where: { name: TENANT_NAME },
    });

    if (tenant) {
      console.log(`✅ Tenant trouvé : "${TENANT_NAME}" (ID: ${tenant.id})`);
    } else {
      console.log(`📝 Création du tenant "${TENANT_NAME}"...`);
      tenant = await prisma.tenant.create({
        data: {
          name: TENANT_NAME,
          status: "active",
          timezone: "Africa/Conakry",
        },
      });
      console.log(`✅ Tenant créé : "${TENANT_NAME}" (ID: ${tenant.id})`);
    }

    // ============================================
    // ÉTAPE 2 : Vérifier/Créer le ChannelIdentity
    // ============================================
    console.log("\n📱 Étape 2 : Configuration du Canal WhatsApp...");

    if (existingIdentity) {
      console.log(`✅ ChannelIdentity trouvé pour phone_number_id: ${WHATSAPP_PHONE_NUMBER_ID}`);
      console.log(`   - ID: ${existingIdentity.id}`);
      console.log(`   - Label: ${existingIdentity.label || "N/A"}`);
      console.log(`   - Tenant actuel: ${existingIdentity.tenant.name} (${existingIdentity.tenant.id})`);
      
      // Vérifier que le tenantId correspond
      if (existingIdentity.tenantId !== tenant.id) {
        console.log(`\n⚠️  ATTENTION: Le ChannelIdentity est lié à un autre tenant!`);
        console.log(`   - Tenant actuel du ChannelIdentity: ${existingIdentity.tenant.name} (${existingIdentity.tenantId})`);
        console.log(`   - Tenant souhaité: ${tenant.name} (${tenant.id})`);
        console.log(`   - Mise à jour en cours...`);
        
        await prisma.channelIdentity.update({
          where: {
            channel_externalId: {
              channel: "WHATSAPP",
              externalId: WHATSAPP_PHONE_NUMBER_ID,
            },
          },
          data: {
            tenantId: tenant.id,
            label: "Boutique Arcc Test - WhatsApp",
          },
        });
        console.log(`✅ ChannelIdentity mis à jour avec le bon tenantId`);
        existingIdentity.tenantId = tenant.id; // Mettre à jour pour la suite
      } else {
        console.log(`✅ Le ChannelIdentity est déjà correctement lié au tenant "${tenant.name}"`);
      }
    } else {
      console.log(`📝 Création du ChannelIdentity pour phone_number_id: ${WHATSAPP_PHONE_NUMBER_ID}...`);
      
      existingIdentity = await prisma.channelIdentity.create({
        data: {
          tenantId: tenant.id,
          channel: "WHATSAPP",
          externalId: WHATSAPP_PHONE_NUMBER_ID,
          label: "Meta WhatsApp",
        },
      });
      
      console.log(`✅ ChannelIdentity créé (ID: ${existingIdentity.id})`);
    }

    // ============================================
    // ÉTAPE 3 : Vérification finale
    // ============================================
    console.log("\n🔍 Étape 3 : Vérification de la configuration...");

    const finalCheck = await prisma.channelIdentity.findUnique({
      where: {
        channel_externalId: {
          channel: "WHATSAPP",
          externalId: WHATSAPP_PHONE_NUMBER_ID,
        },
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    if (!finalCheck) {
      throw new Error("❌ La vérification finale a échoué : ChannelIdentity introuvable");
    }

    console.log("✅ Configuration vérifiée avec succès!\n");

    // ============================================
    // RÉSUMÉ
    // ============================================
    console.log("=" .repeat(60));
    console.log("📊 RÉSUMÉ DE LA CONFIGURATION");
    console.log("=" .repeat(60));
    console.log(`\n🏪 Tenant:`);
    console.log(`   - Nom: ${finalCheck.tenant.name}`);
    console.log(`   - ID: ${finalCheck.tenant.id}`);
    console.log(`   - Statut: ${finalCheck.tenant.status}`);
    console.log(`\n📱 Canal WhatsApp:`);
    console.log(`   - Phone Number ID: ${WHATSAPP_PHONE_NUMBER_ID}`);
    console.log(`   - ChannelIdentity ID: ${finalCheck.id}`);
    console.log(`   - Label: ${finalCheck.label || "N/A"}`);
    console.log(`\n🔗 Routage:`);
    console.log(`   - Les webhooks avec phone_number_id = ${WHATSAPP_PHONE_NUMBER_ID} seront routés vers le tenant "${finalCheck.tenant.name}"`);
    console.log(`   - Le namespace Pinecone sera: ${finalCheck.tenant.id}`);
    console.log("\n" + "=" .repeat(60));
    console.log("✅ Configuration terminée avec succès!\n");

    // ============================================
    // VÉRIFICATION DU WEBHOOK
    // ============================================
    console.log("🔍 Vérification du webhook...");
    console.log(`   - Route: POST /api/webhooks/whatsapp`);
    console.log(`   - Le webhook utilise déjà resolveTenantId() pour trouver le tenant`);
    console.log(`   - Le phone_number_id du webhook Meta sera utilisé comme externalId`);
    console.log(`   - Si phone_number_id = "${WHATSAPP_PHONE_NUMBER_ID}", le tenantId sera: ${finalCheck.tenant.id}\n`);

    // Test de résolution
    const testResolution = await prisma.channelIdentity.findUnique({
      where: {
        channel_externalId: {
          channel: "WHATSAPP",
          externalId: WHATSAPP_PHONE_NUMBER_ID,
        },
      },
      select: { tenantId: true },
    });

    if (testResolution && testResolution.tenantId === tenant.id) {
      console.log("✅ Test de résolution réussi!");
      console.log(`   - Un webhook avec phone_number_id: ${WHATSAPP_PHONE_NUMBER_ID} sera routé vers tenantId: ${testResolution.tenantId}\n`);
    } else {
      console.log("⚠️  Le test de résolution a échoué. Vérifiez la configuration.\n");
    }

    // ============================================
    // ÉTAPE 4 : Vérifier/Créer l'utilisateur admin
    // ============================================
    console.log("👤 Étape 4 : Configuration de l'utilisateur admin...");

    let adminUser = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL },
      include: { tenant: true },
    });

    if (adminUser) {
      console.log(`✅ Utilisateur trouvé : ${ADMIN_EMAIL}`);
      console.log(`   - Nom: ${adminUser.name || "N/A"}`);
      console.log(`   - Tenant: ${adminUser.tenant.name}`);
      
      // Vérifier que l'utilisateur est lié au bon tenant
      if (adminUser.tenantId !== tenant.id) {
        console.log(`\n⚠️  ATTENTION: L'utilisateur est lié à un autre tenant!`);
        console.log(`   - Tenant actuel: ${adminUser.tenant.name} (${adminUser.tenantId})`);
        console.log(`   - Tenant souhaité: ${tenant.name} (${tenant.id})`);
        console.log(`   - Mise à jour en cours...`);
        
        await prisma.user.update({
          where: { email: ADMIN_EMAIL },
          data: {
            tenantId: tenant.id,
            name: ADMIN_NAME,
          },
        });
        console.log(`✅ Utilisateur mis à jour avec le bon tenantId`);
      }
    } else {
      console.log(`📝 Création de l'utilisateur admin ${ADMIN_EMAIL}...`);
      
      const { hashPassword } = require("./utils/password");
      const passwordHash = await hashPassword(ADMIN_PASSWORD);
      adminUser = await prisma.user.create({
        data: {
          email: ADMIN_EMAIL,
          name: ADMIN_NAME,
          role: "TENANT_ADMIN",
          passwordHash,
          tenantId: tenant.id,
          status: "active",
        },
        include: { tenant: true },
      });
      
      console.log(`✅ Utilisateur créé (ID: ${adminUser.id})`);
    }

    console.log("\n" + "=" .repeat(60));
    console.log("🔐 INFORMATIONS DE CONNEXION");
    console.log("=" .repeat(60));
    console.log(`\n📧 Email: ${ADMIN_EMAIL}`);
    console.log(`🔑 Mot de passe: ${ADMIN_PASSWORD}`);
    console.log(`\n⚠️  IMPORTANT: Changez ce mot de passe après la première connexion!`);
    console.log(`\n🌐 URL de connexion: http://localhost:3000/login`);
    console.log("\n" + "=" .repeat(60));

  } catch (error) {
    console.error("\n❌ Erreur lors de la configuration:");
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécution
if (require.main === module) {
  setupProductionTest()
    .then(() => {
      console.log("🎉 Script terminé avec succès!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Erreur fatale:", error);
      process.exit(1);
    });
}

module.exports = { setupProductionTest };
