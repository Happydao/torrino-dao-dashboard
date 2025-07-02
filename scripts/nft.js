const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
require("dotenv").config();

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const WALLET_ADDRESS = "EKjb5grMX19c3cAZa5LQjqksDpqqVLTGZrswh79WkPdD";
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const MAGIC_EDEN_API_BASE = "https://api-mainnet.magiceden.dev/v2";
const COINGECKO_API = "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd";

const REQUEST_DELAY_MAGICEDEN = 5000;
const REQUEST_DELAY_HELIUS = 4000;
const PAGE_LIMIT = 100;
const DATA_FILE_PATH = path.join(__dirname, '..', 'data2.json');

let totalNFTValue = 0;

const scamNFTs = new Set([ /* ... stesso elenco ... */ ]);

const fetchWithTimeout = (url, options = {}, timeout = 10000) => {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) => setTimeout(() => reject(new Error("⏳ Timeout API")), timeout)),
  ]);
};

const fetchWithRetry = async (url, options = {}, maxRetries = 5, delay = 3000) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options);
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`⚠️ Errore API: ${error.message} (Tentativo ${attempt}/${maxRetries})`);
      if (attempt < maxRetries) await new Promise(res => setTimeout(res, delay));
    }
  }
  return null;
};

const getNFTsFromHelius = async () => {
  console.log("🔄 Recupero NFT dal wallet con Helius...");
  let page = 1, nftList = [];

  while (true) {
    console.log(`📜 Recupero pagina ${page}...`);

    const data = await fetchWithRetry(HELIUS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "helius-nft-test",
        method: "getAssetsByOwner",
        params: { ownerAddress: WALLET_ADDRESS, page, limit: PAGE_LIMIT }
      }),
    });

    if (!data?.result?.items || data.result.items.length === 0) break;

    data.result.items.forEach(nft => {
      const mint = nft.id;
      const name = nft.content?.metadata?.name || "Sconosciuto";
      if (!scamNFTs.has(name)) {
        console.log(`✅ NFT valido trovato: ${name} (${mint})`);
        nftList.push({ mint, name });
      } else {
        console.log(`🚫 Scam ignorato: ${name} (${mint})`);
      }
    });

    page++;
    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_HELIUS));
  }

  return nftList;
};

const getSolPrice = async () => {
  const data = await fetchWithRetry(COINGECKO_API);
  return data?.solana?.usd || 0;
};

const updateData2Json = (nftValue) => {
  let existingData = {
    totaltokenvalue: 0,
    totalstablevalue: 0,
    totalstakingvalue: 0,
    totalnftvalue: 0
  };

  try {
    if (fs.existsSync(DATA_FILE_PATH)) {
      const content = fs.readFileSync(DATA_FILE_PATH, 'utf8');
      existingData = JSON.parse(content);
    }
  } catch (err) {
    console.warn("⚠️ Impossibile leggere data2.json esistente, verrà sovrascritto.");
  }

  existingData.totalnftvalue = nftValue;

  try {
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(existingData, null, 2));
    console.log("✅ data2.json aggiornato con valore NFT.");
  } catch (err) {
    console.error("❌ Errore nella scrittura di data2.json:", err.message);
  }
};

const analyzeNFTs = async () => {
  const nfts = await getNFTsFromHelius();
  let totalSolValue = 0;

  if (nfts.length === 0) return console.log("🚫 Nessun NFT da analizzare.");

  for (const nft of nfts) {
    const meta = await fetchWithRetry(`${MAGIC_EDEN_API_BASE}/tokens/${nft.mint}`);
    if (!meta?.collection) continue;

    const stats = await fetchWithRetry(`${MAGIC_EDEN_API_BASE}/collections/${meta.collection}/stats`);
    const floor = stats?.floorPrice ? stats.floorPrice / 1e9 : 0;

    if (floor > 0) {
      totalSolValue += floor;
      console.log(`📝 NFT: ${nft.name} | Collezione: ${meta.collection} | Floor: ${floor.toFixed(4)} SOL`);
    }

    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MAGICEDEN));
  }

  const solPrice = await getSolPrice();
  totalNFTValue = totalSolValue * solPrice;

  console.log("\n💎 **Riepilogo** 💎");
  console.log(`📊 Valore totale in SOL: ${totalSolValue.toFixed(4)} SOL`);
  console.log(`💰 Valore totale in USD: $${totalNFTValue.toFixed(2)}`);
};

analyzeNFTs()
  .then(() => {
    totalNFTValue = isNaN(totalNFTValue) ? 0 : totalNFTValue;
    console.log(`\n🔹 Valore registrato in totalNFTValue: $${totalNFTValue.toFixed(2)}`);
    updateData2Json(totalNFTValue);
  })
  .catch((error) => {
    console.error("❌ Errore durante l'analisi degli NFT:", error);
    updateData2Json(0);
  });
