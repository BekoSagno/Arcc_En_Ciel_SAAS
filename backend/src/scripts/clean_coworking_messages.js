require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function cleanCoworkingMessages() {
  const conversationId = process.argv[2] || "493ba0a4-344e-4eac-96fc-252515adfd61";
  
  console.log(`\n🧹 Nettoyage des messages contenant des références au coworking/bureaux\n`);
  console.log(`   Conversation: ${conversationId}\n`);
  
  try {
    // Trouver tous les messages OUTBOUND qui mentionnent le coworking/bureaux
    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        direction: "OUTBOUND",
        OR: [
          { body: { contains: "coworking", mode: "insensitive" } },
          { body: { contains: "bureau privé", mode: "insensitive" } },
          { body: { contains: "espace disponible", mode: "insensitive" } },
          { body: { contains: "espace de co", mode: "insensitive" } },
          { body: { contains: "bureau pour votre équipe", mode: "insensitive" } },
        ],
      },
      select: { id: true, body: true, createdAt: true },
    });
    
    if (messages.length === 0) {
      console.log("✅ Aucun message à supprimer.\n");
      return;
    }
    
    console.log(`📊 ${messages.length} message(s) à supprimer:\n`);
    messages.forEach((m, i) => {
      const preview = m.body.length > 150 ? m.body.substring(0, 150) + "..." : m.body;
      console.log(`${i + 1}. [${m.createdAt.toLocaleString()}] ${preview}\n`);
    });
    
    console.log(`⚠️  Suppression de ${messages.length} message(s)...\n`);
    
    // Supprimer les messages
    const result = await prisma.message.deleteMany({
      where: {
        id: { in: messages.map(m => m.id) },
      },
    });
    
    console.log(`✅ ${result.count} message(s) supprimé(s).\n`);
    console.log(`💡 La prochaine fois que le client enverra un message, l'IA n'aura plus ces références dans l'historique.\n`);
    
  } catch (error) {
    console.error("❌ Erreur:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

cleanCoworkingMessages();
