/**
 * Script de test (mode console) pour publier une annonce via SocialPostService.
 *
 * Objectif :
 * - Créer une annonce pour le tenant "Boutique Arcc Test"
 * - Déclencher la publication via publishSocialPostNow (APIs sociales directes)
 * - Afficher le statut de la publication pour chaque réseau
 *
 * Usage :
 *   node src/test_publish.js
 */

require("dotenv").config();

const { prisma } = require("./services/prisma");
const {
  createSocialPost,
  publishSocialPostNow,
} = require("./services/socialPostService");

// ID du tenant "Boutique Arcc Test" (vu dans les logs)
const DEFAULT_TENANT_ID = "e1916a0f-8464-4e3a-8cb7-636c9b12d860";
const TENANT_ID = process.env.TEST_TENANT_ID || DEFAULT_TENANT_ID;

// Contenu fourni par l'utilisateur
const IMAGE_URL =
  "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop";

const BODY = `
✨ L'ÉLÉGANCE REDÉFINIE - NOUVELLE COLLECTION ✨

Sublimez votre style avec nos nouvelles pièces de créateurs. Une sélection exclusive alliant confort, qualité premium et design contemporain.

🌟 Pourquoi nous choisir ?

Tissus d'exception.

Coupes impeccables.

Livraison express à Kaloum et dans tout Conakry.

📍 Retrouvez-nous : Boutique Fashion, Centre-ville.
📲 Commande directe : Cliquez sur le bouton WhatsApp ci-dessous !
`.trim();

// Liste complète des réseaux à cibler pour ce test
const NETWORKS = [
  "FACEBOOK",
  "LINKEDIN",
  "INSTAGRAM",
  "TIKTOK",
  "TWITTER",
  "THREADS",
];

async function main() {
  console.log("=".repeat(80));
  console.log("🧪 TEST PUBLICATION ANNONCE VIA MAKE");
  console.log("=".repeat(80));
  console.log("");

  console.log("📋 Configuration :");
  console.log("   Tenant ID          :", TENANT_ID);
  console.log("   Réseaux ciblés     :", NETWORKS.join(", "));
  console.log("   Image              :", IMAGE_URL);
  console.log("");

  try {
    // Vérifier que le tenant existe
    const tenant = await prisma.tenant.findUnique({
      where: { id: TENANT_ID },
      select: { id: true, name: true, companyName: true },
    });

    if (!tenant) {
      throw new Error(
        `Tenant introuvable en base pour l'ID ${TENANT_ID}. Vérifie l'ID ou TEST_TENANT_ID.`
      );
    }

    console.log(
      `✅ Tenant trouvé : ${tenant.companyName || tenant.name || tenant.id}`
    );

    console.log("");
    console.log("📝 Création de l'annonce de test...");

    const post = await createSocialPost({
      tenantId: TENANT_ID,
      title: "Test Make - Nouvelle collection Boutique Fashion",
      body: BODY,
      mediaUrls: [IMAGE_URL],
      networks: NETWORKS,
      scheduledAt: null,
    });

    console.log("✅ Annonce créée avec succès :", {
      postId: post.id,
      createdAt: post.createdAt,
      targets: post.targets.map((t) => t.network),
    });

    console.log("");
    console.log(
      "🚀 Lancement de la publication via SocialPostService (APIs sociales directes)..."
    );

    const result = await publishSocialPostNow({
      tenantId: TENANT_ID,
      postId: post.id,
    });

    console.log("");
    console.log("📊 Résultat de la publication :");
    console.log(
      "   Statut global de l'annonce :",
      result.post.status,
      "- publishedAt:",
      result.post.publishedAt
    );

    for (const r of result.results) {
      console.log(
        `   - ${r.network}: ${r.status}` +
          (r.externalId ? ` (externalId: ${r.externalId})` : "") +
          (r.error ? ` | erreur: ${r.error}` : "")
      );
    }

    console.log("");
    console.log(
      "✅ Test terminé. Vérifie directement tes réseaux sociaux (Instagram, Facebook, etc.)."
    );
  } catch (error) {
    console.error("");
    console.error("❌ ERREUR DURANT LE TEST DE PUBLICATION :");
    console.error(error.message);
    console.error(error.stack);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();

