const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const WALLET_ADDRESS = "EKjb5grMX19c3cAZa5LQjqksDpqqVLTGZrswh79WkPdD";
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const MAGIC_EDEN_API_BASE = "https://api-mainnet.magiceden.dev/v2";
const COINGECKO_API = "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd";

const REQUEST_DELAY_MAGICEDEN = 5000;
const REQUEST_DELAY_HELIUS = 4000;
const PAGE_LIMIT = 100;
const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const NFT_DATA_PATH = path.join(DATA_DIR, "nfts.json");
let totalNFTValue = 0;

const scamNFTs = new Set([
    
    "MonkeDAO Loot Box", "Follow @SlerfPFPs", "Claim your 5000WIF", "By sol-drift.com",
    "JUP.RED PASS", "A WOLF#2203", "RAYD.PROMO Luxury Pass", "BACKPACK.PICS PASS",
    "JUPS.io Token Box", "A WOLF #211", "AB Rare #1", "100 SOL JUPDAO.COM",
    "FOLLOW @SlerfPFPs", "$PENGU AIRDROP", "Drop Pass", "LADS USE SOLANA.FM",
    "MFI.EXPERT PASS", "3000$ WIF Drop 3000WIF.com", "2400JUP Lucky Box JUPCASE.io",
    "v.watch", "Claim your 5000WIF", "Mitya", "MonkeDAO Loot Box",
    "Claim your 5000WIF", "1000$ BOME Drop BOMEDROP.com", "100SOL mnde.network",
    "MonkeDAO Loot Box", "Mad Lads Loot Box", "Tensorians Week", "JUP.PRO LIMITED CARD",
    "Snozzberries", "Claim You BOME", "1800$ Lucky Ticket TAKESAGA.com",
    "Truck Coin Swap", "RAYD.PROMO Pass", "Famous Fox Federation Loot Box",
    "Slеrf #822", "Still Faster than ETH", "MAGICEDEN.LOL REWARD",
    "JUPPI.io Super Drop", "GGSG Loot Box", "CircleOnSol.com", "SAGA.PROMO PASS",
    "MFI.EXPERT WhiteList", "4000Jup For You 4000Jup.com", "Third round Drop",
    "Okay Bears Loot Box", "Key", "Daddy", "Outstanding crate #271",
    "Bоnkеr #2183", "Player1Taco at ETHdenver2024", "A Воnker #962",
    "AB Open #01", "FOMO 0% HOUSE EDGE GAMES", "JUP Third round Drop",
    "Claynosaurz Loot Box", "Slеrf #303", "Slеrf #1187", "JP Open #009",
    "AB Early #001", "A WОLF #1133", "Sharky Loot Box", "BOX",
    "SAGA.PROMO AIRDROP by Saga", "For You 6000Jup", "TENSOR.MARKETS PASS",
    "p.HarrisDesigns - The Journey", "Primes Airdrop Box", "AB Early #01",
    "By raydium.pro", "Bоnkеr #1391", "A WОLF #1671", "🎁2024 Jupiter AirDrop",
    "Limited Drop", "Bоnkеr #45", "SAGABOX.io Community Drop", "claim $ai16z",
    "Slеrf #698", "A WОLF #2891", "Clоuds #1978", "Claynosaurz Loot Box",
    "Sаnctum #1441", "Outstanding crate #627", "Clоuds #2788",
    "Claim your WIF", "AWOLF", "A WOLFS #1883", "Sаnctum #74", "AB Open #01",
    "Clоuds #1722", "Slеrf #926", "Clоuds #1195", "Clоud #2027",
    "A WОLF #2469", "Drift", "Shiny Crate", "!solusdt.fun",
    "WASTEBIN #69", "dVIN Digital Cork #107228", "AB Open #002",
    "Rare Pass", "Kahiho Copper 83", "AB Early #01", "BOX#{numbers}", "!solusdt.fun 🎁$88,760 USDT", "Slеrf #2917", "BOX#{numbers}", 
    "Bоnkеr #642", "Sаnctum #516", "Sаnctum #1888", "BOX#{numbers}", "Bоnkеr #2435", 
    "Outstanding crate #531", "Bоnkеr #320", "Mad Lads Week", "Portals | Ivory #728", 
    "Bоnkеr #1287", "A WОLF #1808", "Clоud #2305", "Clоud #1205", "Clоuds #817", 
    "Slеrf #1162", "Clоud #813", "Bоnkеr #1993", "Clоud #352", "Clоuds #1674", 
    "A WOLFS #1879", "Slеrf #1221", "Slеrf #343", "Bоnkеr #313", "Clоud #1947"

]);

const writeJsonFile = (filePath, payload) => {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
};

// Funzione per effettuare chiamate API con timeout
const fetchWithTimeout = (url, options = {}, timeout = 10000) => {
    return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error("⏳ Timeout API")), timeout)
        ),
    ]);
};

// Funzione con retry automatico
const fetchWithRetry = async (url, options, maxRetries = 5, delay = 3000) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetchWithTimeout(url, options);
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error(`⚠️ API error: ${error.message} (Attempt ${attempt}/${maxRetries})`);
            if (attempt < maxRetries) await new Promise(res => setTimeout(res, delay));
            else console.error(`❌ API failed after ${maxRetries} attempts.`);
        }
    }
    return null;
};

