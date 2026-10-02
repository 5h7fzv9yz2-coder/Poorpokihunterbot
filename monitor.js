const https = require('https');
const fs = require('fs');

const BOT_TOKEN = "8821796664:AAEghVepErTFj8iUcRDzdHZjAgCyDfcJjPM";
const CHAT_ID = "1737260357";
const WA_PHONE = "447508903111";
const WA_KEY = "2884665";
const FILE = "last_product.txt";

function sendTelegram(text) {
  const data = JSON.stringify({ chat_id: CHAT_ID, text: text });
  https.request({
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
  }, r=>{}).end(data);
}

function sendWhatsApp(text) {
  const msg = encodeURIComponent(text.substring(0, 700));
  const path = `/whatsapp.php?phone=${WA_PHONE}&text=${msg}&apikey=${WA_KEY}`;
  https.get({ hostname: 'api.callmebot.com', path: path }, res => {
    let b=''; res.on('data', d=>b+=d); res.on('end', ()=>console.log("WA:", b));
  });
}

function fetchJson(url, cb){
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }, res => {
    let d=''; res.on('data', c=>d+=c);
    res.on('end', ()=>{
      try{ cb(null, JSON.parse(d)); } catch(e){ cb(e); }
    });
  }).on('error', cb);
}

// Use Shopify JSON endpoint - not blocked by Cloudflare
const URL = "https://www.pokemoncenter.com/en-gb/collections/new-arrivals/products.json?limit=5";

fetchJson(URL, (err, json)=>{
  if(err){
    console.log("Fetch error:", err.message);
    return;
  }
  const products = json.products || [];
  console.log("Found", products.length, "products");
  if(products.length === 0) return;

  const latest = products[0];
  const handle = latest.handle;
  const title = latest.title;
  const link = `https://www.pokemoncenter.com/en-gb/products/${handle}`;

  let last = "";
  try{ last = fs.readFileSync(FILE,'utf8').trim(); } catch(e){}

  console.log("Latest:", handle, "Last:", last);

  // If it's a new product OR you force it via manual run
  if(handle!== last){
    fs.writeFileSync(FILE, handle);
    const msg = `🔥 NEW POKEMON DROP!\n\n${title}\n${handle}\n${link}\n\nTotal new arrivals: ${products.length}`;
    console.log("SENDING:", msg);
    sendTelegram(msg);
    sendWhatsApp(msg);
  } else {
    console.log("No new product - same as last");
    // For testing: still send once if you run manually
    const msg = `✅ Bot check OK - No new drop\nLatest is still: ${title}\n${link}`;
    sendTelegram(msg);
    sendWhatsApp(msg);
  }
});
