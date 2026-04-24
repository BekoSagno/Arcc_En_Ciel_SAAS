require("dotenv").config();
const { sendMetaWhatsAppMessage } = require("../services/messagingService");

/**
 * Script de test pour envoyer un message WhatsApp via Meta API
 * Usage: node src/scripts/test_meta_send.js [phone_number] [message]
 * Exemple: node src/scripts/test_meta_send.js +224626606960 "Test Manuel"
 */

const TEST_PHONE = process.argv[2] || "+224626606960";
const TEST_MESSAGE = process.argv[3] || "🧪 Test Manuel - Envoi WhatsApp depuis le système Arcc En Ciel";

async function testSend() {
  console.log("=".repeat(60));
  console.log("🧪 TEST D'ENVOI WHATSAPP META API");
  console.log("=".repeat(60));
  console.log("");

  // Vérification des variables d'environnement
  console.log("📋 VÉRIFICATION DE LA CONFIGURATION:");
  console.log("   META_ACCESS_TOKEN:", process.env.META_ACCESS_TOKEN ? `✅ Présent (${process.env.META_ACCESS_TOKEN.length} caractères)` : "❌ MANQUANT");
  console.log("   WHATSAPP_PHONE_NUMBER_ID:", process.env.WHATSAPP_PHONE_NUMBER_ID || "❌ MANQUANT");
  console.log("   Token commence par:", process.env.META_ACCESS_TOKEN?.substring(0, 20) || "N/A");
  console.log("");

  if (!process.env.META_ACCESS_TOKEN) {
    console.error("❌ ERREUR: META_ACCESS_TOKEN manquant dans .env");
    process.exit(1);
  }

  if (!process.env.WHATSAPP_PHONE_NUMBER_ID) {
    console.error("❌ ERREUR: WHATSAPP_PHONE_NUMBER_ID manquant dans .env");
    process.exit(1);
  }

  // Test de validation du token avec un appel simple à l'API Meta
  console.log("🔍 TEST DE VALIDATION DU TOKEN:");
  try {
    const testUrl = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}`;
    console.log(`   Appel API: GET ${testUrl}`);
    
    const testResponse = await fetch(testUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}`,
      },
    });

    const testData = await testResponse.json();
    
    if (!testResponse.ok) {
      console.error("   ❌ ERREUR DE VALIDATION:");
      console.error("      Code:", testData.error?.code);
      console.error("      Type:", testData.error?.type);
      console.error("      Message:", testData.error?.message);
      console.error("      Sous-code:", testData.error?.error_subcode);
      console.error("      fbtrace_id:", testData.error?.fbtrace_id);
      
      if (testData.error?.code === 190 || testData.error?.message?.includes("expired")) {
        console.error("");
        console.error("   🚨 TOKEN EXPIRÉ !");
        console.error("      Génère un nouveau token dans le dashboard Meta Developer.");
      } else if (testData.error?.code === 200 || testData.error?.message?.includes("API access blocked")) {
        console.error("");
        console.error("   🚨 ACCÈS API BLOQUÉ !");
        console.error("      Le token n'a pas les permissions nécessaires.");
      }
      
      process.exit(1);
    } else {
      console.log("   ✅ Token valide !");
      console.log("   Numéro WhatsApp:", testData.display_phone_number || testData.verified_name || "N/A");
    }
  } catch (error) {
    console.error("   ❌ ERREUR LORS DE LA VALIDATION:", error.message);
    process.exit(1);
  }

  console.log("");
  console.log("📤 TENTATIVE D'ENVOI DU MESSAGE:");
  console.log(`   Destinataire: ${TEST_PHONE}`);
  console.log(`   Message: ${TEST_MESSAGE}`);
  console.log("");

  try {
    // Utiliser null comme tenantId pour forcer l'utilisation des variables .env
    const result = await sendMetaWhatsAppMessage({
      to: TEST_PHONE,
      body: TEST_MESSAGE,
      tenantId: null, // Force l'utilisation de .env
    });

    console.log("");
    console.log("=".repeat(60));
    if (result.sent) {
      console.log("✅ SUCCÈS ! Message envoyé avec succès");
      console.log(`   Message ID: ${result.messageId || "N/A"}`);
      console.log(`   Phone Number ID utilisé: ${result.phoneNumberId}`);
    } else {
      console.log("❌ ÉCHEC ! Le message n'a pas pu être envoyé");
      console.log(`   Message ID: ${result.messageId || "N/A"}`);
      console.log(`   Phone Number ID: ${result.phoneNumberId || "N/A"}`);
    }
    console.log("=".repeat(60));
  } catch (error) {
    console.error("");
    console.error("=".repeat(60));
    console.error("❌ ERREUR CRITIQUE:");
    console.error(error.message);
    console.error(error.stack);
    console.error("=".repeat(60));
    process.exit(1);
  }
}

testSend().catch((error) => {
  console.error("Erreur fatale:", error);
  process.exit(1);
});
