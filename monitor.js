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

function fetchPokemon(callback) {
  const options = {
    hostname: 'www.pokemoncenter.com',
    path: '/en-gb/collections/new-arrivals',
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-GB,en;q=0.9',
      'Cache-Control': 'no-cache'
    }
  };

  https.get(options, res => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => {
      // Try to find product handles in the HTML
      try {
        // Look for product JSON in page
        const match = body.match(/"product"\s*:\s*\{[^}]*"handle"\s*:\s*"([^"]+)"/);
        const titleMatch = body.match(/"title"\s*:\s*"([^"]+)"/);
        
        if (body.includes('products.json')) console.log("Has json link");
        
        // Fallback: find first /products/ link
        const productLinks = [...body.matchAll(/\/en-gb\/products\/([a-z0-9-]+)/g)];
        const handles = [...new Set(productLinks.map(m => m[1]))];
        
        if (handles.length > 0) {
          console.log("Found products:", handles.slice(0,3));
          callback(null, handles[0], handles);
        } else {
          // Check if blocked by cloudflare
          if (body.includes('Attention Required') || body.includes('cf-browser-verification') || body.length < 2000) {
            callback(new Error("Blocked by Cloudflare protection - " + body.slice(0,100)));
          } else {
            callback(new Error("No products found in HTML. Length:" + body.length));
          }
        }
      } catch (e) {
        callback(e);
      }
    });
  }).on('error', e => callback(e));
}

fetchPokemon((err, latestHandle, all) => {
  if (err) {
    console.log("Error:", err.message);
    sendTelegram(`⚠️ Bot check failed: ${err.message}`);
    return;
  }
  console.log("Latest:", latestHandle);
  sendTelegram(`✅ Bot is working!\nLatest product: ${latestHandle}\nhttps://www.pokemoncenter.com/en-gb/products/${latestHandle}\n\nFound ${all.length} products`);
});
