const { Queue } = require("bullmq");

const isRedisEnabled = process.env.REDIS_ENABLED !== "false";
const connection = {
  url: process.env.REDIS_URL || "redis://localhost:6379",
};

const createDisabledQueue = () => ({
  async add() {
    return { skipped: true, reason: "redis_disabled" };
  },
});

const messageQueue = isRedisEnabled
  ? new Queue("incoming-messages", { connection })
  : createDisabledQueue();

module.exports = { messageQueue, isRedisEnabled };
