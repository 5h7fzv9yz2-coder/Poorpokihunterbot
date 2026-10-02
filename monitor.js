const https = require('https');

const BOT_TOKEN = "8821796664:AAEghVepErTFj8iUcRDzdHZjAgCyDfcJjPM";
const CHAT_ID = "1737260357";

function sendTelegram(text) {
  const data = JSON.stringify({ chat_id: CHAT_ID, text: text, parse_mode: "Markdown" });
  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
  }, res => { res.on('data', ()=>{}); });
  req.on('error', e => console.log("Telegram error:", e.message));
  req.write(data);
  req.end();
}

const options = {
  hostname: 'www.pokemoncenter.com',
  path: '/en-gb/collections/new-arrivals/products.json?limit=5',
  headers: { 'User-Agent': 'Mozilla/5.0' }
};

https.get(options, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    try {
      const json = JSON.parse(body);
      const latest = json.products[0];
      if (!latest) throw new Error("No products");
      console.log("Found:", latest.title);
      sendTelegram(`✅ Bot is online!\nLatest: *${latest.title}*\nhttps://www.pokemoncenter.com/en-gb/products/${latest.handle}`);
    } catch (e) {
      console.log("Parse error:", e.message, body.slice(0,200));
      sendTelegram(`⚠️ Bot error: ${e.message}`);
    }
  });
}).on('error', e => {
  console.log("Request error:", e.message);
  sendTelegram(`⚠️ Request failed: ${e.message}`);
});
