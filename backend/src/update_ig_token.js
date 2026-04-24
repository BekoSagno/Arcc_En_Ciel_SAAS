/**
 * Script de mise à jour du jeton Instagram pour un tenant donné.
 *
 * Usage :
 *   node src/update_ig_token.js
 *
 * Il réutilise la table SocialAccount (plateforme INSTAGRAM) et chiffre
 * le token via encryptToken avant de le stocker.
 */

require("dotenv").config();

const { prisma } = require("./services/prisma");
const { encryptToken } = require("./services/cryptoService");

const TENANT_ID = "e1916a0f-8464-4e3a-8cb7-636c9b12d860";
const PLATFORM = "INSTAGRAM";

// ⚠️ Pour plus de sécurité, on peut aussi mettre ce token dans une variable d'env.
const NEW_TOKEN =
  process.env.NEW_IG_ACCESS_TOKEN ||
  "EAAUfa8bZCpUkBQswdEQ7ZBh0wYXBMzcNBeeobmDE3BSzZCfKY2RScwYfOllKfX1iBVoJMidhY9q4Dcopd7mCrO6IBEIZBVVs3y5tH8HnIHaQthvpK6CLdSt3qtFRr8Is5FnniBdbpbLVle6Xw04857iEUwZBQ8tiSgmaeuZAxZBVFRkia1qqpBJmtp0KZBQQcgWZA2AZDZD";

async function main() {
  console.log("=".repeat(80));
  console.log("🔐 MISE À JOUR DU JETON INSTAGRAM POUR LE TENANT");
  console.log("=".repeat(80));
  console.log("");
  console.log("Tenant   :", TENANT_ID);
  console.log("Plateform:", PLATFORM);
  console.log("Token    :", NEW_TOKEN ? `fourni (longueur=${NEW_TOKEN.length})` : "❌ manquant");
  console.log("");

  if (!NEW_TOKEN) {
    console.error("❌ Aucun jeton fourni. Définis NEW_IG_ACCESS_TOKEN dans .env ou dans le script.");
    process.exit(1);
  }

  try {
    // Vérifier qu'un compte INSTAGRAM existe déjà pour ce tenant
    const existing = await prisma.socialAccount.findFirst({
      where: { tenantId: TENANT_ID, platform: PLATFORM },
    });

    if (!existing) {
      console.error(
        "❌ Aucun compte INSTAGRAM trouvé pour ce tenant dans SocialAccount.\n" +
          "   Va d'abord dans le dashboard > Intégrations et configure Instagram (platformId + token),\n" +
          "   puis relance ce script pour mettre à jour le jeton."
      );
      process.exit(1);
    }

    console.log("✅ Compte Instagram existant trouvé :");
    console.log("   ID        :", existing.id);
    console.log("   platformId:", existing.platformId);
    console.log("");

    const accessTokenEnc = encryptToken(NEW_TOKEN);

    const updated = await prisma.socialAccount.update({
      where: {
        tenantId_platform: {
          tenantId: TENANT_ID,
          platform: PLATFORM,
        },
      },
      data: {
        accessTokenEnc,
        isActive: true,
        updatedAt: new Date(),
      },
    });

    console.log("✅ Jeton Instagram mis à jour avec succès pour ce tenant.");
    console.log("   Compte ID :", updated.id);
    console.log("   Actif     :", updated.isActive ? "Oui" : "Non");
  } catch (error) {
    console.error("❌ Erreur lors de la mise à jour du jeton Instagram :", error.message);
    console.error(error.stack);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();

