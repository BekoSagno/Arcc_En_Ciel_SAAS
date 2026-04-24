const { PrismaClient } = require("@prisma/client");
const { hashPassword } = require("./utils/password");

const prisma = new PrismaClient();

async function setupSuperAdmin() {
  try {
    const email = process.env.SUPERADMIN_EMAIL || "amedbekosagno989@arccenciel.com";
    const password = process.env.SUPERADMIN_PASSWORD || "Amed@2026";
    const name = process.env.SUPERADMIN_NAME || "Super Admin";

    console.log(`[SETUP] Création du compte Super Admin: ${email}`);

    // Créer ou trouver un tenant système pour le super admin
    // Note: Le super admin n'a pas besoin d'un tenant réel, mais le schéma l'exige
    // On crée un tenant système spécial
    const systemTenant = await prisma.tenant.upsert({
      where: { name: "SYSTEM" },
      create: {
        name: "SYSTEM",
        status: "active",
        timezone: "UTC",
      },
      update: {},
    });

    console.log(`[SETUP] Tenant système trouvé/créé: ${systemTenant.id}`);

    // Créer ou mettre à jour le super admin
    const passwordHash = await hashPassword(password);

    const superAdmin = await prisma.user.upsert({
      where: { email },
      create: {
        email,
        name,
        role: "SUPERADMIN",
        passwordHash,
        tenantId: systemTenant.id,
        status: "active",
      },
      update: {
        name,
        role: "SUPERADMIN",
        passwordHash,
        status: "active",
      },
    });

    console.log(`[SETUP] ✅ Super Admin créé/mis à jour avec succès!`);
    console.log(`[SETUP] Email: ${superAdmin.email}`);
    console.log(`[SETUP] Rôle: ${superAdmin.role}`);
    console.log(`[SETUP] ID: ${superAdmin.id}`);
    console.log(`[SETUP] Tenant ID: ${superAdmin.tenantId}`);

    return superAdmin;
  } catch (error) {
    console.error("[SETUP] ❌ Erreur lors de la création du Super Admin:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  setupSuperAdmin()
    .then(() => {
      console.log("[SETUP] ✅ Configuration terminée");
      process.exit(0);
    })
    .catch((error) => {
      console.error("[SETUP] ❌ Erreur:", error);
      process.exit(1);
    });
}

module.exports = { setupSuperAdmin };
