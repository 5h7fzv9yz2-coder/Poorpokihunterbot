const fs = require('fs');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const TOKEN = "8821796664:AAEghVepErTFj8iUcRDzdHZjAgCyDfcJjPM";
const CHAT = "1737260357";
const FILE = "last_products.json";
const HB_FILE = "last_heartbeat.txt";
const IS_MANUAL = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch';

async function sendTelegram(text){
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({chat_id: CHAT, text: text.slice(0,4000)})
  });
  console.log("TG:", (await res.text()).slice(0,150));
}

async function checkSmyths(){
  try{
    // Smyths uses Algolia - call their public search index directly
    const html = await fetch("https://www.smythstoys.com/uk/en-gb/search/?q=pokemon", {
      headers:{'User-Agent':'Mozilla/5.0 Chrome/120','Accept-Language':'en-GB'}
    }).then(r=>r.text());

    const $ = cheerio.load(html);
    // Try 3 methods: NEXT_DATA, JSON-LD, and plain links
    let titles = [];
    const nextData = $('#__NEXT_DATA__').html();
    if(nextData){
      const json = JSON.parse(nextData);
      const txt = JSON.stringify(json).slice(0,20000);
      // quick extract of pokemon titles from next data
      const matches = txt.match(/Pok[^"]{5,80}/gi);
      if(matches) titles = matches;
    }
    if(titles.length===0){
      $('a').each((i,el)=>{
        const t = $(el).text().trim();
        if(t.toLowerCase().includes('pok') && t.length>8 && t.length<100) titles.push(t);
      });
    }
    titles = [...new Set(titles)].slice(0,5);
    console.log("Smyths titles:", titles.slice(0,3));
    return titles[0] || `Smyths page ${html.length} bytes`;
  }catch(e){ return `Smyths FAIL ${e.message}`; }
}

async function checkZavvi(){
  try{
    const html = await fetch("https://www.zavvi.com/pokemon.list", {
      headers:{'User-Agent':'Mozilla/5.0 Chrome/120','Accept-Language':'en-GB'}
    }).then(r=>r.text());
    const $ = cheerio.load(html);
    let title = $('.productBlock__title,.productName, h2').first().text().trim();
    if(!title){
      const txt = html.match(/Pok[^<]{5,80}/i);
      title = txt? txt[0] : "Pokemon list";
    }
    console.log("Zavvi:", title.slice(0,80));
    return title;
  }catch(e){ return `Zavvi FAIL ${e.message}`; }
}

async function checkSite(name, url){
  try{
    const res = await fetch(url, {
      headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0) Chrome/120','Accept':'text/html','Accept-Language':'en-GB,en;q=0.9'},
      timeout: 20000
    });
    const html = await res.text();
    console.log(`${name} status ${res.status} len ${html.length}`);
    const $ = cheerio.load(html);
    let found = "";
    $('a,h2,h3').each((i,el)=>{
      const t = $(el).text().trim();
      if(t.toLowerCase().includes('pok') && t.length>8 && t.length<100 &&!found) found = t;
    });
    return found || `${name} OK ${html.length}b`;
  }catch(e){ return `${name} FAIL ${e.message.slice(0,80)}`; }
}

(async()=>{
  let last = {}; try{ last = JSON.parse(fs.readFileSync(FILE,'utf8')); }catch(e){}
  let changes = []; let lines = [];

  const smyths = await checkSmyths();
  lines.push(`Smyths: ${smyths.slice(0,80)}`);
  if(last.Smyths && smyths!==last.Smyths &&!smyths.includes('FAIL') && smyths.length>10) changes.push(`🔥 NEW Smyths!\n${smyths}\nhttps://www.smythstoys.com/uk/en-gb/search/?q=pokemon`);
  last.Smyths = smyths;

  const zavvi = await checkZavvi();
  lines.push(`Zavvi: ${zavvi.slice(0,80)}`);
  if(last.Zavvi && zavvi!==last.Zavvi &&!zavvi.includes('FAIL')) changes.push(`🔥 NEW Zavvi!\n${zavvi}\nhttps://www.zavvi.com/pokemon.list`);
  last.Zavvi = zavvi;

  for(const s of [
    ["Argos","https://www.argos.co.uk/search/pokemon/"],
    ["Very","https://www.very.co.uk/e/q/pokemon/e/b/1060.end"],
    ["GAME","https://www.game.co.uk/en/search/?q=Pokemon"],
    ["John Lewis","https://www.johnlewis.com/search?search-term=pokemon"]
  ]){
    const r = await checkSite(s[0], s[1]);
    lines.push(`${s[0]}: ${r.slice(0,80)}`);
    if(last[s[0]] && r!==last[s[0]] &&!r.includes('FAIL') && r.length>10) changes.push(`🔥 NEW ${s[0]}!\n${r}\n${s[1]}`);
    last[s[0]] = r;
  }

  fs.writeFileSync(FILE, JSON.stringify(last,null,2));

  if(IS_MANUAL){
    fs.writeFileSync(HB_FILE, Date.now().toString());
    await sendTelegram(`✅ MANUAL TEST - V2 Working!\n\n${lines.join('\n')}\n\nTime: ${new Date().toLocaleString('en-GB')}`);
  } else if(changes.length>0){
    fs.writeFileSync(HB_FILE, Date.now().toString());
    await sendTelegram(changes.join('\n\n---\n\n'));
  } else {
    let lastHB=0; try{lastHB=parseInt(fs.readFileSync(HB_FILE,'utf8'))||0;}catch(e){}
    if(Date.now()-lastHB>3600000){
      fs.writeFileSync(HB_FILE, Date.now().toString());
      await sendTelegram(`⏰ Hourly OK - No new drops\n${lines.join('\n')}`);
    }
  }
})();
