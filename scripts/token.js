'use strict';

const axios = require('axios');
require('dotenv').config(); // usa .env in locale; su GitHub Actions userai i Secrets

// ========= CONFIG =========
const WALLET_ADDRESS =
  process.env.WALLET_ADDRESS || 'EKjb5grMX19c3cAZa5LQjqksDpqqVLTGZrswh79WkPdD';
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
if (!HELIUS_API_KEY) {
  console.error('❌ HELIUS_API_KEY is missing. Set it in .env or GitHub Secrets.');
  process.exit(1);
}

const TIMEOUT = Number(process.env.TIMEOUT_MS || 10000);
const MAX_RETRIES = Number(process.env.MAX_RETRIES || 3);
const RETRY_DELAY = Number(process.env.RETRY_DELAY_MS || 3000);

// Prezzi
const JUPITER_API_URL = 'https://lite-api.jup.ag/price/v3?ids=';
const LLAMA_API_BASE = 'https://coins.llama.fi/prices/current/';

// Liste token (nomi/simboli)
const JUP_TOKENLIST_URL = 'https://tokens.jup.ag/tokens?all=true';
const SOLANA_TOKENLIST_URL =
  'https://raw.githubusercontent.com/solana-labs/token-list/main/src/tokens/solana.tokenlist.json';

// WSOL (per prezzo SOL)
const WSOL_MINT = 'So11111111111111111111111111111111111111112';

// Stablecoin riconosciute
const STABLE_TOKENS = {
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  USDY: 'A1KLoBrKBde8Ty9qtNQUtq3C2ortoC3u7twggz7sEto6',
};

// ========= STATE =========
let totalTreasuryValue = 0;
let totalStableValue = 0;
let tokenValues = []; // { mint, value, name, symbol }

// ========= UTILS =========
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function calculateRealAmount(amount, decimals) {
  return amount / Math.pow(10, decimals);
}

async function fetchWithRetry(url, config = {}) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await axios.get(url, { timeout: TIMEOUT, ...config });
    } catch (err) {
      console.warn(`⚠️ GET attempt ${attempt} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY);
      else throw new Error(`❌ Persistent error after ${MAX_RETRIES} attempts (GET)`);
    }
  }
}

async function postWithRetry(url, body, config = {}) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await axios.post(url, body, { timeout: TIMEOUT, ...config });
    } catch (err) {
      console.warn(`⚠️ POST attempt ${attempt} failed: ${err.message}`);
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY);
      else throw new Error(`❌ Persistent error after ${MAX_RETRIES} attempts (POST)`);
    }
  }
}

function chunk(array, size) {
  const out = [];
  for (let i = 0; i < array.length; i += size) out.push(array.slice(i, i + size));
  return out;
}

// ========== PREZZI ==========
function normalizeJupiterPrices(respData) {
  const raw = respData?.data ?? respData ?? {};
  const out = {};
  for (const [mint, o] of Object.entries(raw)) {
    const usdPrice = o?.usdPrice ?? o?.price ?? o?.data?.price ?? o?.medianPrice;
    if (usdPrice !== undefined && usdPrice !== null) {
      out[mint] = { usdPrice: Number(usdPrice) };
    }
  }
  return out;
}

async function fetchJupiterPricesBatch(mints) {
  if (!mints.length) return {};
  const CHUNK_SIZE = 200; // prudenziale
  const chunks = chunk(mints, CHUNK_SIZE);
  let all = {};
  for (const c of chunks) {
    const url = `${JUPITER_API_URL}${c.join(',')}`;
    const res = await fetchWithRetry(url);
    all = { ...all, ...normalizeJupiterPrices(res.data) };
  }
  return all;
}

// DeFiLlama batch: coins.llama.fi/prices/current/solana:<mint1>,solana:<mint2>
async function fetchLlamaPrices(mints = []) {
  if (!mints.length) return {};
  const CHUNK_SIZE = 100;
  const chunks = chunk(mints, CHUNK_SIZE);
  let all = {};
  for (const c of chunks) {
    const coinsParam = c.map((m) => `solana:${m}`).join(',');
    const url = `${LLAMA_API_BASE}${coinsParam}`;
    const res = await fetchWithRetry(url);
    const coins = res.data?.coins ?? {};
    for (const [key, v] of Object.entries(coins)) {
      const mint = key.split(':')[1];
      if (v?.price != null) all[mint] = { usdPrice: Number(v.price) };
    }
  }
  return all;
}

// Se restano fuori stable note, assegna 1.00 USD
function addStableParities(pricesMap) {
  const out = { ...pricesMap };
  for (const mint of Object.values(STABLE_TOKENS)) {
    if (!out[mint]) out[mint] = { usdPrice: 1.0 };
  }
  return out;
}

// ========== METADATA (nomi/simboli) ==========
async function fetchJupTokenlistMap() {
  try {
    const res = await fetchWithRetry(JUP_TOKENLIST_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 Node Script' },
    });
    const arr = Array.isArray(res.data) ? res.data : [];
    const map = new Map();
    for (const t of arr) {
      if (t?.address) {
        map.set(t.address, {
          symbol: t.symbol || null,
          name: t.name || null,
          decimals: typeof t.decimals === 'number' ? t.decimals : null,
        });
      }
    }
    return map;
  } catch (e) {
    console.warn('⚠️ Impossibile scaricare Jupiter token list:', e.message);
    return new Map();
  }
}

async function fetchSolanaLabsTokenlistMap() {
  try {
    const res = await fetchWithRetry(SOLANA_TOKENLIST_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 Node Script' },
    });
    const tokens = Array.isArray(res.data?.tokens) ? res.data.tokens : [];
    const map = new Map();
    for (const t of tokens) {
      if (t?.address) {
        map.set(t.address, {
          symbol: t.symbol || null,
          name: t.name || null,
          decimals: typeof t.decimals === 'number' ? t.decimals : null,
        });
      }
    }
    return map;
  } catch (e) {
    console.warn('⚠️ Impossibile scaricare Solana Labs token list:', e.message);
    return new Map();
  }
}

// Helius token metadata (fallback batch)
async function fetchHeliusTokenMetaMap(mints = []) {
  const map = new Map();
  if (!mints.length) return map;

  const CHUNK_SIZE = 200;
  const chunks = chunk(mints, CHUNK_SIZE);
  for (const c of chunks) {
    try {
      const url = `https://api.helius.xyz/v0/token-metadata?api-key=${HELIUS_API_KEY}`;
      const body = { mintAccounts: c };
      const res = await postWithRetry(url, body, {
        headers: { 'Content-Type': 'application/json' },
      });
      const arr = Array.isArray(res.data) ? res.data : [];
      for (const it of arr) {
        const mint = it?.mint ?? it?.account ?? it?.tokenAddress;
        if (!mint) continue;
        const name =
          it?.name ||
          it?.onChainMetadata?.metadata?.data?.name ||
          it?.offChainMetadata?.metadata?.name ||
          null;
        const symbol =
          it?.symbol ||
          it?.onChainMetadata?.metadata?.data?.symbol ||
          it?.offChainMetadata?.metadata?.symbol ||
          null;
        if (name || symbol) {
          map.set(mint, { name: name || null, symbol: symbol || null });
        }
      }
    } catch (e) {
      console.warn('⚠️ Helius token-metadata fallback fallito:', e.message);
    }
  }
  return map;
}

