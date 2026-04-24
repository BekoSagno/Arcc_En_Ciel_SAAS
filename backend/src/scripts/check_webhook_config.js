require("dotenv").config();

/**
 * Script pour diagnostiquer la configuration du webhook Meta WhatsApp
 * Vérifie l'URL ngrok, le verify token, et donne des instructions pour reconfigurer
 */

function checkWebhookConfig() {
  console.log("=".repeat(80));
  console.log("🔍 DIAGNOSTIC DE LA CONFIGURATION WEBHOOK META WHATSAPP");
  console.log("=".repeat(80));
  console.log("");

  // 1. Vérifier les variables d'environnement
  console.log("1️⃣ VÉRIFICATION DES VARIABLES D'ENVIRONNEMENT:");
  const verifyToken = process.env.META_VERIFY_TOKEN || "arcc-meta-verify";
  const appSecret = process.env.META_APP_SECRET;
  const appId = process.env.META_APP_ID;
  
  console.log(`   META_VERIFY_TOKEN: ${verifyToken ? "✅ Présent" : "❌ MANQUANT"}`);
  console.log(`   META_APP_SECRET: ${appSecret ? "✅ Présent" : "❌ MANQUANT"}`);
  console.log(`   META_APP_ID: ${appId ? "✅ Présent" : "❌ MANQUANT"}`);
  console.log("");

  if (!appSecret) {
    console.error("   ⚠️ META_APP_SECRET manquant - nécessaire pour vérifier les signatures");
  }

  // 2. Instructions pour obtenir l'URL ngrok
  console.log("2️⃣ CONFIGURATION NGROK:");
  console.log("   📋 ÉTAPES:");
  console.log("   1. Vérifie que ngrok est lancé et affiche l'URL publique");
  console.log("   2. L'URL doit ressembler à: https://xxxxx.ngrok-free.dev");
  console.log("   3. L'URL complète du webhook doit être: https://xxxxx.ngrok-free.dev/webhook");
  console.log("");
  console.log("   ⚠️ IMPORTANT:");
  console.log("   - L'URL ngrok change à chaque redémarrage (plan gratuit)");
  console.log("   - Tu dois mettre à jour l'URL dans Meta à chaque fois");
  console.log("   - Pour une URL fixe, utilise ngrok avec un domaine réservé (plan payant)");
  console.log("");

  // 3. Instructions pour configurer le webhook dans Meta
  console.log("3️⃣ CONFIGURATION DU WEBHOOK DANS META:");
  console.log("   📋 ÉTAPES DÉTAILLÉES:");
  console.log("");
  console.log("   ÉTAPE 1: Accéder à la configuration WhatsApp");
  console.log("   - Va sur https://developers.facebook.com/apps/");
  console.log("   - Sélectionne ton application Meta");
  console.log("   - Va dans 'WhatsApp' > 'Configuration'");
  console.log("   - Clique sur 'Configuration' dans le menu de gauche");
  console.log("");
  console.log("   ÉTAPE 2: Configurer l'URL du webhook");
  console.log("   - Dans la section 'Webhook', clique sur 'Modifier'");
  console.log(`   - URL du callback: https://TON-URL-NGROK.webhook`);
  console.log(`   - Token de vérification: ${verifyToken}`);
  console.log("   - Clique sur 'Vérifier et enregistrer'");
  console.log("");
  console.log("   ÉTAPE 3: S'abonner aux événements");
  console.log("   - Dans la section 'Abonnements', coche:");
  console.log("     ✅ messages");
  console.log("     ✅ message_status");
  console.log("   - Clique sur 'Enregistrer'");
  console.log("");
  console.log("   ÉTAPE 4: Vérifier que le webhook fonctionne");
  console.log("   - Meta va appeler GET /webhook avec:");
  console.log("     ?hub.mode=subscribe");
  console.log(`     &hub.verify_token=${verifyToken}`);
  console.log("     &hub.challenge=XXXXX");
  console.log("   - Si tu vois '✅ Webhook validé par Meta !' dans les logs, c'est bon !");
  console.log("");

  // 4. Test manuel du webhook
  console.log("4️⃣ TEST MANUEL DU WEBHOOK:");
  console.log("   Pour tester si le webhook répond correctement:");
  console.log("");
  console.log("   1. Assure-toi que le serveur backend est lancé (port 4000)");
  console.log("   2. Assure-toi que ngrok est lancé et pointe vers localhost:4000");
  console.log("   3. Teste l'URL dans ton navigateur:");
  console.log(`      https://TON-URL-NGROK/webhook?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=test123`);
  console.log("   4. Tu devrais voir 'test123' dans la réponse");
  console.log("");

  // 5. Vérifier les logs
  console.log("5️⃣ VÉRIFICATION DES LOGS:");
  console.log("   Quand Meta envoie un message, tu devrais voir dans les logs backend:");
  console.log("   - 🔵 [timestamp] POST /webhook");
  console.log("   - 📩 Nouveau message reçu");
  console.log("   - [WEBHOOK WHATSAPP] ✅ Tenant résolu");
  console.log("");
  console.log("   Si tu ne vois RIEN dans les logs, cela signifie:");
  console.log("   ❌ Meta n'appelle pas le webhook");
  console.log("   → Vérifie l'URL dans Meta");
  console.log("   → Vérifie que ngrok est bien lancé");
  console.log("   → Vérifie que le serveur backend écoute sur le port 4000");
  console.log("");

  // 6. Problèmes courants
  console.log("6️⃣ PROBLÈMES COURANTS:");
  console.log("");
  console.log("   ❌ PROBLÈME: ngrok ne reçoit rien");
  console.log("   → Solution: L'URL dans Meta est incorrecte ou le webhook est désactivé");
  console.log("   → Action: Reconfigure le webhook dans Meta avec la nouvelle URL ngrok");
  console.log("");
  console.log("   ❌ PROBLÈME: GET /webhook retourne 403");
  console.log(`   → Solution: Le verify_token ne correspond pas (attendu: ${verifyToken})`);
  console.log("   → Action: Vérifie META_VERIFY_TOKEN dans .env et dans Meta");
  console.log("");
  console.log("   ❌ PROBLÈME: POST /webhook retourne 401");
  console.log("   → Solution: La signature Meta est invalide");
  console.log("   → Action: Vérifie META_APP_SECRET dans .env");
  console.log("");
  console.log("   ❌ PROBLÈME: Messages reçus mais pas traités");
  console.log("   → Solution: Le numéro expéditeur n'est pas mappé à un tenant");
  console.log("   → Action: Utilise: node src/scripts/manage_test_mappings.js add <numero> <tenant_email>");
  console.log("");

  console.log("=".repeat(80));
  console.log("📝 RÉSUMÉ:");
  console.log("=".repeat(80));
  console.log(`   1. URL ngrok actuelle: Vérifie dans le terminal ngrok`);
  console.log(`   2. URL webhook complète: https://TON-URL-NGROK/webhook`);
  console.log(`   3. Verify Token: ${verifyToken}`);
  console.log(`   4. App Secret: ${appSecret ? "✅ Configuré" : "❌ Manquant"}`);
  console.log("   5. Action requise: Reconfigurer le webhook dans Meta avec la nouvelle URL");
  console.log("=".repeat(80));
}

checkWebhookConfig();
