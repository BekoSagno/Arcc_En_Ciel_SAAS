require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

/**
 * Nettoie les conversations d'un numéro de téléphone pour un tenant spécifique
 * Utile quand un numéro change de tenant (migration de mapping)
 */
async function cleanConversations() {
  const phoneNumber = process.argv[2];
  const tenantIdOrEmail = process.argv[3];

  if (!phoneNumber || !tenantIdOrEmail) {
    console.log("\n🧹 Nettoyage des conversations d'un numéro\n");
    console.log("Usage:");
    console.log("  node clean_conversations.js <phone> <tenant_id|email>");
    console.log("\nExemples:");
    console.log("  node clean_conversations.js +224623858991 charles04@gmail.com");
    console.log("  node clean_conversations.js +224623858991 40cc2abb-3bbc-48b9-b295-ae889e225fed");
    console.log("\n⚠️  ATTENTION: Ce script supprime TOUTES les conversations du numéro pour le tenant spécifié.");
    console.log("   Les messages associés seront également supprimés (cascade).\n");
    process.exit(0);
  }

  // Normaliser le numéro (garder les deux variantes : avec et sans +)
  let normalizedPhone = phoneNumber.trim().replace(/\s+/g, "");
  const phoneWithPlus = normalizedPhone.startsWith("+") ? normalizedPhone : "+" + normalizedPhone;
  const phoneWithoutPlus = normalizedPhone.startsWith("+") ? normalizedPhone.substring(1) : normalizedPhone;

  // Résoudre le tenant
  let tenant;
  if (tenantIdOrEmail.includes("@")) {
    const user = await prisma.user.findUnique({
      where: { email: tenantIdOrEmail },
      include: { tenant: true },
    });
    if (!user) {
      console.error(`❌ Utilisateur avec l'email "${tenantIdOrEmail}" introuvable.`);
      process.exit(1);
    }
    tenant = user.tenant;
  } else {
    tenant = await prisma.tenant.findUnique({
      where: { id: tenantIdOrEmail },
    });
    if (!tenant) {
      console.error(`❌ Tenant avec l'ID "${tenantIdOrEmail}" introuvable.`);
      process.exit(1);
    }
  }

  console.log(`\n🔍 Recherche des conversations pour:`);
  console.log(`   Numéro: ${phoneWithPlus} (ou ${phoneWithoutPlus})`);
  console.log(`   Tenant: ${tenant.name} (${tenant.id})\n`);

  try {
    // Trouver toutes les conversations avec ce customerHandle pour ce tenant (avec ou sans +)
    const conversations = await prisma.conversation.findMany({
      where: {
        tenantId: tenant.id,
        OR: [
          { customerHandle: phoneWithPlus },
          { customerHandle: phoneWithoutPlus },
        ],
      },
      include: {
        messages: {
          select: { id: true },
        },
      },
    });

    if (conversations.length === 0) {
      console.log(`✅ Aucune conversation trouvée pour ce numéro et ce tenant.\n`);
      return;
    }

    console.log(`📊 ${conversations.length} conversation(s) trouvée(s):\n`);
    conversations.forEach((conv, idx) => {
      console.log(`   ${idx + 1}. Conversation ${conv.id}`);
      console.log(`      Channel: ${conv.channel}`);
      console.log(`      Status: ${conv.status}`);
      console.log(`      Messages: ${conv.messages.length}`);
      console.log(`      Créée le: ${conv.createdAt.toLocaleString()}`);
      console.log("");
    });

    // Demander confirmation (en mode non-interactif, on supprime directement)
    console.log(`⚠️  Suppression de ${conversations.length} conversation(s) et de leurs messages...\n`);

    let deletedMessages = 0;
    let deletedConversations = 0;

    for (const conv of conversations) {
      // Supprimer les messages (cascade devrait le faire automatiquement, mais on le fait explicitement)
      const messageCount = await prisma.message.deleteMany({
        where: { conversationId: conv.id },
      });
      deletedMessages += messageCount.count;

      // Supprimer la conversation
      await prisma.conversation.delete({
        where: { id: conv.id },
      });
      deletedConversations++;
    }

    console.log(`✅ Nettoyage terminé:`);
    console.log(`   ${deletedConversations} conversation(s) supprimée(s)`);
    console.log(`   ${deletedMessages} message(s) supprimé(s)`);
    console.log(`\n💡 Les nouvelles conversations avec ce numéro utiliseront le tenant correct.\n`);

  } catch (error) {
    console.error("❌ Erreur lors du nettoyage:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanConversations();
