const extractMetaWhatsAppMessageId = (payload = {}) => {
  // Meta WhatsApp webhook structure
  const entry = payload.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;
  const message = value?.messages?.[0];
  return message?.id || value?.statuses?.[0]?.id || null;
};

const extractMetaWhatsAppThreadId = (payload = {}) => {
  // Meta WhatsApp webhook structure - le numéro du client
  const entry = payload.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;
  const contacts = value?.contacts?.[0];
  const messages = value?.messages?.[0];
  return contacts?.wa_id || messages?.from || value?.statuses?.[0]?.recipient_id || null;
};

const extractMetaMessageId = (payload = {}) => {
  const entry = payload.entry?.[0];
  const messaging = entry?.messaging?.[0];
  return messaging?.message?.mid || messaging?.delivery?.mids?.[0] || null;
};

const extractMetaThreadId = (payload = {}) => {
  const entry = payload.entry?.[0];
  const messaging = entry?.messaging?.[0];
  return messaging?.sender?.id || null;
};

module.exports = {
  extractMetaWhatsAppMessageId,
  extractMetaWhatsAppThreadId,
  extractMetaMessageId,
  extractMetaThreadId,
};
