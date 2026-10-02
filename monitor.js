const https = require('https');
const fs = require('fs');

const BOT_TOKEN = "8821796664:AAEghVepErTFj8iUcRDzdHZjAgCyDfcJjPM";
const CHAT_ID = "1737260357";
const WHATSAPP_PHONE = "447508903111";
const WHATSAPP_APIKEY = "2884665";

function sendTelegram(text) {
  const data = JSON.stringify({ chat_id: CHAT_ID, text: text, parse_mode: "Markdown" });
  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
  }, res => { res.on('data', ()=>{}); });
  req.write(data);
  req.end();
}

function sendWhatsApp(text) {
  const encodedText = encodeURIComponent(text.substring(0, 500));
  const path = `/whatsapp.php?phone=${WHATSAPP_PHONE}&text=${encodedText}&apikey=${WHATSAPP_APIKEY}`;

  https.get({ hostname: 'api.callmebot.com', path: path }, res => {
    let d=''; res.on('data', c=>d+=c); res.on('end', ()=>console.log("WhatsApp:", d));
  }).on('error', e=>console.log("WA error:", e.message));
}

function sendCall(text) {
  const encodedText = encodeURIComponent(text.substring(0, 150));
  const path = `/call.php?phone=${WHATSAPP_PHONE}&text=${encodedText}&apikey=${WHATSAPP_APIKEY}&language=en-GB-EN`;

  https.get({ hostname: 'api.callmebot.com', path: path }, res => {
    let d=''; res.on('data', c=>d+=c); res.on('end', ()=>console.log("Call:", d));
  }).on('error', e=>console.log("Call error:", e.message));
}

function fetchViaProxy(url, cb) {
  https.get({
    hostname: 'api.allorigins.win',
    path: `/raw?url=${encodeURIComponent(url)}`,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  }, res => {
    let b=''; res.on('data', d=>b+=d); res.on('end', ()=>cb(null,b));
  }).on('error', e=>cb(e));
}

const target = 'https://www.pokemoncenter.com/en-gb/collections/new-arrivals';

fetchViaProxy(target, (err, body) => {
  if (err) { console.log(err); return; }
  console.log("Page length:", body.length);

  const links = [...body.matchAll(/\/products\/([a-z0-9-]+)/g)];
  const handles = [...new Set(links.map(m => m[1]))].slice(0,5);

  if (handles.length === 0) {
    sendTelegram(`⚠️ No products found - site changed?`);
    return;
  }

  console.log("Found:", handles);

  // For testing - always send
  const msg = `✅ Pokemon Bot ONLINE\nLatest: ${handles[0]}\nhttps://www.pokemoncenter.com/en-gb/products/${handles[0]}\nFound ${handles.length} products`;

  sendTelegram(msg);
  sendWhatsApp(msg);
  // Uncomment next line if you want it to CALL you on every check (might be spammy)
  // sendCall(`New Pokemon Center drop: ${handles[0].replace(/-/g, ' ')}`);
});
