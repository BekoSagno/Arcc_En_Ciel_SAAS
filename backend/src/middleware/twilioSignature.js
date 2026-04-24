const crypto = require("crypto");

const verifyTwilioSignature = (req, res, next) => {
  // En environnement de développement, on peut désactiver la vérification
  // de la signature pour faciliter les tests avec ngrok.
  const isDev =
    process.env.NODE_ENV !== "production" ||
    process.env.TWILIO_DISABLE_SIGNATURE === "true";

  if (isDev) {
    // On log quand même pour savoir qu'on ne vérifie pas la signature.
    console.log(
      "[TWILIO] Vérification de signature désactivée (mode développement)"
    );
    return next();
  }

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = req.headers["x-twilio-signature"];

  if (!authToken || !signature) {
    return res.status(401).json({ error: "Signature Twilio manquante." });
  }

  const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  const params = req.body || {};

  const sortedKeys = Object.keys(params).sort();
  const data =
    url + sortedKeys.map((key) => `${key}${params[key]}`).join("");

  const expected = crypto
    .createHmac("sha1", authToken)
    .update(Buffer.from(data, "utf-8"))
    .digest("base64");

  if (expected !== signature) {
    return res.status(401).json({ error: "Signature Twilio invalide." });
  }

  return next();
};

module.exports = { verifyTwilioSignature };
