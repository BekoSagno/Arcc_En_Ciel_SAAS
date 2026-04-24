const axios = require("axios");

const apiKey = process.env.GEMINI_API_KEY;

/**
 * Analyse une image via Gemini Vision API et extrait les informations.
 * Retourne { description, text, analysis }
 * 
 * @param {Buffer|string} bufferOrBase64 - Buffer de l'image ou chaîne base64
 * @param {string} mimeType - Type MIME de l'image (image/jpeg, image/png, etc.)
 * @param {string} question - Question optionnelle du client sur l'image
 * @returns {Promise<{description: string, text: string, analysis: string}>}
 */
async function analyzeImage(bufferOrBase64, mimeType = "image/jpeg", question = null) {
  let imageBase64;
  let workingMime = mimeType || "image/jpeg";

  // Gérer l'entrée : peut être un Buffer ou une chaîne base64
  if (Buffer.isBuffer(bufferOrBase64)) {
    if (!bufferOrBase64 || bufferOrBase64.length === 0) {
      console.warn("[IMAGE] Buffer vide ou invalide");
      return { description: "", text: "", analysis: "" };
    }
    imageBase64 = bufferOrBase64.toString("base64");
  } else if (typeof bufferOrBase64 === "string") {
    if (!bufferOrBase64 || bufferOrBase64.length === 0) {
      console.warn("[IMAGE] Chaîne base64 vide ou invalide");
      return { description: "", text: "", analysis: "" };
    }
    imageBase64 = bufferOrBase64;
  } else {
    console.warn("[IMAGE] Type d'entrée invalide (attendu: Buffer ou string base64)");
    return { description: "", text: "", analysis: "" };
  }

  if (!apiKey) {
    console.warn("[IMAGE] GEMINI_API_KEY manquant, analyse d'image impossible.");
    return { description: "", text: "", analysis: "" };
  }

  // Normaliser le mimeType
  if (workingMime === "image/jpg") {
    workingMime = "image/jpeg";
  }

  // Liste des modèles à tester par ordre de probabilité de succès
  const modelVariants = [
    "gemini-flash-latest",        // Priorité : même modèle que pour le texte
    "gemini-1.5-flash-latest",    // Fallback 1
    "gemini-1.5-flash",           // Fallback 2
    "gemini-1.5-flash-002"        // Fallback 3
  ];

  // Liste des versions d'API à tester (v1beta en priorité, puis v1 en fallback)
  const apiVersions = ["v1beta", "v1"];

  // Construire le prompt selon si le client a posé une question ou non
  let promptText;
  if (question && question.trim().length > 0) {
    promptText = `Analyse cette image et réponds à la question du client : "${question}". 
    
Extrais toutes les informations pertinentes de l'image :
1. Décris le contenu de l'image de manière détaillée
2. Extrais tout texte visible dans l'image (OCR)
3. Réponds à la question du client en te basant sur ce que tu vois dans l'image
4. Identifie et liste TOUS les services, produits, offres ou informations commerciales mentionnés dans l'image

Réponds en JSON avec cette structure :
{
  "description": "Description détaillée du contenu de l'image",
  "text": "Texte extrait de l'image (OCR) si présent",
  "analysis": "Réponse à la question du client basée sur l'image",
  "services": ["Liste des services/produits/offres identifiés dans l'image"]
}

Le champ "services" doit être un tableau de chaînes, même s'il est vide [].`;
  } else {
    promptText = `Analyse cette image et extrais toutes les informations pertinentes.

Décris le contenu de l'image de manière détaillée et extrais tout texte visible (OCR).

IMPORTANT: Identifie et liste TOUS les services, produits, offres ou informations commerciales mentionnés dans l'image. 
Exemples de services à identifier :
- Formations (ex: "Formation Excel", "Formation Word", "Formation informatique de base")
- Bureaux/espaces (ex: "Bureau A1", "Open Space", "Bureau individuel")
- Séminaires (ex: "Séminaire 2 jours", "Organisation de séminaires")
- Licences/logiciels (ex: "Microsoft Office", "Kaspersky Premium")
- Tout autre service ou produit mentionné

Réponds en JSON avec cette structure :
{
  "description": "Description détaillée du contenu de l'image",
  "text": "Texte extrait de l'image (OCR) si présent",
  "analysis": "Analyse générale de l'image et informations pertinentes",
  "services": ["Service 1", "Service 2", "Service 3"]
}

Le champ "services" doit être un tableau de chaînes, même s'il est vide [].`;
  }

  // Tester chaque version d'API et chaque modèle jusqu'à trouver celui qui fonctionne
  for (const apiVersion of apiVersions) {
    for (const modelName of modelVariants) {
      try {
        console.log(`[IMAGE] Tentative d'analyse avec : ${apiVersion}/${modelName}...`);
        
        const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${apiKey}`;
      
        const response = await axios.post(url, {
          contents: [{
            parts: [
              { 
                text: promptText
              },
              { 
                inlineData: { 
                  mimeType: workingMime, 
                  data: imageBase64 
                } 
              }
            ]
          }]
        }, {
          headers: { 
            'Content-Type': "application/json" 
          },
          timeout: 60000 // 60 secondes timeout
        });

        const resultText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        console.log(`[IMAGE] Réponse brute Gemini (${modelName}):`, resultText.substring(0, 200) + "...");
        
        // Extraire le JSON de la réponse
        const jsonMatch = resultText.match(/\{[\s\S]*\}/s);
        
        if (jsonMatch) {
          let parsed = {};
          try {
            parsed = JSON.parse(jsonMatch[0]);
          } catch (e) {
            console.warn(`[IMAGE] Impossible de parser le JSON pour ${modelName}, utilisation du texte brut`);
            // Si le JSON n'est pas valide, utiliser le texte brut comme description
            parsed = { 
              description: resultText || "", 
              text: "", 
              analysis: resultText || "" 
            };
          }

          const result = {
            description: parsed.description || parsed.text || resultText || "",
            text: parsed.text || "",
            analysis: parsed.analysis || parsed.description || resultText || "",
            services: parsed.services || [] // Liste des services identifiés dans l'image
          };

          console.log(`[IMAGE] ✅ SUCCÈS avec le modèle ${modelName}`);
          console.log("[IMAGE] Résultat :", {
            descriptionLength: result.description.length,
            textLength: result.text.length,
            analysisLength: result.analysis.length,
            servicesCount: result.services.length
          });
          return result;
        } else {
          console.warn(`[IMAGE] ⚠️ Aucun JSON trouvé dans la réponse pour ${modelName}`);
          // Utiliser le texte brut comme description
          return {
            description: resultText || "",
            text: "",
            analysis: resultText || "",
            services: [] // Pas de services identifiés si pas de JSON
          };
        }
      } catch (error) {
        const errorMsg = error.response?.data?.error?.message || error.message;
        const statusCode = error.response?.status;
        console.warn(`[IMAGE] ⚠️ Échec avec ${modelName} (${statusCode || 'N/A'}): ${errorMsg}`);
        
        // Si c'est un 404, on continue la boucle vers le modèle suivant
        // Pour les autres erreurs (timeout, etc.), on continue aussi
        continue;
      }
    }
  }

  console.error("❌ Tous les modèles Gemini ont échoué pour l'analyse d'image (404 ou autre).");
  return { description: "", text: "", analysis: "", services: [] };
}

module.exports = {
  analyzeImage,
};
