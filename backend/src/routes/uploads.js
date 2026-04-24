const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const { resolveTenantId } = require("../services/tenantContext");

const router = express.Router();

// Répertoire de stockage local des images d'annonces
const uploadsRoot = path.join(__dirname, "..", "..", "uploads");
const imagesDir = path.join(uploadsRoot, "images");

// S'assurer que le dossier existe
fs.mkdirSync(imagesDir, { recursive: true });

// Configuration Multer pour stockage disque
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, imagesDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    const baseName = path.basename(file.originalname, ext).slice(0, 40);
    const safeBase = baseName.replace(/[^a-z0-9-_]/gi, "_") || "image";
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${safeBase}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 8 * 1024 * 1024, // 8 Mo par image
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Seuls les fichiers image sont autorisés."));
    }
  },
});

/**
 * POST /api/uploads/images
 * Upload multiple d'images locales pour les annonces.
 * Retourne une liste d'URLs publiques que l'on peut utiliser dans mediaUrls.
 */
router.post("/uploads/images", upload.array("files", 10), async (req, res, next) => {
  try {
    const tenantId = await resolveTenantId(req);
    if (!tenantId) {
      return res.status(400).json({ error: "Tenant introuvable." });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "Aucune image reçue." });
    }

    const baseUrl =
      process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`;

    const urls = req.files.map((file) => {
      return `${baseUrl}/uploads/images/${file.filename}`;
    });

    // On retourne simplement les URLs; pas besoin d'enregistrer en base ici
    return res.status(200).json({
      data: {
        tenantId,
        urls,
      },
    });
  } catch (error) {
    console.error("[UPLOADS] Erreur upload images:", error);
    return next(error);
  }
});

module.exports = router;

