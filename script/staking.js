const fetch = require("node-fetch");
require("dotenv").config();

// Configurazione
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const WALLET_ADDRESS = "EKjb5grMX19c3cAZa5LQjqksDpqqVLTGZrswh79WkPdD";
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const JUPITER_API_URL = "https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112";

const MAX_RETRIES = 5; // Numero massimo di tentativi per API
const RETRY_DELAY = 3000; // Ritardo tra i tentativi in ms
const TIMEOUT = 10000; // Timeout API in ms

// Funzione per effettuare chiamate API con timeout
const fetchWithTimeout = (url, options = {}, timeout = TIMEOUT) => {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error("⏳ Timeout API")), timeout)
        ),
    ]);
};

// Funzione con retry automatico
const fetchWithRetry = async (url, options, maxRetries = MAX_RETRIES, delay = RETRY_DELAY) => {
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

// Recupera il prezzo attuale di SOL
const getSolPrice = async () => {
    try {
        const data = await fetchWithRetry(JUPITER_API_URL, {});
        return data?.data?.["So11111111111111111111111111111111111111112"]?.price || 0;
    } catch (error) {
        console.error("❌ Errore nel recupero del prezzo di SOL:", error.message);
        return 0;
    }
};

// Recupera gli account staking da Helius con retry
const getStakedTokenAccounts = async () => {
    console.log("🔄 Recupero stake accounts da Helius...");
    const solPrice = await getSolPrice();

    const requestBody = JSON.stringify({
        jsonrpc: "2.0",
        id: "helius-test",
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
        console.log(JSON.stringify({ totalStakedValue: 0 }));
        return 0;
    }

    let totalStakedValue = 0;
    console.log("📜 Token in staking:");
    for (const stakeAccount of data.result) {
        const stakeAmountLamports = stakeAccount.account?.lamports;
        const stakeAmountSOL = stakeAmountLamports ? stakeAmountLamports / 1e9 : null;
        const validator = stakeAccount.account?.data?.parsed?.info?.stake?.delegation?.voter;

        if (!stakeAmountSOL || !validator) continue;

        const stakeValueUSD = stakeAmountSOL * solPrice;
        totalStakedValue += stakeValueUSD;

        console.log(`🔹 Stake Account: ${stakeAccount.pubkey}`);
        console.log(`   Quantità stakata: ${stakeAmountSOL.toFixed(4)} SOL`);
        console.log(`   Valore in USD: $${stakeValueUSD.toFixed(2)}`);
        console.log(`   Delegato a: ${validator}\n`);
    }

    console.log(`💰 Valore totale stakato: $${totalStakedValue.toFixed(2)} USD`);
    console.log(JSON.stringify({ totalStakedValue }));
    return totalStakedValue;
};

// Esegui solo il calcolo dello staking
getStakedTokenAccounts()
    .then(() => {
        console.log("\n🔹 Processo di staking completato!");
    })
    .catch((error) => {
        console.error("❌ Errore durante il recupero dello staking:", error);
    });
