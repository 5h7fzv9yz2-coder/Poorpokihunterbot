const https = require('https');

const BOT_TOKEN = process.env.BOT_TOKEN || "8821796664:AAEghVepErTFj8iUcRDzdHZjAgCyDfcJjPM";
const CHAT_ID = process.env.CHAT_ID || "1737260357";

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

function fetchViaProxy(url, callback) {
  // Use allorigins proxy to bypass Cloudflare
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
  const options = {
    hostname: 'api.allorigins.win',
    path: `/raw?url=${encodeURIComponent(url)}`,
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  };

  console.log("Fetching via proxy:", url);
  https.get(options, res => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => callback(null, body));
  }).on('error', e => callback(e));
}

const target = 'https://www.pokemoncenter.com/en-gb/collections/new-arrivals';

fetchViaProxy(target, (err, body) => {
  if (err) {
    console.log("Proxy error:", err.message);
    sendTelegram(`⚠️ Proxy failed: ${err.message}`);
    return;
  }

  console.log("Got page length:", body.length);

  if (body.includes('ROBOTS') && body.length < 2000) {
    console.log("Still blocked");
    sendTelegram(`⚠️ Still blocked by Cloudflare even via proxy. Trying US site...`);

    // Try US site as fallback
    fetchViaProxy('https://www.pokemoncenter.com/collections/new-arrivals', (err2, body2) => {
      if (err2) { sendTelegram(`❌ Both sites blocked: ${err2.message}`); return; }
      parseAndSend(body2);
    });
    return;
  }

  parseAndSend(body);
});

function parseAndSend(body) {
  try {
    const links = [...body.matchAll(/\/products\/([a-z0-9-]+)/g)];
    const handles = [...new Set(links.map(m => m[1]))];
    console.log("Found:", handles.slice(0,5));

    if (handles.length === 0) {
      sendTelegram(`⚠️ No products found. Page length ${body.length}. Site may have changed layout.`);
      return;
    }

    const latest = handles[0];
    sendTelegram(`✅ Bot is working!\nBypassed Cloudflare!\nLatest: ${latest}\nhttps://www.pokemoncenter.com/en-gb/products/${latest}\nTotal found: ${handles.length}`);
  } catch (e) {
    sendTelegram(`⚠️ Parse error: ${e.message}`);
  }
}
