/**
 * Script de test \"réel\" qui appelle l'API HTTP /api/social-posts
 * pour créer et publier une annonce via le backend (Express) comme un vrai client.
 *
 * Usage :
 *   node src/test_real_publish.js
 */

require("dotenv").config();

const axios = require("axios");

// ID du tenant \"Boutique Arcc Test\" (vu dans les logs)
const TENANT_ID = "e1916a0f-8464-4e3a-8cb7-636c9b12d860";

// Endpoint HTTP de création d'annonce
const ENDPOINT =
  process.env.TEST_SOCIAL_POST_ENDPOINT ||
  "http://localhost:4000/api/social-posts";

async function main() {
  console.log("=".repeat(80));
  console.log("🧪 TEST RÉEL DE PUBLICATION D'ANNONCE VIA L'API HTTP");
  console.log("=".repeat(80));
  console.log("");

  console.log("📋 Configuration :");
  console.log("   Tenant ID :", TENANT_ID);
  console.log("   Endpoint  :", ENDPOINT);
  console.log("");

  const payload = {
    title: "Test de Lancement Officiel",
    body: "🚀 Lancement officiel Arcc En Ciel ! Publication multi-réseaux réussie. #Guinee #SaaS",
    mediaUrls: [
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800",
    ],
    networks: ["INSTAGRAM"],
    publishNow: true,
  };

  try {
    console.log("📝 Envoi de la requête HTTP POST vers /api/social-posts ...");

    const response = await axios.post(ENDPOINT, payload, {
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": TENANT_ID,
      },
      // Utile en local si besoin de voir les erreurs réseau
      validateStatus: () => true,
    });

    console.log("");
    console.log("📥 Réponse de l'API :");
    console.log("   Status :", response.status);
    console.log("   OK     :", response.status >= 200 && response.status < 300);

    try {
      console.log("   Body   :", JSON.stringify(response.data, null, 2));
    } catch (e) {
      console.log("   Body   : (non JSON ou vide)");
    }

    if (response.status >= 200 && response.status < 300) {
      console.log("");
      console.log("✅ Annonce créée et publication déclenchée avec succès.");
      console.log(
        "   Vérifie directement tes réseaux sociaux (Instagram, Facebook, etc.) pour le post publié via l'API Meta."
      );
    } else {
      console.log("");
      console.log("❌ L'API a renvoyé un statut d'erreur. Vérifie les logs backend.");
    }
  } catch (error) {
    console.error("");
    console.error("❌ ERREUR LORS DE L'APPEL HTTP :");
    console.error(error.message);
    if (error.response) {
      console.error("Status :", error.response.status);
      console.error("Data   :", error.response.data);
    }
    process.exitCode = 1;
  }
}

main();

