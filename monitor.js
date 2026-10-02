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
  try{
    const data = await cloudscraper.get({ uri: url, json: true });
    console.log("SUCCESS raw:", JSON.stringify(data).slice(0,500));
    return data;
  }catch(e){
    // try as text
    console.log("JSON fail, trying text", e.message);
    const text = await cloudscraper.get(url);
    console.log("Text len", text.length, "start", text.slice(0,500));
    return JSON.parse(text);
  }
}

(async()=>{
  try{
    const json = await fetchPokemon();
    console.log("Full keys:", Object.keys(json));

    let latest, title, handle;

    if(json.products && json.products[0]){
      latest = json.products[0];
      title = latest.title;
      handle = latest.handle;
    } else if(json[0]){
      // some endpoints return array directly
      latest = json[0];
      title = latest.title;
      handle = latest.handle;
    } else {
      console.log("UNKNOWN FORMAT:", JSON.stringify(json).slice(0,1000));
      throw new Error("Unknown JSON format: " + JSON.stringify(json).slice(0,200));
    }

    const link = `https://www.pokemoncenter.com/en-gb/products/${handle}`;
    console.log("Parsed:", title, handle);

    let last=""; try{ last=fs.readFileSync(FILE,'utf8').trim(); }catch(e){}
    
    if(IS_MANUAL || handle !== last){
      fs.writeFileSync(FILE, handle);
      fs.writeFileSync(HB_FILE, Date.now().toString());
      const prefix = IS_MANUAL ? "✅ MANUAL TEST - Working!" : "🔥 NEW DROP!";
      await sendTelegram(`${prefix}\n${title}\n${link}`);
    } else {
      let lastHB=0; try{ lastHB=parseInt(fs.readFileSync(HB_FILE,'utf8'))||0; }catch(e){}
      if(Date.now()-lastHB>3600000 || IS_MANUAL){
        fs.writeFileSync(HB_FILE, Date.now().toString());
        await sendTelegram(`⏰ Hourly - Bot running\nLatest: ${title}\n${link}`);
      }
    }
  }catch(e){
    console.log("FATAL:", e.message, e.stack?.slice(0,300));
    await sendTelegram(`❌ Error: ${e.message.slice(0,200)}`);
  }
})();
