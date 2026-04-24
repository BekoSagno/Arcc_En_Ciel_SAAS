const nodemailer = require("nodemailer");

const getTransporter = () => {
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER || "";
  const smtpPass = process.env.SMTP_PASS || "";

  if (!smtpUser || !smtpPass) {
    console.warn("SMTP non configuré, emails désactivés.");
    return null;
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
};

const sendOTPEmail = async ({ email, code, tenantName }) => {
  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[EMAIL MOCK] Code OTP pour ${email}: ${code}`);
    return { sent: true, mock: true };
  }

  try {
    await transporter.sendMail({
      from: `"Arcc En Ciel" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Code de vérification - ${tenantName || "Arcc En Ciel"}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #020617; color: #fff;">
          <h2 style="color: #818cf8; margin-bottom: 20px;">Bienvenue sur Arcc En Ciel !</h2>
          <p style="color: #cbd5e1; line-height: 1.6;">
            Votre code de vérification pour accéder à votre dashboard <strong>${tenantName || ""}</strong> est :
          </p>
          <div style="background: #0b101d; border: 2px solid #818cf8; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #818cf8;">
              ${code}
            </div>
          </div>
          <p style="color: #94a3b8; font-size: 14px; margin-top: 24px;">
            Ce code expire dans 10 minutes. Si vous n'avez pas demandé ce code, ignorez cet email.
          </p>
        </div>
      `,
    });
    return { sent: true, mock: false };
  } catch (error) {
    console.error("Erreur envoi email:", error.message);
    return { sent: false, error: error.message };
  }
};

module.exports = { sendOTPEmail };

/**
 * Envoi d'un email générique HTML.
 */
async function sendCustomEmail({ to, subject, html, text }) {
  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[EMAIL MOCK] ${subject} -> ${to}`);
    return { sent: true, mock: true };
  }

  try {
    await transporter.sendMail({
      from: `"Arcc En Ciel" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });
    return { sent: true, mock: false };
  } catch (error) {
    console.error("Erreur envoi email:", error.message);
    return { sent: false, error: error.message };
  }
}

module.exports = { sendOTPEmail, sendCustomEmail };