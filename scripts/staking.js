const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
require("dotenv").config();

// Configurazione
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const WALLET_ADDRESS = "EKjb5grMX19c3cAZa5LQjqksDpqqVLTGZrswh79WkPdD";
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const SOL_MINT = "So11111111111111111111111111111111111111112";
const JUPITER_API_URL = `https://lite-api.jup.ag/price/v3?ids=${SOL_MINT}`;

const DATA_FILE_PATH = path.join(__dirname, '..', 'data2.json');

const MAX_RETRIES = 5;
const RETRY_DELAY = 3000;
const TIMEOUT = 10000;

const fetchWithTimeout = (url, options = {}, timeout = TIMEOUT) => {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) => setTimeout(() => reject(new Error("⏳ Timeout API")), timeout)),
  ]);
};

const fetchWithRetry = async (url, options = {}, maxRetries = MAX_RETRIES, delay = RETRY_DELAY) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options);
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`⚠️ Errore API (tentativo ${attempt}/${maxRetries}):`, error.message);
      if (attempt < maxRetries) {
        console.log(`⏳ Ritento tra ${delay / 1000} secondi...`);
        await new Promise(res => setTimeout(res, delay));
      } else {
        console.error(`❌ Fallimento API dopo ${maxRetries} tentativi.`);
      }
    }
  }
  return null;
};

const getSolPrice = async () => {
  try {
    const data = await fetchWithRetry(JUPITER_API_URL);
    return data?.[SOL_MINT]?.usdPrice || 0;
  } catch (error) {
    console.error("❌ Errore nel recupero del prezzo di SOL:", error.message);
    return 0;
  }
};

const getStakedTokenAccounts = async () => {
  console.log("🔄 Recupero stake accounts da Helius...");
  const solPrice = await getSolPrice();

  const requestBody = JSON.stringify({
    jsonrpc: "2.0",
    id: "helius-stake",
    method: "getProgramAccounts",
    params: [
      "Stake11111111111111111111111111111111111111",
      {
        encoding: "jsonParsed",
        filters: [
          {
            memcmp: {
              offset: 12,
              bytes: WALLET_ADDRESS,
            },
          },
        ],
      },
    ],
  });

  const data = await fetchWithRetry(HELIUS_RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: requestBody,
  });

  if (!data || !data.result || data.result.length === 0) {
    console.log("✅ Nessun token in staking trovato.");
    updateData2Json(0);
    return 0;
  }

  let totalStakedValue = 0;
  console.log("📜 Token in staking:");

  for (const stakeAccount of data.result) {
    const lamports = stakeAccount.account?.lamports;
    const solAmount = lamports ? lamports / 1e9 : null;
    const validator = stakeAccount.account?.data?.parsed?.info?.stake?.delegation?.voter;

    if (!solAmount || !validator) continue;

    const usdValue = solAmount * solPrice;
    totalStakedValue += usdValue;

    console.log(`🔹 Stake Account: ${stakeAccount.pubkey}`);
    console.log(`   Quantità stakata: ${solAmount.toFixed(4)} SOL`);
    console.log(`   Valore in USD: $${usdValue.toFixed(2)}`);
    console.log(`   Delegato a: ${validator}\n`);
  }

  console.log(`💰 Valore totale stakato: $${totalStakedValue.toFixed(2)} USD`);
  updateData2Json(totalStakedValue);
  return totalStakedValue;
};

function updateData2Json(stakedValue) {
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

  existingData.totalstakingvalue = stakedValue;

  try {
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(existingData, null, 2));
    console.log("✅ data2.json aggiornato con valore staking.");
  } catch (err) {
    console.error("❌ Errore nella scrittura di data2.json:", err.message);
  }
}

getStakedTokenAccounts()
  .then(() => console.log("\n🔹 Processo di staking completato!"))
  .catch((error) => {
    console.error("❌ Errore durante il recupero dello staking:", error.message);
    process.exit(1);
  });