// Costruisce mappa nomi/simboli: Jupiter > SolanaLabs > Helius > fix manuali
async function buildTokenMetaMap(allMints) {
  const finalMap = new Map();

  const jupMap = await fetchJupTokenlistMap();
  jupMap.forEach((v, k) => finalMap.set(k, v));

  const solMap = await fetchSolanaLabsTokenlistMap();
  solMap.forEach((v, k) => {
    if (!finalMap.has(k)) finalMap.set(k, v);
  });

  // Fix manuali minimi utili
  finalMap.set(STABLE_TOKENS.USDC, { name: 'USD Coin', symbol: 'USDC' });
  finalMap.set(STABLE_TOKENS.USDT, { name: 'Tether USD', symbol: 'USDT' });
  finalMap.set(STABLE_TOKENS.USDY, { name: 'Ondo US Dollar Yield', symbol: 'USDY' });
  finalMap.set(WSOL_MINT, { name: 'Wrapped SOL', symbol: 'WSOL' });

  // Helius per i rimanenti
  const missing = allMints.filter((m) => !finalMap.has(m));
  if (missing.length) {
    const heliusMap = await fetchHeliusTokenMetaMap(missing);
    heliusMap.forEach((v, k) => {
      if (!finalMap.has(k)) finalMap.set(k, v);
    });
  }

  return finalMap;
}

function getNiceNameSymbol(mint, fallbackName, metaMap) {
  const meta = metaMap.get(mint) || {};
  const name = meta.name || fallbackName || 'Unknown';
  const symbol = meta.symbol || null;
  return { name, symbol };
}

// ========== HELIUS / RPC ==========
async function fetchBalancesFromHelius(address) {
  const url = `https://api.helius.xyz/v0/addresses/${address}/balances?api-key=${HELIUS_API_KEY}`;
  return fetchWithRetry(url);
}

async function fetchNativeSolViaRpc(address) {
  const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
  const body = {
    jsonrpc: '2.0',
    id: 1,
    method: 'getBalance',
    params: [address, { commitment: 'processed' }],
  };
  const res = await postWithRetry(rpcUrl, body, {
    headers: { 'Content-Type': 'application/json' },
  });
  const lamports = res?.data?.result?.value ?? 0;
  return lamports / 1e9; // SOL
}

