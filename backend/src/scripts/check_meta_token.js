require("dotenv").config();

/**
 * Script pour diagnostiquer le token Meta WhatsApp
 * Vérifie la validité, les permissions et l'état du token
 */

async function checkToken() {
  console.log("=".repeat(80));
  console.log("🔍 DIAGNOSTIC DU TOKEN META WHATSAPP");
  console.log("=".repeat(80));
  console.log("");

  const accessToken = process.env.META_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!accessToken) {
    console.error("❌ META_ACCESS_TOKEN manquant dans .env");
    process.exit(1);
  }

  if (!phoneNumberId) {
    console.error("❌ WHATSAPP_PHONE_NUMBER_ID manquant dans .env");
    process.exit(1);
  }

  console.log("📋 CONFIGURATION:");
  console.log(`   Token: ${accessToken.substring(0, 20)}... (${accessToken.length} caractères)`);
  console.log(`   Phone Number ID: ${phoneNumberId}`);
  console.log("");

  // 1. Vérifier le token avec l'endpoint debug
  console.log("1️⃣ VÉRIFICATION DU TOKEN (Graph API Debug):");
  try {
    // Utiliser l'App ID et App Secret pour debug_token (plus fiable)
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    
    let debugUrl;
    if (appId && appSecret) {
      // Méthode recommandée : utiliser App Access Token
      const appAccessToken = `${appId}|${appSecret}`;
      debugUrl = `https://graph.facebook.com/v18.0/debug_token?input_token=${accessToken}&access_token=${appAccessToken}`;
      console.log("   Utilisation de l'App Access Token pour la vérification");
    } else {
      // Fallback : utiliser le token lui-même
      debugUrl = `https://graph.facebook.com/v18.0/debug_token?input_token=${accessToken}&access_token=${accessToken}`;
      console.log("   ⚠️ META_APP_ID et META_APP_SECRET non trouvés, utilisation du token pour debug");
    }
    
    const debugResponse = await fetch(debugUrl);
    const debugData = await debugResponse.json();

    if (!debugResponse.ok) {
      console.error("   ❌ Erreur lors de la vérification:", debugData.error);
      if (debugData.error?.code === 200 || debugData.error?.message?.includes("API access blocked")) {
        console.error("");
        console.error("   🚨 TOKEN BLOQUÉ - Causes possibles:");
        console.error("      1. Le token n'est pas un System User Token");
        console.error("      2. Le token a été révoqué ou expiré");
        console.error("      3. L'application Meta n'a pas les permissions WhatsApp activées");
        console.error("      4. Le token n'a pas les scopes nécessaires");
      }
    } else {
      const tokenInfo = debugData.data;
      console.log("   ✅ Token accessible via debug_token");
      console.log("   App ID:", tokenInfo.app_id);
      console.log("   Type:", tokenInfo.type);
      console.log("   Expire à:", tokenInfo.expires_at ? new Date(tokenInfo.expires_at * 1000).toISOString() : "Jamais");
      console.log("   Permissions (scopes):", tokenInfo.scopes?.join(", ") || "Aucune");
      console.log("   Valid:", tokenInfo.is_valid);
      
      // Vérifier les permissions WhatsApp
      const hasWhatsAppMessaging = tokenInfo.scopes?.some(s => s.includes("whatsapp_business_messaging"));
      const hasWhatsAppManagement = tokenInfo.scopes?.some(s => s.includes("whatsapp_business_management"));
      
      console.log("");
      console.log("   📋 PERMISSIONS WHATSAPP:");
      console.log("      whatsapp_business_messaging:", hasWhatsAppMessaging ? "✅" : "❌");
      console.log("      whatsapp_business_management:", hasWhatsAppManagement ? "✅" : "❌");
      
      if (!hasWhatsAppMessaging || !hasWhatsAppManagement) {
        console.error("");
        console.error("   ⚠️ PERMISSIONS MANQUANTES !");
        console.error("      Le token doit avoir les permissions WhatsApp pour fonctionner.");
      }
      
      if (!tokenInfo.is_valid) {
        console.error("   ⚠️ Token marqué comme invalide par Meta !");
      }
      
      // Vérifier le type de token
      if (tokenInfo.type !== "USER" && tokenInfo.type !== "SYSTEM_USER") {
        console.error("");
        console.error("   ⚠️ TYPE DE TOKEN SUSPECT:", tokenInfo.type);
        console.error("      Pour WhatsApp, utilise un System User Token ou User Token avec permissions WhatsApp");
      }
    }
  } catch (error) {
    console.error("   ❌ Erreur:", error.message);
  }

  console.log("");

  // 2. Vérifier le Phone Number ID
  console.log("2️⃣ VÉRIFICATION DU PHONE NUMBER ID:");
  try {
    const phoneUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}?access_token=${accessToken}`;
    const phoneResponse = await fetch(phoneUrl);
    const phoneData = await phoneResponse.json();

    if (!phoneResponse.ok) {
      console.error("   ❌ Erreur:", phoneData.error);
      console.error("      Code:", phoneData.error?.code);
      console.error("      Type:", phoneData.error?.type);
      console.error("      Message:", phoneData.error?.message);
      
      if (phoneData.error?.code === 200 || phoneData.error?.message?.includes("API access blocked")) {
        console.error("");
        console.error("   🚨 PROBLÈME IDENTIFIÉ: API ACCESS BLOCKED");
        console.error("");
        console.error("   🔧 SOLUTIONS:");
        console.error("");
        console.error("   1. VÉRIFIER LES PERMISSIONS DU TOKEN:");
        console.error("      - Va sur https://developers.facebook.com/apps/");
        console.error("      - Sélectionne ton application");
        console.error("      - Va dans 'Outils' > 'Token d'accès'");
        console.error("      - Vérifie que le token a les permissions:");
        console.error("        * whatsapp_business_messaging");
        console.error("        * whatsapp_business_management");
        console.error("");
        console.error("   2. GÉNÉRER UN NOUVEAU TOKEN:");
        console.error("      - Dans le dashboard Meta:");
        console.error("        a. Va dans 'WhatsApp' > 'Configuration API'");
        console.error("        b. Clique sur 'Générer un nouveau token'");
        console.error("        c. Sélectionne 'System User Token'");
        console.error("        d. Assure-toi que les permissions WhatsApp sont cochées");
        console.error("        e. Copie le nouveau token dans .env");
        console.error("");
        console.error("   3. VÉRIFIER LE NUMÉRO WHATSAPP:");
        console.error("      - Le numéro doit être vérifié dans Meta Business Manager");
        console.error("      - Le numéro doit être approuvé pour l'envoi de messages");
        console.error("      - Vérifie que le Phone Number ID correspond au bon numéro");
        console.error("");
        console.error("   4. VÉRIFIER L'APPLICATION META:");
        console.error("      - L'application doit être en mode 'Production' ou 'Development'");
        console.error("      - Les produits WhatsApp doivent être activés");
        console.error("      - Le webhook doit être configuré et vérifié");
      }
    } else {
      console.log("   ✅ Phone Number ID valide");
      console.log("   Display Phone Number:", phoneData.display_phone_number || "N/A");
      console.log("   Verified Name:", phoneData.verified_name || "N/A");
      console.log("   Quality Rating:", phoneData.quality_rating || "N/A");
    }
  } catch (error) {
    console.error("   ❌ Erreur:", error.message);
  }

  console.log("");

  // 3. Test d'envoi (sans vraiment envoyer)
  console.log("3️⃣ TEST DE CONNEXION À L'API MESSAGES:");
  try {
    // On fait juste un GET pour voir si on a accès
    const testUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages?access_token=${accessToken}`;
    const testResponse = await fetch(testUrl, { method: "GET" });
    const testData = await testResponse.json();

    if (testResponse.ok) {
      console.log("   ✅ Accès à l'API Messages autorisé");
    } else {
      console.error("   ❌ Accès refusé:", testData.error?.message);
    }
  } catch (error) {
    console.error("   ❌ Erreur:", error.message);
  }

  console.log("");
  console.log("=".repeat(80));
}

checkToken().catch((error) => {
  console.error("Erreur fatale:", error);
  process.exit(1);
});
