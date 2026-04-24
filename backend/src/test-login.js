require("dotenv").config();
const { prisma } = require("./services/prisma");
const { verifyPassword } = require("./utils/password");

async function testLogin() {
  const email = "admin@boutique-arcc-test.com";
  const password = "Admin123!";

  try {
    console.log("🔍 Vérification de l'utilisateur...\n");

    const user = await prisma.user.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (!user) {
      console.log("❌ Utilisateur non trouvé!");
      return;
    }

    console.log("✅ Utilisateur trouvé:");
    console.log(`   - Email: ${user.email}`);
    console.log(`   - Nom: ${user.name}`);
    console.log(`   - Tenant: ${user.tenant.name}`);
    console.log(`   - Statut: ${user.status}`);
    console.log(`   - Mot de passe hashé: ${user.passwordHash ? "Oui" : "Non"}\n`);

    if (!user.passwordHash) {
      console.log("❌ L'utilisateur n'a pas de mot de passe hashé!");
      return;
    }

    console.log("🔐 Test de vérification du mot de passe...");
    const isValid = await verifyPassword(password, user.passwordHash);
    
    if (isValid) {
      console.log("✅ Le mot de passe est correct!\n");
      console.log("📝 Test de connexion via API...");
      
      // Simuler une requête de login
      const testPassword = "Admin123!";
      const testIsValid = await verifyPassword(testPassword, user.passwordHash);
      
      if (testIsValid) {
        console.log("✅ La connexion devrait fonctionner!");
        console.log(`\n📧 Email: ${email}`);
        console.log(`🔑 Mot de passe: ${password}`);
      } else {
        console.log("❌ Le mot de passe ne correspond pas!");
      }
    } else {
      console.log("❌ Le mot de passe est incorrect!");
      console.log("\n💡 Essayez de réinitialiser le mot de passe...");
      
      // Réinitialiser le mot de passe
      const { hashPassword } = require("./utils/password");
      const newHash = await hashPassword(password);
      
      await prisma.user.update({
        where: { email },
        data: { passwordHash: newHash },
      });
      
      console.log("✅ Mot de passe réinitialisé!");
      console.log(`\n📧 Email: ${email}`);
      console.log(`🔑 Mot de passe: ${password}`);
    }

  } catch (error) {
    console.error("❌ Erreur:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testLogin();
