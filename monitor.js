const https = require('https');

const TOKEN = "8821796664:AAEghVepErTFj8iUcRDzdHZjAgCyDfcJjPM";
const CHAT = "1737260357";
const PHONE = "447508903111";
const KEY = "2884665";

console.log("STARTING...");

function sendTelegram(text){
  return new Promise((resolve)=>{
    const data = JSON.stringify({ chat_id: CHAT, text: text });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let b=''; res.on('data', d=>b+=d);
      res.on('end', ()=>{ console.log("TELEGRAM RESPONSE:", b); resolve(); });
    });
    req.on('error', e=>{ console.log("TG ERROR", e.message); resolve(); });
    req.write(data);
    req.end();
  });
}

function sendWhatsApp(text){
  return new Promise((resolve)=>{
    const path = `/whatsapp.php?phone=${PHONE}&text=${encodeURIComponent(text)}&apikey=${KEY}`;
    https.get({ hostname: 'api.callmebot.com', path: path }, res => {
      let b=''; res.on('data', d=>b+=d);
      res.on('end', ()=>{ console.log("WA RESPONSE:", b); resolve(); });
    }).on('error', e=>{ console.log("WA ERROR", e.message); resolve(); });
  });
}

(async()=>{
  await sendTelegram("Test TG " + new Date().toISOString().slice(11,19));
  await sendWhatsApp("Test WA " + new Date().toISOString().slice(11,19));
  console.log("DONE - both sent");
})();
