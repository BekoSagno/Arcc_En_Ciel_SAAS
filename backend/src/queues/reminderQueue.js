const { Queue } = require("bullmq");

const connection = {
  url: process.env.REDIS_URL || "redis://localhost:6379",
};

const reminderQueue = new Queue("utility-reminders", { connection });

module.exports = { reminderQueue };
