const https = require('https');

const BOT_TOKEN = "8821796664:AAEghVepErTFj8iUcRDzdHZjAgCyDfcJjPM";
const CHAT_ID = "1737260357";
const WA_PHONE = "447508903111";
const WA_KEY = "2884665";

function sendTelegram(text) {
  const data = JSON.stringify({ chat_id: CHAT_ID, text: text });
  https.request({
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
  }, () => {}).end(data);
}

function sendWhatsApp(text) {
  const msg = encodeURIComponent(text.substring(0, 700));
  const path = `/whatsapp.php?phone=${WA_PHONE}&text=${msg}&apikey=${WA_KEY}`;
  https.get({ hostname: 'api.callmebot.com', path: path }, res => {
    let b=''; res.on('data', d=>b+=d);
    res.on('end', ()=> console.log("WA Response:", b));
  });
}

function fetchWithTimeout(url, cb) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  
  fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, { 
    signal: controller.signal,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  })
  .then(r => r.text())
  .then(body => { clearTimeout(timeout); cb(null, body); })
  .catch(e => { clearTimeout(timeout); cb(e); });
}

fetchWithTimeout('https://www.pokemoncenter.com/en-gb/collections/new-arrivals', (err, body) => {
  if(err){
    console.log("Fetch failed:", err.message);
    // Send test WhatsApp anyway to prove WhatsApp works
    sendTelegram("Fetch failed but testing WhatsApp");
    sendWhatsApp("✅ WhatsApp test - if you get this, your Pokemon bot WhatsApp is working! Fetch error was: " + err.message);
    return;
  }
  
  console.log("Length:", body.length);
  const matches = [...body.matchAll(/\/products\/([a-z0-9-]+)/g)];
  const products = [...new Set(matches.map(m=>m[1]))];
  
  const latest = products[0] || "test-product";
  const message = `🔥 POKEMON BOT TEST\nLatest: ${latest}\nhttps://www.pokemoncenter.com/en-gb/products/${latest}`;
  
  sendTelegram(message);
  sendWhatsApp(message);
});
