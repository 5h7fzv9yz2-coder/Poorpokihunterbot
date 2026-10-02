const fs = require('fs');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const TOKEN = "8821796664:AAEghVepErTFj8iUcRDzdHZjAgCyDfcJjPM";
const CHAT = "1737260357";
const PHONE = "447508903111";
const KEY = "2884665";

const FILE = "last_products.json";
const HB_FILE = "last_heartbeat.txt";
const IS_MANUAL = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch';

// Sites to monitor - search pages for Pokemon
const SITES = [
  { name: "Smyths", url: "https://www.smythstoys.com/uk/en-gb/search/?q=pokemon", selector: ".productTile, [data-testid='product']" },
  { name: "Argos", url: "https://www.argos.co.uk/search/pokemon/", selector: "[data-test='product-card']" },
  { name: "Very", url: "https://www.very.co.uk/e/q/pokemon/e/b/1060.end", selector: ".product" },
  { name: "John Lewis", url: "https://www.johnlewis.com/search?search-term=pokemon", selector: "[data-testid='product-card']" },
  { name: "Zavvi", url: "https://www.zavvi.com/pokemon.list", selector: ".productBlock" },
  { name: "GAME", url: "https://www.game.co.uk/en/search/?q=Pokemon", selector: ".productCard" }
];

async function sendTelegram(text){
  try{
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ chat_id: CHAT, text: text.slice(0,4000) })
    });
    console.log("TG:", await res.text().then(t=>t.slice(0,100)));
  }catch(e){ console.log("TG ERR", e.message); }
}

async function sendWhatsApp(text){
  try{
    const url = `https://api.callmebot.com/whatsapp.php?phone=${PHONE}&text=${encodeURIComponent(text.slice(0,600))}&apikey=${KEY}`;
    const res = await fetch(url);
    console.log("WA:", (await res.text()).slice(0,150));
  }catch(e){ console.log("WA ERR", e.message); }
}

async function checkSite(site){
  try{
    console.log(`\nChecking ${site.name}...`);
    const res = await fetch(site.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'en-GB,en;q=0.9'
      },
      timeout: 20000
    });
    console.log(`${site.name} status ${res.status}`);
    const html = await res.text();

    const $ = cheerio.load(html);
    // Get first 3 product titles as sample
    let titles = [];
    $('a').each((i, el)=>{
      const t = $(el).text().trim();
      if(t.toLowerCase().includes('pokemon') && t.length > 10 && t.length < 120){
        titles.push(t);
      }
    });
    titles = [...new Set(titles)].slice(0,3);
    const firstTitle = titles[0] || `Found ${html.length} bytes`;

    console.log(`${site.name} -> ${firstTitle.slice(0,80)}`);
    return { ok: true, title: firstTitle, url: site.url, titles };

  }catch(e){
    console.log(`${site.name} FAIL ${e.message}`);
    return { ok: false, error: e.message };
  }
}

(async()=>{
  let lastData = {};
  try{ lastData = JSON.parse(fs.readFileSync(FILE,'utf8')); }catch(e){}

  let changes = [];
  let statusLines = [];

  for(const site of SITES){
    const result = await checkSite(site);
    if(!result.ok){
      statusLines.push(`❌ ${site.name}: ${result.error.slice(0,60)}`);
      continue;
    }

    const lastTitle = lastData[site.name];
    statusLines.push(`✅ ${site.name}: ${result.title.slice(0,60)}`);

    if(IS_MANUAL ||!lastTitle){
      // first run or manual - just save
      lastData[site.name] = result.title;
    } else if(result.title && result.title!== lastTitle && result.title.length > 10){
      console.log(`NEW at ${site.name}!`);
      changes.push(`🔥 NEW at ${site.name}!\n${result.title}\n${site.url}`);
      lastData[site.name] = result.title;
    }
  }

  fs.writeFileSync(FILE, JSON.stringify(lastData, null, 2));

  // Notify logic
  if(IS_MANUAL){
    fs.writeFileSync(HB_FILE, Date.now().toString());
    const msg = `✅ MANUAL TEST - 6 Sites Working!\n\n${statusLines.join('\n')}\n\nTime: ${new Date().toLocaleString('en-GB')}`;
    await sendTelegram(msg);
    await sendWhatsApp(`Manual OK: Checked ${SITES.length} sites`);
    return;
  }

  if(changes.length > 0){
    fs.writeFileSync(HB_FILE, Date.now().toString());
    const msg = changes.join('\n\n---\n\n');
    await sendTelegram(msg);
    await sendWhatsApp(msg);
  } else {
    // hourly heartbeat
    let lastHB = 0;
    try{ lastHB = parseInt(fs.readFileSync(HB_FILE,'utf8'))||0; }catch(e){}
    if(Date.now() - lastHB > 3600000){
      fs.writeFileSync(HB_FILE, Date.now().toString());
      await sendTelegram(`⏰ Hourly - 6 sites running, no new drops\n${statusLines.join('\n')}`);
    } else {
      console.log("No changes, heartbeat not due");
    }
  }
})();
