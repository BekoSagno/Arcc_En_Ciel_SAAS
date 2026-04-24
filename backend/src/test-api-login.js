require("dotenv").config();

async function testApiLogin() {
  const email = "admin@boutique-arcc-test.com";
  const password = "Admin123!";

  try {
    console.log("🧪 Test de l'API de login...\n");
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Mot de passe: ${password}\n`);

    const response = await fetch("http://localhost:4000/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    console.log(`📊 Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const data = await response.json();
      console.log("✅ Connexion réussie!");
      console.log("\n📋 Données utilisateur:");
      console.log(JSON.stringify(data, null, 2));
    } else {
      const error = await response.text();
      console.log("❌ Erreur de connexion:");
      console.log(error);
    }
  } catch (error) {
    console.error("❌ Erreur:", error.message);
    console.log("\n💡 Vérifiez que le backend est démarré sur le port 4000");
  }
}

testApiLogin();
