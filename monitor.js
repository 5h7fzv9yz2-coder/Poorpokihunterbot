const https = require('https');
const fs = require('fs');

const TOKEN = "8821796664:AAEghVepErTFj8iUcRDzdHZjAgCyDfcJjPM";
const CHAT = "1737260357";
const PHONE = "447508903111";
const KEY = "2884665";
const FILE = "last_product.txt";
const HB_FILE = "last_heartbeat.txt";

const IS_MANUAL = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch';
console.log("Event:", process.env.GITHUB_EVENT_NAME, "Manual?", IS_MANUAL);

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
      res.on('end', ()=>{ console.log("TG:", b.slice(0,120)); resolve(); });
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
    https.get("https://www.pokemoncenter.com/en-gb/collections/new-arrivals/products.json?limit=3",
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
      res => {
        let d=''; res.on('data', c=>d+=c);
        res.on('end', ()=>{
          try{ resolve(JSON.parse(d)); } catch(e){ reject(e); }
        });
      }).on('error', reject);
  });
}

(async()=>{
  try{
    const json = await fetchProducts();
    const latest = json.products[0];
    if(!latest) throw new Error("No products found");

    const title = latest.title;
    const handle = latest.handle;
    const link = `https://www.pokemoncenter.com/en-gb/products/${handle}`;

    let last = "";
    try{ last = fs.readFileSync(FILE,'utf8').trim(); }catch(e){}

    console.log("Latest:", handle, "Last:", last);

    // CASE 1: You clicked Run manually -> ALWAYS notify
    if(IS_MANUAL){
      fs.writeFileSync(FILE, handle);
      fs.writeFileSync(HB_FILE, Date.now().toString());
      const msg = `✅ MANUAL TEST - Bot is working!\n\nLatest: ${title}\n${link}\nTime: ${new Date().toLocaleString('en-GB')}`;
      console.log("MANUAL RUN - sending test");
      await sendTelegram(msg);
      await sendWhatsApp(msg);
      return;
    }

    // CASE 2: Auto run - NEW product?
    if(handle!== last){
      fs.writeFileSync(FILE, handle);
      fs.writeFileSync(HB_FILE, Date.now().toString());
      const msg = `🔥 NEW POKEMON DROP!\n\n${title}\n${link}`;
      await sendTelegram(msg);
      await sendWhatsApp(msg);
      return;
    }

    // CASE 3: Auto run - no new product, check if 1 hour passed for heartbeat
    let lastHB = 0;
    try{ lastHB = parseInt(fs.readFileSync(HB_FILE,'utf8')) || 0; }catch(e){}
    const oneHour = 60*60*1000;

    if(Date.now() - lastHB > oneHour){
      fs.writeFileSync(HB_FILE, Date.now().toString());
      const msg = `⏰ Hourly check - Bot is running\nNo new drop\nLatest still: ${title}\n${new Date().toLocaleString('en-GB')}`;
      console.log("Sending hourly heartbeat");
      await sendTelegram(msg);
      // WhatsApp hourly too (comment out if too spammy)
      await sendWhatsApp(msg);
    } else {
      console.log("No new drop and heartbeat not due yet");
    }

  } catch(e){
    console.log("Error:", e.message);
    await sendTelegram("❌ Bot error: " + e.message.slice(0,200));
    // Always tell you if manual run fails
    if(IS_MANUAL) await sendWhatsApp("Bot error on manual run: " + e.message.slice(0,200));
  }
})();
