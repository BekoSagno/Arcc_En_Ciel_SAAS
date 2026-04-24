require("dotenv").config();
const { prisma } = require("../services/prisma");

async function checkWhatsAppConfig() {
  console.log("\n🔍 VÉRIFICATION DE LA CONFIGURATION META WHATSAPP\n");
  console.log("=" .repeat(60));

  // 1. Vérifier les variables d'environnement
  console.log("\n📋 1. VARIABLES D'ENVIRONNEMENT (.env) :\n");
  
  const requiredVars = {
    META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
    META_APP_SECRET: process.env.META_APP_SECRET,
    META_VERIFY_TOKEN: process.env.META_VERIFY_TOKEN,
  };

  let allEnvVarsPresent = true;
  for (const [key, value] of Object.entries(requiredVars)) {
    if (value) {
      const displayValue = key.includes("TOKEN") || key.includes("SECRET")
        ? `${value.substring(0, 10)}... (${value.length} caractères)`
        : value;
      console.log(`   ✅ ${key}: ${displayValue}`);
    } else {
      console.log(`   ❌ ${key}: MANQUANT`);
      allEnvVarsPresent = false;
    }
  }

  // 2. Vérifier le format du token
  console.log("\n🔐 2. VALIDATION DU TOKEN D'ACCÈS :\n");
  
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (accessToken) {
    const issues = [];
    
    if (accessToken.includes(" ")) {
      issues.push("   ⚠️  Le token contient des espaces (peut causer des erreurs)");
    }
    if (accessToken.includes("\n") || accessToken.includes("\r")) {
      issues.push("   ⚠️  Le token contient des retours à la ligne (peut causer des erreurs)");
    }
    if (accessToken.length < 50) {
      issues.push("   ⚠️  Le token semble trop court (attendu: 100-200 caractères)");
    }
    if (accessToken.length > 500) {
      issues.push("   ⚠️  Le token semble trop long (attendu: 100-200 caractères)");
    }
    
    if (issues.length === 0) {
      console.log("   ✅ Format du token semble correct");
    } else {
      issues.forEach(issue => console.log(issue));
    }
  } else {
    console.log("   ❌ Aucun token à valider");
  }

  // 3. Vérifier les configurations par tenant dans la base de données
  console.log("\n🏢 3. CONFIGURATIONS PAR TENANT (ChannelConfig) :\n");
  
  try {
    const configs = await prisma.channelConfig.findMany({
      where: { channel: "WHATSAPP" },
      include: { tenant: { select: { name: true, id: true } } },
    });

    if (configs.length === 0) {
      console.log("   ℹ️  Aucune configuration WhatsApp trouvée dans ChannelConfig");
      console.log("   ℹ️  Le système utilisera les variables d'environnement (.env)");
    } else {
      configs.forEach((config, idx) => {
        console.log(`   📦 Configuration ${idx + 1} (Tenant: ${config.tenant.name}):`);
        const creds = config.credentials || {};
        if (creds.accessToken || creds.meta_access_token || creds.authToken) {
          const token = creds.accessToken || creds.meta_access_token || creds.authToken;
          console.log(`      ✅ Token présent: ${token.substring(0, 10)}... (${token.length} caractères)`);
        } else {
          console.log(`      ❌ Token manquant`);
        }
        if (creds.phoneNumberId || creds.whatsapp_phone_number_id || creds.whatsappNumber) {
          const phoneId = creds.phoneNumberId || creds.whatsapp_phone_number_id || creds.whatsappNumber;
          console.log(`      ✅ Phone Number ID: ${phoneId}`);
        } else {
          console.log(`      ❌ Phone Number ID manquant`);
        }
      });
    }
  } catch (error) {
    console.error("   ❌ Erreur lors de la lecture des configurations:", error.message);
  }

  // 4. Test de connexion à l'API Meta (optionnel)
  console.log("\n🌐 4. TEST DE CONNEXION À L'API META :\n");
  
  if (accessToken && process.env.WHATSAPP_PHONE_NUMBER_ID) {
    try {
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      const testUrl = `https://graph.facebook.com/v18.0/${phoneNumberId}?fields=id,display_phone_number,verified_name&access_token=${accessToken}`;
      
      console.log("   🔄 Test de connexion en cours...");
      const response = await fetch(testUrl);
      const data = await response.json();

      if (response.ok) {
        console.log("   ✅ Connexion réussie !");
        console.log(`      Phone Number ID: ${data.id || "N/A"}`);
        console.log(`      Numéro affiché: ${data.display_phone_number || "N/A"}`);
        console.log(`      Nom vérifié: ${data.verified_name || "N/A"}`);
      } else {
        console.log("   ❌ Échec de la connexion");
        console.log(`      Code d'erreur: ${data.error?.code || "N/A"}`);
        console.log(`      Message: ${data.error?.message || "N/A"}`);
        console.log(`      Type: ${data.error?.type || "N/A"}`);
        
        if (data.error?.code === 190 || data.error?.message?.includes("expired")) {
          console.log("\n   💡 SOLUTION: Le token a expiré. Génère un nouveau token dans Meta Developer.");
        } else if (data.error?.message?.includes("API access blocked")) {
          console.log("\n   💡 SOLUTION: L'accès API est bloqué. Vérifie les permissions du token.");
        }
      }
    } catch (error) {
      console.error("   ❌ Erreur lors du test:", error.message);
    }
  } else {
    console.log("   ⚠️  Impossible de tester (token ou phone number ID manquant)");
  }

  // 5. Résumé et recommandations
  console.log("\n" + "=".repeat(60));
  console.log("\n📝 RÉSUMÉ ET RECOMMANDATIONS :\n");

  if (!allEnvVarsPresent) {
    console.log("   ⚠️  Certaines variables d'environnement sont manquantes.");
    console.log("   💡 Ajoute-les dans ton fichier .env à la racine du dossier backend.\n");
  }

  if (accessToken) {
    console.log("   ✅ Token d'accès présent");
    console.log("   💡 Si tu reçois 'API access blocked', vérifie que :");
    console.log("      1. Le token est un 'System User Token' (pas un User Token)");
    console.log("      2. Le token a les permissions WhatsApp Business");
    console.log("      3. Le numéro WhatsApp est vérifié dans Meta Business Manager");
    console.log("      4. L'application Meta a les permissions nécessaires\n");
  } else {
    console.log("   ❌ Token d'accès manquant");
    console.log("   💡 Génère un token dans : https://developers.facebook.com/apps/\n");
  }

  console.log("   📚 Documentation Meta :");
  console.log("      https://developers.facebook.com/docs/whatsapp/cloud-api/get-started\n");

  await prisma.$disconnect();
}

checkWhatsAppConfig().catch((error) => {
  console.error("\n❌ Erreur lors de la vérification:", error);
  process.exit(1);
});
