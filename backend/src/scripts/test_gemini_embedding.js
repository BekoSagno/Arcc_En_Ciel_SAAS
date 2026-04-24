require("dotenv").config();

/**
 * Script pour tester la configuration Gemini Embedding
 * Usage: node src/scripts/test_gemini_embedding.js
 */

async function testGeminiEmbedding() {
  console.log("=".repeat(80));
  console.log("🧪 TEST DE LA CONFIGURATION GEMINI EMBEDDING");
  console.log("=".repeat(80));
  console.log("");

  // 1. Vérifier les variables d'environnement
  console.log("1️⃣ VÉRIFICATION DES VARIABLES D'ENVIRONNEMENT:");
  const apiKey = process.env.GEMINI_API_KEY;
  const embedModel = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";
  
  console.log(`   GEMINI_API_KEY: ${apiKey ? `✅ Présent (${apiKey.length} caractères)` : "❌ MANQUANT"}`);
  console.log(`   GEMINI_EMBED_MODEL: ${embedModel}`);
  console.log("");

  if (!apiKey) {
    console.error("❌ ERREUR: GEMINI_API_KEY manquant dans .env");
    console.error("");
    console.error("💡 SOLUTION:");
    console.error("   1. Va sur https://aistudio.google.com/app/apikey");
    console.error("   2. Crée une nouvelle clé API");
    console.error("   3. Ajoute-la dans backend/.env:");
    console.error("      GEMINI_API_KEY=ta_cle_api_ici");
    process.exit(1);
  }

  // 2. Tester la connexion à l'API Gemini
  console.log("2️⃣ TEST DE CONNEXION À L'API GEMINI:");
  try {
    const testUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(testUrl);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("   ❌ Erreur de connexion:", errorData.error?.message || `HTTP ${response.status}`);
      
      if (response.status === 401 || response.status === 403) {
        console.error("");
        console.error("   🚨 CLÉ API INVALIDE OU SANS PERMISSIONS !");
        console.error("   💡 Vérifie que ta clé API est correcte et active");
      }
      process.exit(1);
    }
    
    const data = await response.json();
    console.log("   ✅ Connexion réussie");
    console.log(`   Modèles disponibles: ${data.models?.length || 0}`);
  } catch (error) {
    console.error("   ❌ Erreur:", error.message);
    if (error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED")) {
      console.error("");
      console.error("   🚨 PROBLÈME DE CONNEXION INTERNET !");
      console.error("   💡 Vérifie ta connexion internet");
    }
    process.exit(1);
  }

  console.log("");

  // 3. Tester l'embedding avec un texte simple
  console.log("3️⃣ TEST D'EMBEDDING:");
  const testText = "Ceci est un test d'embedding";
  const modelName = embedModel.startsWith("models/") ? embedModel : `models/${embedModel}`;
  
  try {
    console.log(`   Texte de test: "${testText}"`);
    console.log(`   Modèle: ${modelName}`);
    console.log("");

    const url = `https://generativelanguage.googleapis.com/v1beta/${modelName}:embedContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: {
          parts: [{ text: testText }]
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
      
      console.error("   ❌ Erreur lors de l'embedding:", errorMessage);
      console.error("");
      
      if (errorMessage.includes("not found") || errorMessage.includes("404")) {
        console.error("   🚨 MODÈLE INTROUVABLE !");
        console.error("");
        console.error("   💡 SOLUTIONS:");
        console.error(`      1. Vérifie que le modèle ${embedModel} existe`);
        console.error("      2. Modèles disponibles:");
        console.error("         - gemini-embedding-001 (recommandé)");
        console.error("         - text-embedding-004");
        console.error("      3. Dans .env, utilise:");
        console.error("         GEMINI_EMBED_MODEL=gemini-embedding-001");
      } else if (errorMessage.includes("400") || errorMessage.includes("Bad Request")) {
        console.error("   🚨 REQUÊTE INVALIDE !");
        console.error("   💡 Vérifie le format de la requête");
      } else if (errorMessage.includes("429") || errorMessage.includes("quota")) {
        console.error("   🚨 QUOTA DÉPASSÉ !");
        console.error("   💡 Vérifie ton quota dans Google AI Studio");
      } else if (errorMessage.includes("401") || errorMessage.includes("403")) {
        console.error("   🚨 CLÉ API INVALIDE !");
        console.error("   💡 Vérifie que GEMINI_API_KEY est correcte");
      }
      
      process.exit(1);
    }

    const data = await response.json();
    const vector = data?.embedding?.values;

    if (!vector || !Array.isArray(vector) || vector.length === 0) {
      console.error("   ❌ Réponse invalide: embedding.values manquant");
      process.exit(1);
    }

    console.log("   ✅ Embedding généré avec succès !");
    console.log(`   Dimension: ${vector.length}`);
    console.log(`   Premières valeurs: [${vector.slice(0, 5).map(v => v.toFixed(4)).join(", ")}, ...]`);
    console.log("");

    // Vérifier la dimension
    if (vector.length === 768) {
      console.log("   ✅ Dimension 768 (compatible avec Pinecone standard)");
    } else if (vector.length === 3072) {
      console.log("   ⚠️ Dimension 3072 (vérifie que ton index Pinecone est configuré pour cette dimension)");
    } else {
      console.log(`   ⚠️ Dimension ${vector.length} (vérifie la configuration de ton index Pinecone)`);
    }

  } catch (error) {
    console.error("   ❌ Erreur:", error.message);
    if (error.message.includes("fetch failed")) {
      console.error("");
      console.error("   🚨 PROBLÈME DE CONNEXION !");
      console.error("   💡 Vérifie:");
      console.error("      - Ta connexion internet");
      console.error("      - Que l'API Gemini est accessible");
      console.error("      - Qu'il n'y a pas de firewall qui bloque");
    }
    process.exit(1);
  }

  console.log("");
  console.log("=".repeat(80));
  console.log("✅ TOUS LES TESTS SONT PASSÉS !");
  console.log("=".repeat(80));
  console.log("");
  console.log("💡 Si tu as encore des problèmes:");
  console.log("   1. Vérifie que GEMINI_API_KEY est valide dans .env");
  console.log("   2. Vérifie que GEMINI_EMBED_MODEL est correct");
  console.log("   3. Redémarre le serveur backend après modification du .env");
}

testGeminiEmbedding().catch((error) => {
  console.error("❌ Erreur fatale:", error);
  process.exit(1);
});
