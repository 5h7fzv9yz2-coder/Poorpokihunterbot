const fs = require('fs');
const cloudscraper = require('cloudscraper');

const TOKEN = "8821796664:AAEghVepErTFj8iUcRDzdHZjAgCyDfcJjPM";
const CHAT = "1737260357";
const FILE = "last_product.txt";
const HB_FILE = "last_heartbeat.txt";
const IS_MANUAL = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch';

async function sendTelegram(text){
  try{
    await cloudscraper.post({
      url: `https://api.telegram.org/bot${TOKEN}/sendMessage`,
      json: { chat_id: CHAT, text: text }
    });
    console.log("TG OK");
  }catch(e){ console.log("TG ERR", e.message); }
}

async function fetchPokemon(){
  console.log("Trying CloudScraper bypass...");
  const url = "https://www.pokemoncenter.com/en-gb/collections/new-arrivals/products.json?limit=3";
  const data = await cloudscraper.get({ uri: url, json: true, headers: { 'User-Agent': 'Mozilla/5.0' } });
  console.log("CloudScraper SUCCESS len", JSON.stringify(data).length);
  return data;
}

(async()=>{
  try{
    const json = await fetchPokemon();
    const latest = json.products[0];
    const title = latest.title;
    const link = `https://www.pokemoncenter.com/en-gb/products/${latest.handle}`;

    let last=""; try{ last=fs.readFileSync(FILE,'utf8').trim(); }catch(e){}
    
    if(IS_MANUAL || latest.handle !== last){
      fs.writeFileSync(FILE, latest.handle);
      fs.writeFileSync(HB_FILE, Date.now().toString());
      const prefix = IS_MANUAL ? "✅ MANUAL TEST - Working!" : "🔥 NEW DROP!";
      await sendTelegram(`${prefix}\n${title}\n${link}`);
    } else {
      let lastHB=0; try{ lastHB=parseInt(fs.readFileSync(HB_FILE,'utf8'))||0; }catch(e){}
      if(Date.now()-lastHB>3600000){
        fs.writeFileSync(HB_FILE, Date.now().toString());
        await sendTelegram(`⏰ Hourly - Bot running\n${title}`);
      }
    }
  }catch(e){
    console.log("FATAL:", e.message.slice(0,300));
    await sendTelegram(`⚠️ Still blocked: ${e.message.slice(0,150)} - Try FIX 2`);
  }
})();
