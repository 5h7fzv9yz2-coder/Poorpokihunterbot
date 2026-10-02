const https = require('https');

const BOT_TOKEN = "8821796664:AAEghVepErTFj8iUcRDzdHZjAgCyDfcJjPM";
const CHAT_ID = "1737260357";
const WA_PHONE = "447508903111";
const WA_KEY = "2884665";

function sendTelegram(text) {
  const data = JSON.stringify({ chat_id: CHAT_ID, text: text });
  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
  }, () => {});
  req.write(data);
  req.end();
}

function sendWhatsApp(text) {
  const msg = encodeURIComponent(text.substring(0, 800));
  const path = `/whatsapp.php?phone=${WA_PHONE}&text=${msg}&apikey=${WA_KEY}`;
  console.log("Sending WhatsApp to", WA_PHONE);
  https.get({ hostname: 'api.callmebot.com', path: path }, res => {
    let b=''; res.on('data', d=>b+=d);
    res.on('end', ()=> {
      console.log("WhatsApp response:", b);
      if(b.includes("Message queued")) console.log("WHATSAPP SUCCESS");
    });
  }).on('error', e=>console.log("WA error", e.message));
}

function fetchPage(url, cb) {
  const proxyPath = `/raw?url=${encodeURIComponent(url)}`;
  https.get({ hostname: 'api.allorigins.win', path: proxyPath, headers: {'User-Agent':'Mozilla/5.0'} }, res => {
    let body=''; res.on('data', d=>body+=d); res.on('end', ()=>cb(null, body));
  }).on('error', e=>cb(e));
}

fetchPage('https://www.pokemoncenter.com/en-gb/collections/new-arrivals', (err, body) => {
  if(err){ console.log(err.message); sendTelegram("Bot error: "+err.message); return; }
  console.log("Page length", body.length);
  
  const matches = [...body.matchAll(/\/products\/([a-z0-9-]+)/g)];
  const products = [...new Set(matches.map(m=>m[1]))];
  console.log("Found", products.slice(0,3));

  if(products.length===0){ sendTelegram("No products found length "+body.length); return; }

  const latest = products[0];
  const message = `🔥 POKEMON CENTER DROP!\n\n${latest}\nhttps://www.pokemoncenter.com/en-gb/products/${latest}\n\nFound ${products.length} items`;

  // Send to BOTH Telegram and WhatsApp
  sendTelegram(message);
  sendWhatsApp(message);
});