// Recupera tutti gli NFT dal wallet
const getNFTsFromHelius = async () => {
    console.log("🔄 Fetching NFTs from wallet via Helius...");
    let page = 1, nftList = [];

    while (true) {
        console.log(`📜 Fetching page ${page}...`);

        try {
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

            if (!data?.result?.items || data.result.items.length === 0) {
                console.log("✅ No more NFTs found.");
                break;
            }

            data.result.items.forEach(nft => {
                const mint = nft.id;
                const name = nft.content?.metadata?.name || "Unknown";
                if (!scamNFTs.has(name)) {
                    console.log(`✅ Valid NFT found: ${name} (${mint})`);
                    nftList.push({ mint, name });
                } else {
                    console.log(`🚫 Ignored scam: ${name} (${mint})`);
                }
            });

            console.log(`📦 Page ${page}: ${data.result.items.length} NFTs found.`);
            page++;
        } catch (error) {
            console.error("❌ Error fetching NFTs:", error.message);
            break;
        }

        await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_HELIUS));
    }

    return nftList;
};

// Recupera il prezzo di SOL da CoinGecko
const getSolPrice = async () => {
    try {
        const data = await fetchWithRetry(COINGECKO_API, {}, 5, 3000);
        return data?.solana?.usd || 0;
    } catch (error) {
        console.error("❌ Error fetching SOL price:", error.message);
        return 0;
    }
};

// Analizza gli NFT, calcola il valore totale e converte in USD
const analyzeNFTs = async () => {
    const nfts = await getNFTsFromHelius();
    let totalSolValue = 0;
    const nftValues = [];

    if (nfts.length === 0) {
        writeJsonFile(NFT_DATA_PATH, {
            updatedAt: new Date().toISOString(),
            wallet: WALLET_ADDRESS,
            solPriceUsd: 0,
            totalNFTValueSol: 0,
            totalNFTValueUsd: 0,
            nfts: [],
        });
        return console.log("🚫 No NFTs to analyze.");
    }

    for (const nft of nfts) {
        console.log(`🔍 Processing NFT: ${nft.name} (${nft.mint})`);
        const collectionName = await fetchWithRetry(`${MAGIC_EDEN_API_BASE}/tokens/${nft.mint}`, {}, 5, REQUEST_DELAY_MAGICEDEN);

        if (collectionName?.collection) {
            const floorPriceData = await fetchWithRetry(`${MAGIC_EDEN_API_BASE}/collections/${collectionName.collection}/stats`, {}, 5, REQUEST_DELAY_MAGICEDEN);
            const floorPrice = floorPriceData?.floorPrice ? floorPriceData.floorPrice / 1e9 : 0;

            if (floorPrice > 0) {
                totalSolValue += floorPrice;
                nftValues.push({
                    mint: nft.mint,
                    name: nft.name,
                    collection: collectionName.collection,
                    floorSol: floorPrice,
                    valueSol: floorPrice,
                    valueUsd: null,
                    hasPrice: true,
                });
                console.log(`📝 NFT: ${nft.name} | Collection: ${collectionName.collection} | Floor: ${floorPrice.toFixed(4)} SOL`);
            } else {
                nftValues.push({
                    mint: nft.mint,
                    name: nft.name,
                    collection: collectionName.collection,
                    floorSol: null,
                    valueSol: 0,
                    valueUsd: null,
                    hasPrice: false,
                });
                console.log(`🟡 NFT: ${nft.name} | Collection: ${collectionName.collection} | No market value.`);
            }
        } else {
            nftValues.push({
                mint: nft.mint,
                name: nft.name,
                collection: null,
                floorSol: null,
                valueSol: 0,
                valueUsd: null,
                hasPrice: false,
            });
            console.log(`❌ Collection not found for ${nft.name} (${nft.mint})`);
        }

        await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY_MAGICEDEN));
    }

    const solPriceUSD = await getSolPrice();
    totalNFTValue = totalSolValue * solPriceUSD;

    for (const nft of nftValues) {
        if (nft.hasPrice) nft.valueUsd = nft.valueSol * solPriceUSD;
    }

    writeJsonFile(NFT_DATA_PATH, {
        updatedAt: new Date().toISOString(),
        wallet: WALLET_ADDRESS,
        solPriceUsd: solPriceUSD,
        totalNFTValueSol: totalSolValue,
        totalNFTValueUsd: totalNFTValue,
        nfts: nftValues.sort((a, b) => (b.valueUsd || 0) - (a.valueUsd || 0)),
    });
    console.log(`✅ Detailed NFT data saved to ${path.relative(ROOT_DIR, NFT_DATA_PATH)}`);

    console.log("\n💎 **Summary** 💎");
    console.log(`📊 Total value in SOL: ${totalSolValue.toFixed(4)} SOL`);
    console.log(`💰 Total value in USD: $${totalNFTValue.toFixed(2)}`);
};

analyzeNFTs()
    .then(() => {
        // Garantiamo che totalNFTValue sia un numero valido
        totalNFTValue = isNaN(totalNFTValue) ? 0 : totalNFTValue;

        // Log separato per evitare interferenze
        console.log(`\n🔹 Value recorded in totalNFTValue: $${totalNFTValue.toFixed(2)}`);

        // Aggiungiamo un marcatore per il JSON
        console.log("--- JSON OUTPUT START ---");
        console.log(JSON.stringify({ totalNFTValue }));
        console.log("--- JSON OUTPUT END ---");
    })
    .catch((error) => {
        console.error("❌ Error during NFT analysis:", error);

        // In caso di errore, restituiamo un JSON valido con valore 0
        console.log("--- JSON OUTPUT START ---");
        console.log(JSON.stringify({ totalNFTValue: 0 }));
        console.log("--- JSON OUTPUT END ---");
    });
