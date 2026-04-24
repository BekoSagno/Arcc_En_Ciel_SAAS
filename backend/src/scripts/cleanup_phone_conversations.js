require("dotenv").config();
const { prisma } = require("../services/prisma");
const { cleanupOldConversationsForPhoneNumber } = require("../services/messageProcessor");

/**
 * Script pour nettoyer manuellement les anciennes conversations d'un numéro de téléphone
 * Usage: node src/scripts/cleanup_phone_conversations.js <phone_number> <tenant_identifier>
 * 
 * Le tenant peut être identifié par:
 * - UUID du tenant (ex: e1916a0f-8464-4e3a-8cb7-636c9b12d860)
 * - Email d'un utilisateur du tenant (ex: user@example.com)
 * - Nom du tenant (ex: "Boutique Arcc Test")
 * 
 * Exemples:
 *   node src/scripts/cleanup_phone_conversations.js "+224623858991" "e1916a0f-8464-4e3a-8cb7-636c9b12d860"
 *   node src/scripts/cleanup_phone_conversations.js "+224623858991" "user@example.com"
 *   node src/scripts/cleanup_phone_conversations.js "+224623858991" "Boutique Arcc Test"
 */

const phoneNumber = process.argv[2];
const tenantIdentifier = process.argv[3];

/**
 * Trouve un tenant par UUID, email ou nom
 */
async function findTenant(identifier) {
  if (!identifier) return null;

  // Essayer par UUID d'abord
  if (identifier.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: identifier },
      select: { id: true, name: true, companyName: true },
    });
    if (tenant) return tenant;
  }

  // Essayer par email (chercher l'utilisateur puis son tenant)
  if (identifier.includes("@")) {
    const user = await prisma.user.findUnique({
      where: { email: identifier.toLowerCase().trim() },
      include: {
        tenant: {
          select: { id: true, name: true, companyName: true },
        },
      },
    });
    if (user?.tenant) return user.tenant;
  }

  // Essayer par nom du tenant
  const tenant = await prisma.tenant.findUnique({
    where: { name: identifier },
    select: { id: true, name: true, companyName: true },
  });
  if (tenant) return tenant;

  return null;
}

async function cleanup() {
  console.log("=".repeat(80));
  console.log("🧹 NETTOYAGE DES ANCIENNES CONVERSATIONS D'UN NUMÉRO");
  console.log("=".repeat(80));
  console.log("");

  if (!phoneNumber || !tenantIdentifier) {
    console.error("❌ Usage: node src/scripts/cleanup_phone_conversations.js <phone_number> <tenant_identifier>");
    console.error("");
    console.error("Le tenant peut être identifié par:");
    console.error("  - UUID du tenant (ex: e1916a0f-8464-4e3a-8cb7-636c9b12d860)");
    console.error("  - Email d'un utilisateur (ex: user@example.com)");
    console.error("  - Nom du tenant (ex: \"Boutique Arcc Test\")");
    console.error("");
    console.error("Exemples:");
    console.error('  node src/scripts/cleanup_phone_conversations.js "+224623858991" "e1916a0f-8464-4e3a-8cb7-636c9b12d860"');
    console.error('  node src/scripts/cleanup_phone_conversations.js "+224623858991" "user@example.com"');
    console.error('  node src/scripts/cleanup_phone_conversations.js "+224623858991" "Boutique Arcc Test"');
    process.exit(1);
  }

  // Normaliser le numéro
  let normalizedPhone = phoneNumber.trim().replace(/\s+/g, "");
  if (!normalizedPhone.startsWith("+")) {
    normalizedPhone = "+" + normalizedPhone;
  }

  console.log("📋 PARAMÈTRES:");
  console.log(`   Numéro: ${normalizedPhone}`);
  console.log(`   Identifiant tenant: ${tenantIdentifier}`);
  console.log("");

  // Chercher le tenant
  console.log("🔍 Recherche du tenant...");
  const tenant = await findTenant(tenantIdentifier);

  if (!tenant) {
    console.error(`❌ Tenant introuvable avec l'identifiant: ${tenantIdentifier}`);
    console.error("");
    console.error("Vérifie que:");
    console.error("  - L'UUID est correct (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)");
    console.error("  - L'email existe dans la base de données");
    console.error("  - Le nom du tenant est exact (sensible à la casse)");
    process.exit(1);
  }

  const currentTenantId = tenant.id;

  console.log(`✅ Tenant trouvé: ${tenant.name}${tenant.companyName ? ` (${tenant.companyName})` : ""}`);
  console.log(`   ID: ${tenant.id}`);
  console.log("");

  // Lister toutes les conversations de ce numéro
  const allConversations = await prisma.conversation.findMany({
    where: {
      externalThreadId: normalizedPhone,
      channel: "WHATSAPP",
    },
    include: {
      tenant: {
        select: {
          id: true,
          name: true,
          companyName: true,
        },
      },
      _count: {
        select: {
          messages: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  console.log(`📊 CONVERSATIONS TROUVÉES: ${allConversations.length}`);
  console.log("");

  if (allConversations.length === 0) {
    console.log("✅ Aucune conversation trouvée pour ce numéro");
    process.exit(0);
  }

  // Séparer les conversations du tenant actuel et des autres tenants
  const currentTenantConversations = allConversations.filter(c => c.tenantId === currentTenantId);
  const otherTenantConversations = allConversations.filter(c => c.tenantId !== currentTenantId);

  console.log(`   Conversations du tenant actuel (${tenant.name}): ${currentTenantConversations.length}`);
  console.log(`   Conversations d'autres tenants: ${otherTenantConversations.length}`);
  console.log("");

  if (otherTenantConversations.length === 0) {
    console.log("✅ Aucune ancienne conversation à nettoyer");
    process.exit(0);
  }

  console.log("📋 CONVERSATIONS À SUPPRIMER:");
  for (const conv of otherTenantConversations) {
    console.log(`   - Conversation ${conv.id}`);
    console.log(`     Tenant: ${conv.tenant.name}${conv.tenant.companyName ? ` (${conv.tenant.companyName})` : ""}`);
    console.log(`     Messages: ${conv._count.messages}`);
    console.log(`     Statut: ${conv.status}`);
    console.log(`     Créée: ${conv.createdAt.toISOString()}`);
    console.log("");
  }

  // Demander confirmation
  console.log("⚠️ ATTENTION: Cette action est irréversible !");
  console.log(`   ${otherTenantConversations.length} conversation(s) et leurs messages seront supprimés.`);
  console.log("");
  console.log("Pour confirmer, relance le script avec l'option --confirm:");
  console.log(`  node src/scripts/cleanup_phone_conversations.js "${normalizedPhone}" "${tenantIdentifier}" --confirm`);
  console.log("");

  if (process.argv[4] !== "--confirm") {
    console.log("❌ Action annulée (ajoute --confirm pour confirmer)");
    process.exit(0);
  }

  // Effectuer le nettoyage
  console.log("🧹 Début du nettoyage...");
  await cleanupOldConversationsForPhoneNumber(normalizedPhone, currentTenantId, "WHATSAPP");

  console.log("");
  console.log("=".repeat(80));
  console.log("✅ NETTOYAGE TERMINÉ");
  console.log("=".repeat(80));
}

cleanup()
  .catch((error) => {
    console.error("❌ Erreur:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
