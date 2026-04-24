require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function deleteAllOutbound() {
  const conversationId = process.argv[2] || "493ba0a4-344e-4eac-96fc-252515adfd61";
  
  console.log(`\n🗑️  Suppression de TOUS les messages OUTBOUND de la conversation\n`);
  console.log(`   Conversation: ${conversationId}\n`);
  
  try {
    // Trouver tous les messages OUTBOUND
    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        direction: "OUTBOUND",
      },
      select: { id: true, body: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    
    if (messages.length === 0) {
      console.log("✅ Aucun message OUTBOUND à supprimer.\n");
      return;
    }
    
    console.log(`📊 ${messages.length} message(s) OUTBOUND à supprimer:\n`);
    messages.forEach((m, i) => {
      const preview = m.body.length > 150 ? m.body.substring(0, 150) + "..." : m.body;
      console.log(`${i + 1}. [${m.createdAt.toLocaleString()}] ${preview}\n`);
    });
    
    console.log(`⚠️  Suppression de ${messages.length} message(s) OUTBOUND...\n`);
    
    // Supprimer les messages
    const result = await prisma.message.deleteMany({
      where: {
        id: { in: messages.map(m => m.id) },
      },
    });
    
    console.log(`✅ ${result.count} message(s) OUTBOUND supprimé(s).\n`);
    console.log(`💡 Seuls les messages INBOUND du client sont conservés.\n`);
    console.log(`💡 La prochaine fois que le client enverra un message, l'IA repartira sur une base propre.\n`);
    
  } catch (error) {
    console.error("❌ Erreur:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAllOutbound();
