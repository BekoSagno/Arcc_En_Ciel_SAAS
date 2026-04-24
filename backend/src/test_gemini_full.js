/**
 * ARCC EN CIEL - TEST DE VALIDATION GEMINI + PINECONE
 * Ce script valide que tout fonctionne sans OpenAI.
 */

require("dotenv").config();

const { Pinecone } = require("@pinecone-database/pinecone");
const { getEmbeddings, generateResponse } = require("./services/googleAiService");

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.index(process.env.PINECONE_INDEX, process.env.PINECONE_HOST);

async function runGeminiTest() {
  const tenantId = "boutique_gratuite_test";
  const infoSecret =
    "La boutique Arcc En Ciel offre un cafe gratuit a tous les visiteurs ce samedi de 9h a 12h.";

  console.log("🚀 Lancement du test 100% Google Gemini...");

  try {
    // ETAPE 1 : Indexation (Embeddings Google)
    console.log("1️⃣ Traduction et stockage (Embeddings text-embedding-004)...");
    const vector = await getEmbeddings(infoSecret);

    await index.namespace(tenantId).upsert([
      {
        id: `msg_${Date.now()}`,
        values: vector,
        metadata: { text: infoSecret },
      },
    ]);
    console.log("✅ Donnee stockee dans Pinecone.");

    console.log("⏳ Synchro...");
    await new Promise((r) => setTimeout(r, 2000));

    // ETAPE 2 : Recherche et Reponse (Gemini Flash)
    console.log("2️⃣ Recherche et reponse (Gemini 1.5 Flash)...");
    const queryVector = await getEmbeddings("Qu'est-ce qui est offert samedi ?");

    const searchResults = await index.namespace(tenantId).query({
      vector: queryVector,
      topK: 1,
      includeMetadata: true,
    });

    const context = searchResults.matches?.[0]?.metadata?.text || "";
    const finalAnswer = await generateResponse(
      context,
      "Qu'est-ce qui est offert samedi ?"
    );

    console.log("\n💬 REPONSE IA :", finalAnswer);

    if (finalAnswer.toLowerCase().includes("cafe")) {
      console.log("\n🏆 SUCCES : Le systeme 100% gratuit est operationnel !");
    }
  } catch (error) {
    console.error("❌ Echec du test:", error.message);
  }
}

runGeminiTest();
