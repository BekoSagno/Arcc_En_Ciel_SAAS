require("dotenv").config();

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const oldEmail = process.argv[2];
  const newEmail = process.argv[3];

  if (!oldEmail || !newEmail) {
    console.log("\nUsage:");
    console.log("  node src/scripts/update_user_email.js <ancien_email> <nouvel_email>\n");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email: oldEmail },
  });

  if (!user) {
    console.log(`❌ Aucun utilisateur trouvé avec l'email ${oldEmail}`);
    return;
  }

  const updated = await prisma.user.update({
    where: { email: oldEmail },
    data: { email: newEmail },
  });

  console.log("✅ Email utilisateur mis à jour :");
  console.log(`   Ancien: ${oldEmail}`);
  console.log(`   Nouveau: ${updated.email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

