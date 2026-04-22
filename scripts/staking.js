const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Configurazione
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const WALLET_ADDRESS = "EKjb5grMX19c3cAZa5LQjqksDpqqVLTGZrswh79WkPdD";
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const SOL_MINT = "So11111111111111111111111111111111111111112";
const JUPITER_API_URL = `https://lite-api.jup.ag/price/v3?ids=${SOL_MINT}`;

const MAX_RETRIES = 5;
const RETRY_DELAY = 3000;
const TIMEOUT = 10000;
const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const STAKING_DATA_PATH = path.join(DATA_DIR, "staking.json");

const writeJsonFile = (filePath, payload) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
};

// Fetch con timeout
const fetchWithTimeout = (url, options = {}, timeout = TIMEOUT) => {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("⏳ Timeout API")), timeout)
    ),
  ]);
};

// Fetch con retry automatico
const fetchWithRetry = async (url, options = {}, maxRetries = MAX_RETRIES, delay = RETRY_DELAY) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options);
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`⚠️ API error (attempt ${attempt}/${maxRetries}):`, error.message);
      if (attempt < maxRetries) {
        console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
        await new Promise(res => setTimeout(res, delay));
      } else {
        console.error(`❌ API failed after ${maxRetries} attempts.`);
      }
    }
  }
  return null;
};

// Prezzo SOL via Jupiter
const getSolPrice = async () => {
  try {
    const data = await fetchWithRetry(JUPITER_API_URL);
    return data?.[SOL_MINT]?.usdPrice || 0;
  } catch (error) {
    console.error("❌ Error fetching SOL price:", error.message);
    return 0;
  }
};

// Dati staking via Helius
const getStakedTokenAccounts = async () => {
  console.log("🔄 Fetching stake accounts from Helius...");
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
    console.log("✅ No staked tokens found.");
    writeJsonFile(STAKING_DATA_PATH, {
      updatedAt: new Date().toISOString(),
      wallet: WALLET_ADDRESS,
      solPriceUsd: solPrice,
      totalStakedSol: 0,
      totalStakedValue: 0,
      positions: [],
    });
    console.log(JSON.stringify({ totalStakedValue: 0 }));
    return 0;
  }

  let totalStakedValue = 0;
  let totalStakedSol = 0;
  const positions = [];
  console.log("📜 Staked tokens:");

  for (const stakeAccount of data.result) {
    const lamports = stakeAccount.account?.lamports;
    const solAmount = lamports ? lamports / 1e9 : null;
    const validator = stakeAccount.account?.data?.parsed?.info?.stake?.delegation?.voter;

    if (!solAmount || !validator) continue;

    const usdValue = solAmount * solPrice;
    totalStakedValue += usdValue;
    totalStakedSol += solAmount;

    positions.push({
      stakeAccount: stakeAccount.pubkey,
      amountSol: solAmount,
      priceUsd: solPrice,
      valueUsd: usdValue,
      validator,
    });

    console.log(`🔹 Stake Account: ${stakeAccount.pubkey}`);
    console.log(`   Staked amount: ${solAmount.toFixed(4)} SOL`);
    console.log(`   USD value: $${usdValue.toFixed(2)}`);
    console.log(`   Delegated to: ${validator}\n`);
  }

  writeJsonFile(STAKING_DATA_PATH, {
    updatedAt: new Date().toISOString(),
    wallet: WALLET_ADDRESS,
    solPriceUsd: solPrice,
    totalStakedSol,
    totalStakedValue,
    positions: positions.sort((a, b) => b.valueUsd - a.valueUsd),
  });
  console.log(`✅ Detailed staking data saved to ${path.relative(ROOT_DIR, STAKING_DATA_PATH)}`);

  console.log(`💰 Total staked value: $${totalStakedValue.toFixed(2)} USD`);
  console.log(JSON.stringify({ totalStakedValue }));
  return totalStakedValue;
};

// Avvia lo script
getStakedTokenAccounts()
  .then(() => console.log("\n🔹 Staking process completed!"))
  .catch((error) => {
    console.error("❌ Error fetching staking data:", error.message);
    process.exit(1);
  });
