// ====== GEREKLİ MODÜLLER ======
const https = require("https");
const fetch = require("node-fetch");
const HttpsProxyAgent = require("https-proxy-agent");

// ====== PROXY AYARI ======
const PROXY = "http://72.10.164.178:28247"; 
const proxyAgent = new HttpsProxyAgent(PROXY);

// ====== BOT AYARLARI ======
const BOT_TOKEN = "BOT TOKENI GIR "; // <-- Bot token buraya
const MY_GUILD_ID = "ID"; // Botun linki ekleyeceği sunucu
const MY_CHANNEL_ID = "ID"; // Opsiyonel log kanalı
const BOT_WEBHOOK = "https LINK "; // Bot HTTP listener

// ====== USER TOKEN ======
const USER_TOKEN = "USER_TOKEN_HERE"; // Tek user token

// ====== BİLİNEN LINKLER ======
const knownInvites = new Map(); // key: guildID, value: invite

// ====== USER TOKEN FONKSİYONLARI ======
async function sendLinkToBot(guildId, link) {
  await fetch(BOT_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ guildId, invite: link }),
    agent: proxyAgent
  });
}


async function getGuildInvites(GUILD_ID, CHANNEL_ID) {
  const data = JSON.stringify({ max_age: 0, max_uses: 0, temporary: false });
  const options = {
    hostname: "discord.com",
    path: `/api/v10/guilds/${GUILD_ID}/channels/${CHANNEL_ID}/invites`,
    method: "POST",
    headers: {
      "Authorization": USER_TOKEN,
      "Content-Type": "application/json",
      "Content-Length": data.length
    },
    agent: proxyAgent
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          const inviteLink = json.code ? `https://discord.gg/${json.code}` : null;
          resolve(inviteLink);
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// ====== BOT FONKSİYONU ======
async function useOldInviteOnMyServer(inviteLink) {
  const inviteCode = inviteLink.split("/").pop();
  const data = JSON.stringify({ max_age: 0, max_uses: 0, temporary: false });

  const options = {
    hostname: "discord.com",
    path: `/api/v10/invites/${inviteCode}`,
    method: "POST",
    headers: {
      "Authorization": `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json",
      "Content-Length": data.length
    },
    agent: proxyAgent
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let body = "";
      res.on("data", chunk => body += chunk);
      res.on("end", () => resolve(body));
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

// ====== BOT WEBHOOK LISTENER ======
const http = require("http");
http.createServer(async (req, res) => {
  if (req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      const { guildId, invite } = JSON.parse(body);

      const oldInvite = knownInvites.get(guildId);

      if (!oldInvite) {
        knownInvites.set(guildId, invite);
        console.log(`[BOT] Başlangıçta URL alındı: ${invite}`);
      } else if (oldInvite !== invite) {
        console.log(`[BOT] Link değişti! Eski: ${oldInvite}, Yeni: ${invite}`);
        await useOldInviteOnMyServer(oldInvite); // eski linki kendi sunucuna uygula
        knownInvites.set(guildId, invite);
      }

      res.writeHead(200);
      res.end("OK");
    });
  }
}).listen(3000, () => console.log("[BOT] Webhook listener 3000 portunda çalışıyor..."));

// ====== SUNUCULARI KONTROL ======
const SERVERS = [
  { GUILD_ID: "SUNUCU_ID_1", CHANNEL_ID: "KANAL_ID_1" },// <-- Takip edilecek sunucu ve kanal ID'leri
  { GUILD_ID: "SUNUCU_ID_2", CHANNEL_ID: "KANAL_ID_2" } // <-- Takip edilecek sunucu ve kanal ID'leri
];

// ====== BAŞLANGIÇTA MEVCUT LINKLERİ AL ======
(async () => {
  for (const s of SERVERS) {
    const invite = await getGuildInvites(s.GUILD_ID, s.CHANNEL_ID);
    if (invite) {
      knownInvites.set(s.GUILD_ID, invite);
      await fetch(BOT_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: `[LOG] Başlangıçta aldım: ${invite}` }),
        agent: proxyAgent
      });
      console.log(`[USER] Başlangıç link alındı: ${invite}`);
    }
  }
})();

// ====== SONRAKİ DEĞİŞİKLİKLERİ KONTROL ======
setInterval(async () => {
  for (const s of SERVERS) {
    const invite = await getGuildInvites(s.GUILD_ID, s.CHANNEL_ID);
    if (!invite) continue;

    const oldInvite = knownInvites.get(s.GUILD_ID);
    if (oldInvite && oldInvite !== invite) {
      knownInvites.set(s.GUILD_ID, invite);
      await fetch(BOT_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: `[LOG] URL değişti, aldım: ${invite}` }),
        agent: proxyAgent
      });
      console.log(`[USER] URL değişti, aldım: ${invite}`);
    }
  }
}, 10000);
