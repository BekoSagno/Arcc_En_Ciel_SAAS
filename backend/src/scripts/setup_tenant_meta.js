#!/usr/bin/env node

/**
 * Script de configuration Meta WhatsApp pour un tenant.
 *
 * Usage:
 *   cd backend
 *   node src/scripts/setup_tenant_meta.js TENANT_ID PHONE_NUMBER_ID WABA_ID ACCESS_TOKEN
 *
 * Exemple:
 *   node src/scripts/setup_tenant_meta.js \
 *     9b801926-c38a-45ee-903d-47d67e45ef85 \
 *     917809738090702 \
 *     892395053706370 \
 *     "EAA....token_meta_ici"
 *
 * Effets:
 *   - upsert ChannelConfig (channel = WHATSAPP) avec les credentials:
 *       { phoneNumberId, wabaId, accessToken }
 *   - upsert ChannelIdentity pour lier phoneNumberId -> tenantId
 */

const { prisma } = require("../services/prisma");
const { upsertMetaWhatsAppConfig } = require("../services/metaConfigService");

async function main() {
  const [tenantId, phoneNumberId, wabaId, accessToken] = process.argv.slice(2);

  if (!tenantId || !phoneNumberId || !wabaId || !accessToken) {
    console.error(
      "\nUsage: node src/scripts/setup_tenant_meta.js TENANT_ID PHONE_NUMBER_ID WABA_ID ACCESS_TOKEN\n"
    );
    console.error(
      "Exemple:\n  node src/scripts/setup_tenant_meta.js 9b8...ef85 917809738090702 892395053706370 \"EAA...token\"\n"
    );
    process.exit(1);
  }

  console.log("🔧 Configuration Meta WhatsApp pour le tenant:");
  console.log("  tenantId       :", tenantId);
  console.log("  phoneNumberId  :", phoneNumberId);
  console.log("  wabaId         :", wabaId);
  console.log("  accessToken    :", accessToken.substring(0, 12) + "... (masqué)");

  try {
    const { tenant, config, identity } = await upsertMetaWhatsAppConfig({
      tenantId,
      phoneNumberId,
      wabaId,
      accessToken,
    });

    console.log("✅ Tenant trouvé:", tenant.name);
    console.log("✅ ChannelConfig mis à jour (WHATSAPP):", {
      id: config.id,
      status: config.status,
    });
    console.log("✅ ChannelIdentity mis à jour:", {
      id: identity.id,
      channel: identity.channel,
      externalId: identity.externalId,
      tenantId: identity.tenantId,
    });

    console.log("\n🎉 Configuration Meta WhatsApp terminée avec succès.");
  } catch (error) {
    console.error("❌ Erreur lors de la configuration Meta WhatsApp:", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();

