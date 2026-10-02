const fs = require('fs');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const TOKEN = "8821796664:AAEghVepErTFj8iUcRDzdHZjAgCyDfcJjPM";
const CHAT = "1737260357";
const FILE = "last_products.json";
const HB_FILE = "last_heartbeat.txt";
const IS_MANUAL = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch';

async function sendTG(text){
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({chat_id:CHAT,text:text.slice(0,4000)})
  });
}

// ALWAYS use proxy - GitHub IP is banned by all 6 now
async function getPage(url){
  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    `https://corsproxy.io/?${encodeURIComponent(url)}`
  ];
  for(const p of proxies){
    try{
      const res = await fetch(p,{timeout:20000, headers:{'User-Agent':'Mozilla/5.0 Chrome/120'}});
      const html = await res.text();
      console.log(`Proxy ${p.slice(8,20)} -> ${html.length}b for ${url.slice(12,30)}`);
      if(html.length > 5000 &&!html.includes('enable JS and disable any ad blocker')) return html;
    }catch(e){ console.log(`Proxy fail ${e.message}`); }
  }
  throw new Error("Both proxies failed");
}

async function checkSmyths(){
  const html = await getPage("https://www.smythstoys.com/uk/en-gb/search/?q=pokemon");
  const $ = cheerio.load(html);
  const titles = [];
  // Smyths real selectors
  $('h3, [class*="ProductCard_title"],.productTile__title, a[title*="Pok"]').each((i,el)=>{
    const t=$(el).text().trim().replace(/\s+/g,' ');
    if(t.toLowerCase().includes('pok') && t.length>12 && t.length<130) titles.push(t);
  });
  console.log("Smyths parsed:", titles.slice(0,3));
  return titles[0] || `Smyths ${html.length}b`;
}

async function checkZavvi(){
  const html = await getPage("https://www.zavvi.com/pokemon.list");
  const $ = cheerio.load(html);
  const titles = [];
  $('.productBlock.productBlock__title,.productBlock h3, [data-e2e="product_name"]').each((i,el)=>{
    const t=$(el).text().trim();
    if(t.length>5) titles.push(t);
  });
  if(titles.length===0){
    $('a').each((i,el)=>{
      const t=$(el).text().trim();
      if(t.toLowerCase().includes('pok') && t.length>12 && t.length<120) titles.push(t);
    });
  }
  console.log("Zavvi parsed:", titles.slice(0,3));
  return titles[0] || "Zavvi Pokemon";
}

async function checkOther(name, url){
  const html = await getPage(url);
  const $ = cheerio.load(html);
  let found="";
  $('h2,h3,a').each((i,el)=>{
    if(found) return;
    const t=$(el).text().trim().replace(/\s+/g,' ');
    if(t.toLowerCase().includes('pok') && t.length>12 && t.length<120) found=t;
  });
  console.log(`${name} parsed: ${found.slice(0,70)}`);
  return found || `${name} ${html.length}b`;
}

(async()=>{
  let last={}; try{last=JSON.parse(fs.readFileSync(FILE,'utf8'))}catch(e){}
  let lines=[]; let changes=[];

  try{ const r=await checkSmyths(); lines.push(`Smyths: ${r.slice(0,90)}`); if(last.Smyths && r!==last.Smyths && r.length>15) changes.push(`🔥 NEW Smyths!\n${r}`); last.Smyths=r; }catch(e){ lines.push(`Smyths FAIL ${e.message}`); }
  try{ const r=await checkZavvi(); lines.push(`Zavvi: ${r.slice(0,90)}`); if(last.Zavvi && r!==last.Zavvi && r.length>15) changes.push(`🔥 NEW Zavvi!\n${r}`); last.Zavvi=r; }catch(e){ lines.push(`Zavvi FAIL ${e.message}`); }

  const others = [["Argos","https://www.argos.co.uk/search/pokemon/"],["Very","https://www.very.co.uk/e/q/pokemon/e/b/1060.end"],["GAME","https://www.game.co.uk/en/search/?q=Pokemon"],["John Lewis","https://www.johnlewis.com/search?search-term=pokemon"]];
  for(const [name,url] of others){
    try{ const r=await checkOther(name,url); lines.push(`${name}: ${r.slice(0,90)}`); if(last[name] && r!==last[name] && r.length>15 &&!r.includes('b')) changes.push(`🔥 NEW ${name}!\n${r}\n${url}`); last[name]=r; }catch(e){ lines.push(`${name} FAIL ${e.message.slice(0,60)}`); }
  }

  fs.writeFileSync(FILE, JSON.stringify(last,null,2));
  if(IS_MANUAL){
    fs.writeFileSync(HB_FILE, Date.now().toString());
    await sendTG(`✅ V4 MANUAL (proxy forced)\n\n${lines.join('\n')}\n\nTime: ${new Date().toLocaleString('en-GB')}`);
  } else if(changes.length>0){
    await sendTG(changes.join('\n\n---\n\n'));
  }
})();
