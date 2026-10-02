const https = require('https');
const fs = require('fs');

const TOKEN = "8821796664:AAEghVepErTFj8iUcRDzdHZjAgCyDfcJjPM";
const CHAT = "1737260357";
const PHONE = "447508903111";
const KEY = "2884665";
const FILE = "last_product.txt";

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
      res.on('end', ()=>{ console.log("TG:", b.slice(0,100)); resolve(); });
    });
    req.on('error', e=>{ console.log("TG ERR", e.message); resolve(); });
    req.write(data); req.end();
  });
}

function sendWhatsApp(text){
  return new Promise((resolve)=>{
    const path = `/whatsapp.php?phone=${PHONE}&text=${encodeURIComponent(text.slice(0,700))}&apikey=${KEY}`;
    https.get({ hostname: 'api.callmebot.com', path: path }, res => {
      let b=''; res.on('data', d=>b+=d);
      res.on('end', ()=>{ console.log("WA:", b.slice(0,200)); resolve(); });
    }).on('error', e=>{ console.log("WA ERR", e.message); resolve(); });
  });
}

function fetchProducts(){
  return new Promise((resolve,reject)=>{
    https.get("https://www.pokemoncenter.com/en-gb/collections/new-arrivals/products.json?limit=5",
      { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } },
      res => {
        let d=''; res.on('data', c=>d+=c);
        res.on('end', ()=>{
          console.log("Pokemon status", res.statusCode, "len", d.length);
          try{ resolve(JSON.parse(d)); } catch(e){ reject(e); }
        });
      }).on('error', reject);
  });
}

(async()=>{
  console.log("Checking Pokemon...");
  try{
    const json = await fetchProducts();
    const products = json.products || [];
    if(products.length===0){ console.log("No products"); return; }

    const latest = products[0];
    const title = latest.title;
    const handle = latest.handle;
    const link = `https://www.pokemoncenter.com/en-gb/products/${handle}`;

    let last = "";
    try{ last = fs.readFileSync(FILE,'utf8').trim(); }catch(e){}

    console.log("Latest:", handle, "Last saved:", last);

    if(handle!== last){
      fs.writeFileSync(FILE, handle);
      const msg = `🔥 NEW POKEMON DROP!\n\n${title}\n${link}`;
      await sendTelegram(msg);
      await sendWhatsApp(msg);
    } else {
      console.log("No new drop, but sending test check");
      await sendTelegram(`✅ Bot check OK 14:15\nLatest still: ${title}\n${link}`);
      // only send WA on new drop to avoid spam, comment next line if you want WA every check:
      // await sendWhatsApp(`✅ Check OK: ${title}`);
    }
  } catch(e){
    console.log("Error:", e.message);
    await sendTelegram("Bot error: " + e.message.slice(0,200));
  }
})();
