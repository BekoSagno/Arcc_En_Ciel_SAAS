require("dotenv").config();

const { Worker } = require("bullmq");
const { isRedisEnabled } = require("./queues/messageQueue");
const { sendUtilityIfNeeded } = require("./services/messagingService");

const connection = {
  url: process.env.REDIS_URL || "redis://localhost:6379",
};

if (!isRedisEnabled) {
  // eslint-disable-next-line no-console
  console.log("Redis desactive, reminder worker arrete.");
  process.exit(0);
}

const worker = new Worker(
  "utility-reminders",
  async (job) => {
    const result = await sendUtilityIfNeeded({
      conversationId: job.data.conversationId,
    });
    if (result.sent) {
      const { prisma } = require("./services/prisma");
      await prisma.conversation.update({
        where: { id: job.data.conversationId },
        data: { nextReminderAt: null },
      });
    }
    return result;
  },
  { connection, concurrency: 2 }
);

worker.on("completed", (job, result) => {
  // eslint-disable-next-line no-console
  console.log("Reminder job completed", job.id, result);
});

worker.on("failed", (job, err) => {
  // eslint-disable-next-line no-console
  console.error("Reminder job failed", job?.id, err);
});
