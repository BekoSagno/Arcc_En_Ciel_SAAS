require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { hashPassword } = require("../utils/password");

const prisma = new PrismaClient();

async function setUserPassword() {
  const email = process.argv[2];
  const plainPassword = process.argv[3];

  if (!email || !plainPassword) {
    console.log("\n🛠  Utilisation :");
    console.log("  node src/scripts/set_user_password.js <email> <nouveau_mot_de_passe>\n");
    process.exit(1);
  }

  try {
    console.log(`\n🔍 Recherche de l'utilisateur: ${email}`);
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      console.error("❌ Utilisateur introuvable.");
      process.exit(1);
    }

    const passwordHash = await hashPassword(plainPassword);

    await prisma.user.update({
      where: { email },
      data: { passwordHash },
    });

    console.log("✅ Mot de passe mis à jour avec succès.\n");
    console.log("Identifiants à utiliser dans le dashboard :");
    console.log(`  Email : ${email}`);
    console.log(`  Mot de passe : ${plainPassword}\n`);
  } catch (error) {
    console.error("❌ Erreur lors de la mise à jour du mot de passe :", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setUserPassword();
