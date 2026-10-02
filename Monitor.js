const https = require('https');

const BOT_TOKEN = "8821796664:AAEghVepErTFj8iUcRDzdHZjAgCyDfcJjPM";
const CHAT_ID = "1737260357";

function sendTelegram(text) {
  const data = JSON.stringify({ chat_id: CHAT_ID, text: text, parse_mode: "Markdown" });
  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  req.write(data);
  req.end();
}

https.get('https://www.pokemoncenter.com/en-gb/collections/new-arrivals/products.json?limit=250', res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    const products = JSON.parse(body).products;
    const latest = products[0];
    console.log(latest.title);
    sendTelegram(`✅ Bot is online!\n\nLatest product on Pokemon Center UK:\n*${latest.title}*\nhttps://www.pokemoncenter.com/en-gb/products/${latest.handle}\n\nIf a new drop happens, you'll get an alert here.`);
  });
});
