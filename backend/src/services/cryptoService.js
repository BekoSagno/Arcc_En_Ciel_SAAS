const crypto = require("crypto");

const ALGO = "aes-256-gcm";
// Derive a 256-bit key from the secret; ensure META_TOKENS_SECRET is set.
const KEY = crypto
  .createHash("sha256")
  .update(process.env.META_TOKENS_SECRET || "")
  .digest();

function encryptToken(plain) {
  if (!plain) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function decryptToken(stored) {
  if (!stored) return null;
  const buf = Buffer.from(stored, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

module.exports = { encryptToken, decryptToken };
