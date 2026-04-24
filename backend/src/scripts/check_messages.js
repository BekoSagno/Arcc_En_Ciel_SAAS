require("dotenv").config();
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function checkMessages() {
  const conversationId = process.argv[2] || "493ba0a4-344e-4eac-96fc-252515adfd61";
  
  console.log(`\n🔍 Vérification des messages de la conversation: ${conversationId}\n`);
  
  try {
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        tenant: {
          select: { name: true, id: true },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          select: { 
            id: true,
            direction: true, 
            body: true, 
            createdAt: true 
          },
        },
      },
    });
    
    if (!conv) {
      console.log("❌ Conversation introuvable.\n");
      return;
    }
    
    console.log(`📊 Conversation trouvée:`);
    console.log(`   ID: ${conv.id}`);
    console.log(`   Tenant: ${conv.tenant.name} (${conv.tenant.id})`);
    console.log(`   Customer Handle: ${conv.customerHandle}`);
    console.log(`   Messages: ${conv.messages.length}\n`);
    
    console.log(`📝 Messages (du plus ancien au plus récent):\n`);
    conv.messages.forEach((m, i) => {
      const preview = m.body.length > 100 ? m.body.substring(0, 100) + "..." : m.body;
      console.log(`${i + 1}. [${m.direction}] ${preview}`);
      console.log(`   Date: ${m.createdAt.toLocaleString()}`);
      console.log("");
    });
    
    // Vérifier s'il y a des références au coworking
    const coworkingMessages = conv.messages.filter(m => 
      m.body.toLowerCase().includes("coworking") || 
      m.body.toLowerCase().includes("bureau") ||
      m.body.toLowerCase().includes("espace")
    );
    
    if (coworkingMessages.length > 0) {
      console.log(`⚠️  ${coworkingMessages.length} message(s) contiennent des références au coworking/bureaux:\n`);
      coworkingMessages.forEach((m, i) => {
        console.log(`   ${i + 1}. [${m.direction}] ${m.body.substring(0, 150)}...`);
      });
    }
    
  } catch (error) {
    console.error("❌ Erreur:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkMessages();
