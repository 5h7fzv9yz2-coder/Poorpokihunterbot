const fs = require('fs');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const TOKEN = "8821796664:AAEghVepErTFj8iUcRDzdHZjAgCyDfcJjPM";
const CHAT = "1737260357";
const FILE = "last_products.json";
const HB_FILE = "last_heartbeat.txt";
const IS_MANUAL = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch';

// Use AllOrigins proxy for blocked sites - it fetches from Cloudflare, not GitHub
async function fetchWithFallback(url){
  try{
    // Try direct first
    let res = await fetch(url, {
      headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120','Accept-Language':'en-GB'},
      timeout: 15000
    });
    let html = await res.text();
    if(html.length > 10000) return html; // real page is >10k

    console.log(`Direct blocked (${html.length}b), trying proxy...`);
    // Fallback to proxy
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    res = await fetch(proxyUrl, { timeout: 20000 });
    html = await res.text();
    console.log(`Proxy got ${html.length}b`);
    return html;
  }catch(e){
    console.log(`Fetch fail ${url}: ${e.message}`);
    throw e;
  }
}

async function sendTelegram(text){
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({chat_id: CHAT, text: text.slice(0,4000)})
  });
  console.log("TG:", (await res.text()).slice(0,100));
}

async function checkSmyths(){
  try{
    const html = await fetchWithFallback("https://www.smythstoys.com/uk/en-gb/search/?q=pokemon");
    const $ = cheerio.load(html);
    let titles = [];
    // Smyths product tiles
    $('[data-testid="productTile"],.productTile,.product-tile, [class*="ProductCard"], h3,.productName').each((i,el)=>{
      const t = $(el).text().trim();
      if(t.toLowerCase().includes('pokemon') && t.length>10 && t.length<120) titles.push(t);
    });
    // Also check meta
    if(titles.length===0){
      $('a').each((i,el)=>{
        const t = $(el).text().trim();
        if(t.toLowerCase().includes('pokémon') || t.toLowerCase().includes('pokemon') && t.length>15 && t.length<100) titles.push(t);
      });
    }
    titles = [...new Set(titles)].slice(0,5);
    console.log("Smyths found:", titles);
    return titles[0] || `Smyths page ${html.length}b - no pokemon text`;
  }catch(e){ return `Smyths FAIL ${e.message}`; }
}

async function checkZavvi(){
  try{
    const html = await fetchWithFallback("https://www.zavvi.com/pokemon.list");
    const $ = cheerio.load(html);
    let title = $('.productBlock__title,.productBlock h3, [data-product-name]').first().text().trim();
    if(!title || title==='Refine'){
      // get first product link text
      const links = [];
      $('a').each((i,el)=>{
        const t=$(el).text().trim();
        if(t.toLowerCase().includes('pokemon') && t.length>12 && t.length<120) links.push(t);
      });
      title = links[0] || "Zavvi Pokemon";
    }
    console.log("Zavvi:", title);
    return title;
  }catch(e){ return `Zavvi FAIL ${e.message}`; }
}

async function checkSimple(name, url, keyword='pokemon'){
  try{
    const html = await fetchWithFallback(url);
    const $ = cheerio.load(html);
    let found = "";
    const lowerKw = keyword.toLowerCase();
    $('h2,h3,a').each((i,el)=>{
      const t = $(el).text().trim();
      if(!found && t.toLowerCase().includes(lowerKw) && t.length>10 && t.length<110) found = t;
    });
    console.log(`${name}: ${found.slice(0,80)} len ${html.length}`);
    return found || `${name} OK ${html.length}b`;
  }catch(e){ return `${name} FAIL ${e.message.slice(0,80)}`; }
}

(async()=>{
  let last={}; try{ last=JSON.parse(fs.readFileSync(FILE,'utf8')); }catch(e){}
  let changes=[]; let lines=[];

  const checks = [
    ["Smyths", await checkSmyths(), "https://www.smythstoys.com/uk/en-gb/search/?q=pokemon"],
    ["Zavvi", await checkZavvi(), "https://www.zavvi.com/pokemon.list"],
    ["Argos", await checkSimple("Argos","https://www.argos.co.uk/search/pokemon/"), "https://www.argos.co.uk/search/pokemon/"],
    ["Very", await checkSimple("Very","https://www.very.co.uk/e/q/pokemon/e/b/1060.end"), "https://www.very.co.uk/e/q/pokemon/e/b/1060.end"],
    ["GAME", await checkSimple("GAME","https://www.game.co.uk/en/search/?q=Pokemon"), "https://www.game.co.uk/en/search/?q=Pokemon"],
    ["John Lewis", await checkSimple("John Lewis","https://www.johnlewis.com/search?search-term=pokemon"), "https://www.johnlewis.com/search?search-term=pokemon"]
  ];

  for(const [name, result, url] of checks){
    lines.push(`${name}: ${result.slice(0,90)}`);
    if(last[name] && result!==last[name] &&!result.includes('FAIL') && result.length>12 && result!==`Smyths page`){
      if(!result.includes('6183') &&!result.includes('394b') &&!result.includes('4306b')){
        changes.push(`🔥 NEW ${name}!\n${result}\n${url}`);
      }
    }
    last[name]=result;
  }

  fs.writeFileSync(FILE, JSON.stringify(last,null,2));

  if(IS_MANUAL){
    fs.writeFileSync(HB_FILE, Date.now().toString());
    await sendTelegram(`✅ V3 MANUAL TEST (with proxy)\n\n${lines.join('\n')}\n\nTime: ${new Date().toLocaleString('en-GB')}`);
  } else if(changes.length>0){
    fs.writeFileSync(HB_FILE, Date.now().toString());
    await sendTelegram(changes.join('\n\n---\n\n'));
  } else {
    let lastHB=0; try{lastHB=parseInt(fs.readFileSync(HB_FILE,'utf8'))||0;}catch(e){}
    if(Date.now()-lastHB>3600000){
      fs.writeFileSync(HB_FILE, Date.now().toString());
      await sendTelegram(`⏰ Hourly - No new drops\n${lines.join('\n')}`);
    }
  }
})();
