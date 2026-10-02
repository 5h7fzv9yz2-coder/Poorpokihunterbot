const https = require('https');
const fs = require('fs');

const TOKEN = "8821796664:AAEghVepErTFj8iUcRDzdHZjAgCyDfcJjPM";
const CHAT = "1737260357";
const PHONE = "447508903111";
const KEY = "2884665";
const FILE = "last_product.txt";
const HB_FILE = "last_heartbeat.txt";

const IS_MANUAL = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch';

function sendTelegram(text){
  return new Promise((resolve)=>{
    const data = JSON.stringify({ chat_id: CHAT, text: text });
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => { let b=''; res.on('data', d=>b+=d); res.on('end', ()=>{ console.log("TG:", b.slice(0,150)); resolve(); }); });
    req.on('error', e=>{ console.log("TG ERR", e.message); resolve(); });
    req.write(data); req.end();
  });
}

function sendWhatsApp(text){
  return new Promise((resolve)=>{
    const path = `/whatsapp.php?phone=${PHONE}&text=${encodeURIComponent(text.slice(0,600))}&apikey=${KEY}`;
    https.get({ hostname: 'api.callmebot.com', path: path }, res => {
      let b=''; res.on('data', d=>b+=d);
      res.on('end', ()=>{ console.log("WA:", b.slice(0,200)); resolve(); });
    }).on('error', e=>{ console.log("WA ERR", e.message); resolve(); });
  });
}

// NEW: Fetch via proxy to bypass Cloudflare block
function fetchViaProxy(){
  return new Promise((resolve, reject)=>{
    const target = encodeURIComponent("https://www.pokemoncenter.com/en-gb/collections/new-arrivals/products.json?limit=3");
    // 3 different proxies, try one by one
    const proxies = [
      `https://api.allorigins.win/raw?url=${target}`,
      `https://corsproxy.io/?${encodeURIComponent("https://www.pokemoncenter.com/en-gb/collections/new-arrivals/products.json?limit=3")}`,
      `https://api.codetabs.com/v1/proxy?quest=${target}`
    ];

    let attempt = 0;
    function tryNext(){
      if(attempt >= proxies.length){
        reject(new Error("All proxies blocked"));
        return;
      }
      const url = proxies[attempt++];
      console.log(`Trying proxy ${attempt}: ${url.slice(0,60)}...`);

      https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
        let d=''; res.on('data', c=>d+=c);
        res.on('end', ()=>{
          console.log(`Proxy ${attempt} status ${res.statusCode} len ${d.length}`);
          if(d.length < 50 || d.includes("<!DOCTYPE") || d.includes("<html")){
            console.log("Got HTML block, trying next proxy");
            tryNext();
          } else {
            try{
              resolve(JSON.parse(d));
            }catch(e){
              console.log("Parse fail, trying next");
              tryNext();
            }
          }
        });
      }).on('error', e=>{
        console.log("Proxy error", e.message);
        tryNext();
      });
    }
    tryNext();
  });
}

(async()=>{
  try{
    const json = await fetchViaProxy();
    const latest = json.products?.[0];
    if(!latest) throw new Error("No products in JSON");

    const title = latest.title;
    const handle = latest.handle;
    const link = `https://www.pokemoncenter.com/en-gb/products/${handle}`;

    let last = "";
    try{ last = fs.readFileSync(FILE,'utf8').trim(); }catch(e){}

    if(IS_MANUAL){
      fs.writeFileSync(FILE, handle);
      fs.writeFileSync(HB_FILE, Date.now().toString());
      await sendTelegram(`✅ MANUAL TEST - Bot is working!\n\nLatest: ${title}\n${link}`);
      await sendWhatsApp(`Manual test OK: ${title}`);
      return;
    }

    if(handle!== last){
      fs.writeFileSync(FILE, handle);
      await sendTelegram(`🔥 NEW DROP!\n${title}\n${link}`);
      await sendWhatsApp(`NEW DROP: ${title} ${link}`);
    } else {
      let lastHB = 0;
      try{ lastHB = parseInt(fs.readFileSync(HB_FILE,'utf8'))||0; }catch(e){}
      if(Date.now() - lastHB > 3600000){
        fs.writeFileSync(HB_FILE, Date.now().toString());
        await sendTelegram(`⏰ Hourly - Bot running\nLatest: ${title}`);
      } else {
        console.log("No new, no heartbeat due");
      }
    }
  }catch(e){
    console.log("FATAL Error:", e.message);
    await sendTelegram(`❌ Bot error: ${e.message}\nTrying Telegram only - Pokemon site blocked all proxies`);
  }
})();
