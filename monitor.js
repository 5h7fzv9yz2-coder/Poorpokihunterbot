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
    }, res => { let b=''; res.on('data', d=>b+=d); res.on('end', ()=>{ console.log("TG OK", b.slice(0,100)); resolve(); }); });
    req.on('error', e=>{ console.log("TG ERR", e.message); resolve(); });
    req.write(data); req.end();
  });
}

function sendWhatsApp(text){
  return new Promise((resolve)=>{
    const path = `/whatsapp.php?phone=${PHONE}&text=${encodeURIComponent(text.slice(0,600))}&apikey=${KEY}`;
    https.get({ hostname: 'api.callmebot.com', path: path }, res => {
      let b=''; res.on('data', d=>b+=d); res.on('end', ()=>{ console.log("WA:", b.slice(0,200)); resolve(); });
    }).on('error', e=>{ console.log("WA ERR", e.message); resolve(); });
  });
}

function get(url){
  return new Promise((resolve, reject)=>{
    console.log("GET", url.slice(0,80));
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, res=>{
      let d=''; res.on('data', c=>d+=c);
      res.on('end', ()=> resolve({ status: res.statusCode, body: d }));
    }).on('error', reject);
  });
}

async function fetchPokemon(){
  const target = "https://www.pokemoncenter.com/en-gb/collections/new-arrivals/products.json?limit=3";
  const enc = encodeURIComponent(target);

  const proxies = [
    `https://api.allorigins.win/get?url=${enc}`,
    `https://api.allorigins.win/raw?url=${enc}`,
    `https://thingproxy.freeboard.io/fetch/${target}`,
    `https://api.codetabs.com/v1/proxy?quest=${enc}`,
    `https://corsproxy.io/?${enc}`,
    `https://api.cors.lol/?url=${enc}`
  ];

  for(let i=0;i<proxies.length;i++){
    try{
      const r = await get(proxies[i]);
      console.log(`Proxy ${i+1} status ${r.status} len ${r.body.length}`);
      if(r.body.length < 100) continue;

      let jsonStr = r.body;
      // allorigins /get wraps in {"contents": "..."}
      if(jsonStr.includes('"contents"')){
        try{
          const wrapped = JSON.parse(jsonStr);
          jsonStr = wrapped.contents || wrapped.body || jsonStr;
        }catch(e){}
      }
      if(jsonStr.includes("<!DOCTYPE") || jsonStr.includes("<html") && jsonStr.length < 2000){
        console.log("Got HTML challenge, next proxy");
        continue;
      }
      const data = JSON.parse(jsonStr);
      if(data.products && data.products.length > 0){
        console.log(`SUCCESS via proxy ${i+1}`);
        return data;
      }
    }catch(e){
      console.log(`Proxy ${i+1} failed: ${e.message}`);
    }
  }
  throw new Error("All proxies blocked by Pokemon Center Cloudflare");
}

(async()=>{
  try{
    const json = await fetchPokemon();
    const latest = json.products[0];
    const title = latest.title;
    const handle = latest.handle;
    const link = `https://www.pokemoncenter.com/en-gb/products/${handle}`;

    let last=""; try{ last=fs.readFileSync(FILE,'utf8').trim(); }catch(e){}

    if(IS_MANUAL){
      fs.writeFileSync(FILE, handle);
      fs.writeFileSync(HB_FILE, Date.now().toString());
      await sendTelegram(`✅ MANUAL TEST - Working!\n${title}\n${link}`);
      await sendWhatsApp(`Manual OK: ${title}`);
      return;
    }

    if(handle!==last){
      fs.writeFileSync(FILE, handle);
      await sendTelegram(`🔥 NEW DROP!\n${title}\n${link}`);
      await sendWhatsApp(`NEW: ${title} ${link}`);
    } else {
      let lastHB=0; try{ lastHB=parseInt(fs.readFileSync(HB_FILE,'utf8'))||0; }catch(e){}
      if(Date.now()-lastHB>3600000){
        fs.writeFileSync(HB_FILE, Date.now().toString());
        await sendTelegram(`⏰ Hourly - Bot running\nLatest: ${title}`);
      } else console.log("No new, heartbeat not due");
    }
  }catch(e){
    console.log("FATAL:", e.message);
    // Still tell you bot is alive even if Pokemon blocks
    await sendTelegram(`⚠️ Bot alive but Pokemon site blocked all proxies (${e.message}). Will retry in 5 mins.\nIf this continues, we should switch to monitoring Zavvi or Smyths which don't block.`);
  }
})();
