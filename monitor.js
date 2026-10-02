const https = require('https');

const BOT_TOKEN = "8821796664:AAEghVepErTFj8iUcRDzdHZjAgCyDfcJjPM";
const CHAT_ID = "1737260357";
const WA_PHONE = "447508903111";
const WA_KEY = "2884665";

function sendTelegram(text) {
  const data = JSON.stringify({ chat_id: CHAT_ID, text: text });
  console.log("Sending Telegram:", text.substring(0,50));
  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
  }, res => {
    let b=''; res.on('data', d=>b+=d); res.on('end', ()=>console.log("Telegram response:", b));
  });
  req.on('error', e=>console.log("Telegram error:", e.message));
  req.end(data);
}

function sendWhatsApp(text) {
  const msg = encodeURIComponent(text);
  const path = `/whatsapp.php?phone=${WA_PHONE}&text=${msg}&apikey=${WA_KEY}`;
  console.log("Sending WhatsApp to", WA_PHONE);
  https.get({ hostname: 'api.callmebot.com', path: path }, res => {
    let b=''; res.on('data', d=>b+=d);
    res.on('end', ()=>console.log("WA response:", b));
  }).on('error', e=>console.log("WA error:", e.message));
}

// 1. SEND TEST IMMEDIATELY - proves WhatsApp works
sendTelegram("🔧 DEBUG TEST - if you get this, Telegram works");
sendWhatsApp("🔧 DEBUG TEST " + new Date().toISOString() + " - if you get this, WhatsApp works");

// 2. Then try to fetch Pokemon after 2 seconds
setTimeout(()=>{
  console.log("Fetching Pokemon Center products.json...");
  https.get("https://www.pokemoncenter.com/en-gb/collections/new-arrivals/products.json?limit=3",
    { headers: { 'User-Agent': 'Mozilla/5.0' } },
    res => {
      console.log("Pokemon status:", res.statusCode);
      let d=''; res.on('data', c=>d+=c);
      res.on('end', ()=>{
        console.log("Body length:", d.length);
        console.log("First 200 chars:", d.substring(0,200));
        if(d.length < 100){
          sendWhatsApp("Pokemon blocked, body: " + d);
        } else {
          try{
            const j = JSON.parse(d);
            const title = j.products[0]?.title || "no title";
            sendWhatsApp("Pokemon OK! Latest: " + title);
            sendTelegram("Pokemon OK! Latest: " + title);
          }catch(e){ console.log("JSON parse error", e.message); }
        }
      });
    }).on('error', e=>{
      console.log("Fetch error:", e.message);
      sendWhatsApp("Fetch error: " + e.message);
    });
}, 2000);
