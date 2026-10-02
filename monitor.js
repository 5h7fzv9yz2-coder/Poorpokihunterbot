const https = require('https');
const WA_PHONE = "447508903111";
const WA_KEY = "2884665";

function sendWhatsApp(text) {
  const msg = encodeURIComponent(text);
  const path = `/whatsapp.php?phone=${WA_PHONE}&text=${msg}&apikey=${WA_KEY}`;
  console.log("Calling:", path);
  https.get({ hostname: 'api.callmebot.com', path: path }, res => {
    let b=''; res.on('data', d=>b+=d);
    res.on('end', ()=> console.log("RESULT:", b));
  }).on('error', e=>console.log("ERROR:", e.message));
}

sendWhatsApp("Test from GitHub - if you get this on WhatsApp, your key works!");
