const crypto = require("crypto");

const verifyMetaSignature = (req, res, next) => {
  const signature = req.headers["x-hub-signature-256"];
  const appSecret = process.env.META_APP_SECRET;

  if (!signature || !appSecret) {
    return res.status(401).json({ error: "Signature Meta manquante." });
  }

  const hmac = crypto.createHmac("sha256", appSecret);
  hmac.update(req.rawBody || "");
  const expected = `sha256=${hmac.digest("hex")}`;

  if (expected !== signature) {
    return res.status(401).json({ error: "Signature Meta invalide." });
  }

  return next();
};

module.exports = { verifyMetaSignature };
