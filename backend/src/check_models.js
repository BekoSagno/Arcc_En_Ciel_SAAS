/**
 * Script de diagnostic: Liste tous les modèles disponibles avec la clé API actuelle
 * Utilise genAI.listModels() pour découvrir les modèles d'embedding disponibles
 */

require("dotenv").config();

const { GoogleGenerativeAI } = require("@google/generative-ai");

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("❌ GEMINI_API_KEY manquant dans .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function listAvailableModels() {
  console.log("=".repeat(60));
  console.log("🔍 DIAGNOSTIC: Modèles disponibles avec votre clé API");
  console.log("=".repeat(60));
  console.log(`📋 Clé API: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
  console.log("=".repeat(60));
  
  try {
    // Lister tous les modèles disponibles via l'API REST
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    console.log("\n🔄 Récupération des modèles depuis l'API...\n");
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`HTTP ${response.status}: ${errorData?.error?.message || "Erreur inconnue"}`);
    }
    
    const data = await response.json();
    const models = data.models || [];
    
    console.log(`\n✅ ${models.length} modèles trouvés\n`);
    
    // Filtrer les modèles d'embedding
    const embeddingModels = [];
    const chatModels = [];
    const otherModels = [];
    
    for (const model of models) {
      const modelName = model.name || "";
      const displayName = model.displayName || "";
      const supportedMethods = model.supportedGenerationMethods || [];
      
      // Détecter les modèles d'embedding
      if (modelName.includes("embedding") || 
          modelName.includes("embed") ||
          supportedMethods.includes("embedContent") ||
          supportedMethods.includes("batchEmbedContents")) {
        embeddingModels.push({
          name: modelName,
          displayName,
          supportedMethods,
          description: model.description || ""
        });
      } else if (modelName.includes("gemini") || 
                 modelName.includes("chat") ||
                 supportedMethods.includes("generateContent")) {
        chatModels.push({
          name: modelName,
          displayName,
          supportedMethods,
          description: model.description || ""
        });
      } else {
        otherModels.push({
          name: modelName,
          displayName,
          supportedMethods,
          description: model.description || ""
        });
      }
    }
    
    // Afficher les modèles d'embedding
    if (embeddingModels.length > 0) {
      console.log("📊 MODÈLES D'EMBEDDING DISPONIBLES:");
      console.log("-".repeat(60));
      embeddingModels.forEach((model, idx) => {
        console.log(`\n${idx + 1}. ${model.name}`);
        if (model.displayName) console.log(`   Display: ${model.displayName}`);
        if (model.description) console.log(`   Description: ${model.description}`);
        if (model.supportedMethods.length > 0) {
          console.log(`   Méthodes supportées: ${model.supportedMethods.join(", ")}`);
        }
      });
      console.log("\n" + "=".repeat(60));
    } else {
      console.log("⚠️  AUCUN MODÈLE D'EMBEDDING TROUVÉ");
      console.log("=".repeat(60));
    }
    
    // Afficher les modèles de chat (optionnel)
    if (chatModels.length > 0 && process.env.SHOW_CHAT_MODELS === "true") {
      console.log("\n💬 MODÈLES DE CHAT DISPONIBLES:");
      console.log("-".repeat(60));
      chatModels.slice(0, 5).forEach((model, idx) => {
        console.log(`${idx + 1}. ${model.name}`);
      });
      if (chatModels.length > 5) {
        console.log(`... et ${chatModels.length - 5} autres modèles de chat`);
      }
    }
    
    // Recommandations
    console.log("\n" + "=".repeat(60));
    console.log("💡 RECOMMANDATIONS:");
    console.log("=".repeat(60));
    
    if (embeddingModels.length > 0) {
      const recommendedModel = embeddingModels.find(m => 
        m.name.includes("text-embedding-004") || 
        m.name.includes("embedding-001")
      ) || embeddingModels[0];
      
      console.log(`\n✅ Modèle recommandé: ${recommendedModel.name}`);
      console.log(`   Utilisez dans votre .env:`);
      console.log(`   GEMINI_EMBED_MODEL=${recommendedModel.name.replace(/^models\//, "")}`);
      
      if (recommendedModel.supportedMethods.includes("embedContent")) {
        console.log(`   ✅ Supporte embedContent`);
      }
      if (recommendedModel.supportedMethods.includes("batchEmbedContents")) {
        console.log(`   ✅ Supporte batchEmbedContents`);
      }
    } else {
      console.log("\n⚠️  Aucun modèle d'embedding trouvé.");
      console.log("   Vérifiez que votre clé API a accès aux modèles d'embedding.");
      console.log("   Connectez-vous à https://aistudio.google.com/ pour vérifier.");
    }
    
    console.log("\n" + "=".repeat(60));
    
  } catch (error) {
    console.error("\n❌ ERREUR lors de la récupération des modèles:");
    console.error(`   ${error.message}`);
    console.error("\n💡 Vérifiez que:");
    console.error("   1. GEMINI_API_KEY est valide dans votre .env");
    console.error("   2. Votre clé API a accès à l'API Generative AI");
    console.error("   3. Vous êtes connecté à Internet");
    console.error("\n" + "=".repeat(60));
    process.exit(1);
  }
}

// Exécuter le diagnostic
listAvailableModels()
  .then(() => {
    console.log("\n✅ Diagnostic terminé");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erreur fatale:", error);
    process.exit(1);
  });
