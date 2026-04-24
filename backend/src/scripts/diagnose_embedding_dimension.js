/**
 * Script de diagnostic pour vérifier la dimension des embeddings Gemini
 * et proposer des solutions pour la compatibilité avec Pinecone
 */

require("dotenv").config();
const { getEmbeddings } = require("../services/googleAiService");

async function diagnoseEmbeddingDimension() {
  console.log("🔍 DIAGNOSTIC DE LA DIMENSION DES EMBEDDINGS\n");

  // 1. Vérifier la configuration
  console.log("1️⃣ CONFIGURATION ACTUELLE:");
  const embedModel = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";
  const pineconeDim = process.env.PINECONE_DIM || "768";
  console.log(`   GEMINI_EMBED_MODEL: ${embedModel}`);
  console.log(`   PINECONE_DIM: ${pineconeDim}`);
  console.log("");

  // 2. Tester l'embedding
  console.log("2️⃣ TEST D'EMBEDDING:");
  const testText = "Ceci est un test pour vérifier la dimension";
  
  try {
    const vector = await getEmbeddings(testText);
    const actualDimension = vector.length;
    
    console.log(`   ✅ Embedding généré avec succès`);
    console.log(`   Dimension réelle: ${actualDimension}`);
    console.log(`   Dimension attendue par Pinecone: ${pineconeDim}`);
    console.log("");

    // 3. Analyser la compatibilité
    console.log("3️⃣ ANALYSE DE COMPATIBILITÉ:");
    if (actualDimension === parseInt(pineconeDim)) {
      console.log(`   ✅ PARFAIT: Les dimensions correspondent (${actualDimension})`);
      console.log(`   Aucune action nécessaire.`);
    } else if (actualDimension > parseInt(pineconeDim)) {
      console.log(`   ⚠️  INCOMPATIBILITÉ DÉTECTÉE`);
      console.log(`   Gemini génère ${actualDimension} dimensions`);
      console.log(`   Pinecone attend ${pineconeDim} dimensions`);
      console.log(`   Le système tronque actuellement de ${actualDimension} à ${pineconeDim}`);
      console.log("");
      console.log("   📋 SOLUTIONS RECOMMANDÉES:");
      console.log("");
      console.log("   OPTION 1 (RECOMMANDÉE): Reconfigurer Pinecone pour 3072 dimensions");
      console.log("   ──────────────────────────────────────────────────────────────");
      console.log("   Avantages:");
      console.log("   • Meilleure qualité de recherche (pas de troncature)");
      console.log("   • Utilisation complète des capacités de Gemini");
      console.log("   • Pas de perte d'information");
      console.log("");
      console.log("   Actions requises:");
      console.log("   1. Créer un nouvel index Pinecone avec dimension=3072");
      console.log("   2. Mettre à jour PINECONE_DIM=3072 dans .env");
      console.log("   3. Réingérer tous les documents existants");
      console.log("");
      console.log("   OPTION 2: Garder Pinecone à 768 dimensions");
      console.log("   ──────────────────────────────────────────────────────────────");
      console.log("   Avantages:");
      console.log("   • Pas besoin de recréer l'index");
      console.log("   • Moins d'espace de stockage");
      console.log("");
      console.log("   Inconvénients:");
      console.log("   • Perte d'information (troncature)");
      console.log("   • Qualité de recherche potentiellement réduite");
      console.log("   • Le système continue de tronquer automatiquement");
      console.log("");
    } else {
      console.log(`   ❌ ERREUR: Dimension trop courte (${actualDimension} < ${pineconeDim})`);
      console.log(`   Cette situation ne devrait pas se produire.`);
      console.log(`   Vérifiez votre configuration Gemini.`);
    }

  } catch (error) {
    console.error("   ❌ Erreur lors du test d'embedding:", error.message);
    console.log("");
    console.log("   🔧 VÉRIFICATIONS:");
    console.log("   1. Vérifiez que GEMINI_API_KEY est valide dans .env");
    console.log("   2. Vérifiez que GEMINI_EMBED_MODEL est correct");
    console.log("   3. Vérifiez votre connexion internet");
  }

  console.log("");
  console.log("──────────────────────────────────────────────────────────────");
  console.log("💡 RECOMMANDATION:");
  console.log("   Si vous avez peu de documents, OPTION 1 est recommandée.");
  console.log("   Si vous avez beaucoup de documents, vous pouvez garder");
  console.log("   l'OPTION 2 (troncature) pour l'instant.");
  console.log("──────────────────────────────────────────────────────────────");
}

diagnoseEmbeddingDimension().catch((error) => {
  console.error("❌ Erreur fatale:", error);
  process.exit(1);
});
