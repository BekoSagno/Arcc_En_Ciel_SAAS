const { getEmbeddings } = require("./googleAiService");

const embedTexts = async (texts = []) => {
  if (!texts.length) {
    return [];
  }
  const vectors = await Promise.all(texts.map((text) => getEmbeddings(text)));
  return vectors;
};

module.exports = { embedTexts };