// ========== MAIN ==========
async function getTokenAccounts() {
  try {
    console.log('🔄 Fetching tokens from Helius DAS API...');
    const response = await fetchBalancesFromHelius(WALLET_ADDRESS);

    const tokens = (response.data.tokens || [])
      .filter((t) => t.amount > 1) // lasciato invariato
      .map((t) => ({
        mint: t.mint,
        rawAmount: t.amount,
        realAmount: calculateRealAmount(t.amount, t.decimals),
        decimals: t.decimals,
        tokenName: t.name || 'Unknown',
      }))
      .sort((a, b) => b.realAmount - a.realAmount);

    // === SOL nativo ===
    let nativeLamports =
      response.data?.nativeBalance?.lamports ??
      response.data?.nativeBalance?.amount ??
      response.data?.lamports ??
      0;
    let nativeSOL = nativeLamports ? nativeLamports / 1e9 : 0;
    if (!nativeSOL) {
      console.log('ℹ️ Balance SOL non presente nella risposta balances: uso RPC…');
      nativeSOL = await fetchNativeSolViaRpc(WALLET_ADDRESS);
    }

    console.log(`\n✅ Trovati ${tokens.length} token fungibili con più di 1 unità`);

    // === Meta map (nomi/simboli) ===
    const allMints = tokens.map((t) => t.mint);
    if (!allMints.includes(WSOL_MINT)) allMints.push(WSOL_MINT);
    const metaMap = await buildTokenMetaMap(allMints);

    // === Prezzi ===
    console.log('\n🌐 Richiesta prezzi da Jupiter (batch)…');
    let prices = await fetchJupiterPricesBatch(allMints);

    const missing = allMints.filter((m) => !prices[m]);
    if (missing.length) {
      console.log(`🔁 Fallback to DeFiLlama for ${missing.length} tokens without price…`);
      const llama = await fetchLlamaPrices(missing);
      Object.keys(llama).forEach((m) =>
        console.log(`   ↳ DeFiLlama: ${m} → ${llama[m].usdPrice} USD`)
      );
      prices = { ...prices, ...llama };
    }
    prices = addStableParities(prices);
    console.log('');

    // === Calcolo valori per token SPL ===
    for (const token of tokens) {
      const priceData = prices[token.mint];

      if (priceData && priceData.usdPrice !== undefined) {
        const price = Number(priceData.usdPrice);
        const tokenValue = token.realAmount * price;
        totalTreasuryValue += tokenValue;

        const meta = getNiceNameSymbol(token.mint, token.tokenName, metaMap);
        tokenValues.push({
          mint: token.mint,
          value: tokenValue,
          name: meta.name,
          symbol: meta.symbol,
        });

        if (Object.values(STABLE_TOKENS).includes(token.mint)) {
          totalStableValue += tokenValue;
          const stableName = Object.keys(STABLE_TOKENS).find(
            (k) => STABLE_TOKENS[k] === token.mint
          );
          console.log(`💵 Stablecoin ${stableName}: ${tokenValue.toFixed(2)} USD`);
        }

        const label = meta.symbol ? `${meta.name} (${meta.symbol})` : `${meta.name}`;
        console.log(`✅ ${label} [${token.mint}]`);
        console.log(
          `   Amount: ${token.realAmount.toLocaleString('en-US', { maximumFractionDigits: 6 })}`
        );
        console.log(`   Price: ${price.toFixed(6)} USD`);
        console.log(`   Total: ${tokenValue.toFixed(2)} USD\n`);
      } else {
        const meta = getNiceNameSymbol(token.mint, token.tokenName, metaMap);
        const label = meta.symbol ? `${meta.name} (${meta.symbol})` : `${meta.name}`;
        console.log(`⚠️ No price available for ${label} [${token.mint}]`);
      }
    }

    // === Aggiungi SOL nativo (prezzo WSOL) ===
    if (nativeSOL > 0) {
      const solPrice = prices[WSOL_MINT]?.usdPrice;
      if (solPrice !== undefined) {
        const solValue = nativeSOL * Number(solPrice);
        totalTreasuryValue += solValue;

        tokenValues.push({
          mint: 'SOL',
          value: solValue,
          name: 'Solana',
          symbol: 'SOL',
        });

        console.log(`✅ SOL (native)`);
        console.log(
          `   Amount: ${nativeSOL.toLocaleString('en-US', { maximumFractionDigits: 6 })}`
        );
        console.log(`   Price: ${Number(solPrice).toFixed(6)} USD`);
        console.log(`   Total: ${solValue.toFixed(2)} USD\n`);
      } else {
        console.log('⚠️ SOL price not available (WSOL).');
      }
    }

    // === Riepilogo ===
    console.log(`\n📋 TOKEN VALUE SUMMARY:`);
    tokenValues.forEach(({ mint, value, name, symbol }) => {
      const label = symbol ? `${name} (${symbol})` : name;
      console.log(`${mint} - ${label} - ${value.toFixed(2)} USD`);
    });

    console.log(`\n💰 TOTAL TREASURY VALUE: ${totalTreasuryValue.toFixed(2)} USD`);
    console.log(`💵 TOTAL STABLECOIN VALUE: ${totalStableValue.toFixed(2)} USD`);
    // ⚠️ JSON finale: formato identico al tuo script originale
    console.log(
      '\n' +
        JSON.stringify({
          totaltokenvalue: totalTreasuryValue,
          totalstablevalue: totalStableValue,
        })
    );
  } catch (error) {
    console.error("❌ Error during execution:", error.message);
    process.exit(1);
  }
}

getTokenAccounts();
