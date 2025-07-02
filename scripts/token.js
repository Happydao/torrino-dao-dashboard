const axios = require('axios');
require('dotenv').config(); // Funziona anche su GitHub Actions se .env è usato localmente per test

// CONFIG
const WALLET_ADDRESS = "EKjb5grMX19c3cAZa5LQjqksDpqqVLTGZrswh79WkPdD";
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
if (!HELIUS_API_KEY) {
  console.error("❌ Variabile HELIUS_API_KEY mancante. Assicurati che sia impostata nei GitHub Secrets.");
  process.exit(1);
}

const JUPITER_API_URL = 'https://lite-api.jup.ag/price/v3?ids=';
const TIMEOUT = 10000; // 10s
const MAX_RETRIES = 3;
const RETRY_DELAY = 3000;

// Stablecoin riconosciute
const STABLE_TOKENS = {
  'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  'USDY': 'A1KLoBrKBde8Ty9qtNQUtq3C2ortoC3u7twggz7sEto6'
};

let totalTreasuryValue = 0;
let totalStableValue = 0;
let tokenValues = [];

function calculateRealAmount(amount, decimals) {
  return amount / Math.pow(10, decimals);
}

async function fetchWithRetry(url, config = {}) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await axios.get(url, { timeout: TIMEOUT, ...config });
    } catch (err) {
      console.warn(`⚠️ Tentativo ${attempt} fallito: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        await new Promise(res => setTimeout(res, RETRY_DELAY));
      } else {
        throw new Error(`❌ Errore persistente dopo ${MAX_RETRIES} tentativi`);
      }
    }
  }
}

async function getTokenAccounts() {
  try {
    console.log("🔄 Recupero token da Helius DAS API...");
    const url = `https://api.helius.xyz/v0/addresses/${WALLET_ADDRESS}/balances?api-key=${HELIUS_API_KEY}`;
    const response = await fetchWithRetry(url);

    const tokens = response.data.tokens
      .filter(token => token.amount > 1)
      .map(token => ({
        mint: token.mint,
        rawAmount: token.amount,
        realAmount: calculateRealAmount(token.amount, token.decimals),
        decimals: token.decimals,
        tokenName: token.name || 'Unknown'
      }))
      .sort((a, b) => b.realAmount - a.realAmount);

    console.log(`\n✅ Trovati ${tokens.length} token fungibili con più di 1 unità`);
    const allMints = tokens.map(t => t.mint).join(',');

    console.log("\n🌐 Richiesta prezzi da Jupiter (in batch)...");
    const priceResponse = await fetchWithRetry(`${JUPITER_API_URL}${allMints}`);
    const prices = priceResponse.data;

    console.log("");

    for (const token of tokens) {
      const priceData = prices[token.mint];

      if (priceData && priceData.usdPrice !== undefined) {
        const price = parseFloat(priceData.usdPrice);
        const tokenValue = token.realAmount * price;
        totalTreasuryValue += tokenValue;
        tokenValues.push({ mint: token.mint, value: tokenValue });

        if (Object.values(STABLE_TOKENS).includes(token.mint)) {
          totalStableValue += tokenValue;
          const stableName = Object.keys(STABLE_TOKENS).find(k => STABLE_TOKENS[k] === token.mint);
          console.log(`💵 Stablecoin ${stableName}: ${tokenValue.toFixed(2)} USD`);
        }

        console.log(`✅ ${token.tokenName} (${token.mint})`);
        console.log(`   Quantità: ${token.realAmount.toLocaleString('en-US', { maximumFractionDigits: 6 })}`);
        console.log(`   Prezzo: ${price.toFixed(6)} USD`);
        console.log(`   Totale: ${tokenValue.toFixed(2)} USD\n`);
      } else {
        console.log(`⚠️ Nessun prezzo disponibile per ${token.tokenName} (${token.mint})`);
      }
    }

    console.log(`\n📋 RIEPILOGO VALORI TOKEN:`);
    tokenValues.forEach(({ mint, value }) => {
      console.log(`${mint} - ${value.toFixed(2)} USD`);
    });

    console.log(`\n💰 VALORE TOTALE TESORERIA: ${totalTreasuryValue.toFixed(2)} USD`);
    console.log(`💵 VALORE TOTALE STABLECOIN: ${totalStableValue.toFixed(2)} USD`);
    console.log("\n" + JSON.stringify({
      totaltokenvalue: totalTreasuryValue,
      totalstablevalue: totalStableValue
    }));

  } catch (error) {
    console.error("❌ Errore durante l'esecuzione:", error.message);
    process.exit(1);
  }
}

getTokenAccounts();
