/**
 * ARCC EN CIEL - TEST DE VALIDATION IA (Finalisé)
 * Ce script utilise les services natifs de votre application pour valider :
 * 1. La connexion à OpenAI (Embeddings)
 * 2. La connexion à Pinecone (Stockage via Host)
 * 3. La logique de réponse intelligente (RAG)
 */

require("dotenv").config();

const { prisma } = require("./services/prisma");
const ragIngestor = require("./services/ragIngestor");
const ragService = require("./services/ragService");
const { generateAnswer } = require("./services/aiService");

const getTenantId = async () => {
  if (process.env.TEST_TENANT_ID) {
    return process.env.TEST_TENANT_ID;
  }

  const tenant = await prisma.tenant.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!tenant) {
    throw new Error("Aucun tenant trouvé. Crée un client d'abord.");
  }

  return tenant.id;
};

async function lancerTestIA() {
  const tenantId = await getTenantId();

  console.log("\n--- 🌈 TEST SYSTÈME ARCC EN CIEL v2.1 ---");
  console.log(
    `📡 Connexion Host : ${process.env.PINECONE_HOST ? "Configurée ✅" : "Manquante ❌"}`
  );

  try {
    // 1. ÉTAPE D'APPRENTISSAGE
    console.log("\n1️⃣ Étape : Apprentissage des données...");
    const texteAApprendre =
      "La Boutique Fashion Conakry accepte les retours sous 48h. " +
      "Le contact SAV est le +224 600 00 00 00.";

    const source = await prisma.rAGSource.create({
      data: {
        tenantId,
        type: "TEXT",
        title: "Test IA - Politique retour",
        status: "processing",
      },
    });

    await ragIngestor.ingestSource({
      tenantId,
      sourceId: source.id,
      namespace: tenantId,
      content: texteAApprendre,
    });

    await prisma.rAGSource.update({
      where: { id: source.id },
      data: { status: "indexed" },
    });

    console.log("✅ Données envoyées et indexées dans Pinecone.");

    console.log("⏳ Attente de synchronisation vectorielle (3s)...");
    await new Promise((r) => setTimeout(r, 3000));

    // 2. ÉTAPE DE RÉPONSE
    console.log("\n2️⃣ Étape : Test de la réponse IA...");
    const question =
      "Quelles sont les conditions de retour et comment contacter le SAV ?";

    const context = await ragService.findRelevantContext({
      tenantId,
      question,
      topK: 5,
    });
    const result = await generateAnswer({ 
      question, 
      context,
      tenant: {
        id: tenantId,
      },
    });
    const reponse = typeof result === "string" ? result : result.text;

    console.log("\n-------------------------------------------");
    console.log("💬 QUESTION CLIENT :", question);
    console.log("🤖 RÉPONSE DE L'IA  :", reponse);
    console.log("-------------------------------------------");

    if (reponse.includes("48h") || reponse.includes("+224")) {
      console.log(
        "\n🏆 TEST RÉUSSI : L'IA a trouvé l'information dans sa mémoire !"
      );
      console.log("Votre SaaS est maintenant doté d'une intelligence fonctionnelle.");
    } else {
      console.log(
        "\n⚠️ TEST PARTIEL : L'IA a répondu mais n'a pas utilisé les données spécifiques."
      );
    }
  } catch (error) {
    console.error("\n❌ ERREUR DURANT LE TEST :");
    console.error("Détails :", error.message);

    if (error.message.includes("401") || error.message.includes("key")) {
      console.log("\n💡 Conseil : Vérifiez votre OPENAI_API_KEY dans le fichier .env");
    } else if (error.message.includes("404") || error.message.includes("Host")) {
      console.log("\n💡 Conseil : Vérifiez votre PINECONE_HOST dans le fichier .env");
    }
  } finally {
    await prisma.$disconnect();
  }
}

lancerTestIA();
