const puppeteer = require('puppeteer');
const https = require('https');

const BOT_TOKEN = "8821796664:AAEghVepErTFj8iUcRDzdHZjAgCyDfcJjPM";
const CHAT_ID = "1737260357";
const WA_PHONE = "447508903111";
const WA_KEY = "2884665";

function sendTelegram(text) {
  const data = JSON.stringify({ chat_id: CHAT_ID, text: text });
  https.request({
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
  }, () => {}).end(data);
}

function sendWhatsApp(text) {
  const msg = encodeURIComponent(text.substring(0, 800));
  const path = `/whatsapp.php?phone=${WA_PHONE}&text=${msg}&apikey=${WA_KEY}`;
  https.get({ hostname: 'api.callmebot.com', path: path }, res => {
    let b=''; res.on('data', d=>b+=d);
    res.on('end', ()=> console.log("WA:", b));
  });
}

(async () => {
  console.log("Launching browser...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36');

  try {
    console.log("Going to Pokemon Center...");
    await page.goto('https://www.pokemoncenter.com/en-gb/collections/new-arrivals', { waitUntil: 'networkidle2', timeout: 60000 });

    const content = await page.content();
    console.log("Page length:", content.length);

    // Get product handles
    const products = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/products/"]'));
      return [...new Set(links.map(a => {
        const m = a.href.match(/\/products\/([a-z0-9-]+)/);
        return m? m[1] : null;
      }).filter(Boolean))];
    });

    console.log("Found products:", products.slice(0,5));

    if(products.length === 0){
      sendTelegram("⚠️ No products found. Page may be blocked.");
      await browser.close();
      return;
    }

    const latest = products[0];
    const message = `🔥 POKEMON DROP DETECTED!\n\n${latest}\nhttps://www.pokemoncenter.com/en-gb/products/${latest}\n\nTotal: ${products.length} new arrivals`;

    sendTelegram(message);
    sendWhatsApp(message);
    console.log("Sent:", message);

  } catch(e) {
    console.log("Error:", e.message);
    sendTelegram("Bot error: " + e.message.substring(0,200));
  }

  await browser.close();
})();
