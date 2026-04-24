const express = require('express');
const app = express();
app.use(express.json());

const VERIFY_TOKEN = "arcc-meta-verify"; // Doit correspondre à votre .env

// 🟢 Route GET : Meta l'utilise une seule fois pour valider votre URL
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook validé par Meta !');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// 🔵 Route POST : C'est ici que l'IA recevra les messages des clients
app.post('/webhook', (req, res) => {
  const body = req.body;
  console.log('📩 Nouveau message reçu :', JSON.stringify(body, null, 2));
  
  // Important : Toujours répondre 200 OK rapidement à Meta
  res.status(200).send('EVENT_RECEIVED');
});

app.listen(4000, () => console.log('🚀 Serveur Arcc En Ciel écoute sur le port 4000'));