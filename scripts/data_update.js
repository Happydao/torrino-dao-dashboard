const puppeteer = require('puppeteer');
const fs = require('fs');
const axios = require('axios');

// 🔹 Funzione per ottenere il valore della tesoreria da Step Finance
async function getTreasuryValue() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36');
    console.log("🔄 Apro Step Finance...");
    await page.goto('https://app.step.finance/en/dashboard?watching=EKjb5grMX19c3cAZa5LQjqksDpqqVLTGZrswh79WkPdD', {
        waitUntil: 'networkidle2',
        timeout: 90000
    });
    console.log("⏳ Aspetto il caricamento completo...");
    await new Promise(resolve => setTimeout(resolve, 30000));
    console.log("📥 Estrazione del valore...");
    const portfolioValue = await page.evaluate(() => {
        return document.title.split('|')[0].trim().replace('$', '').replace(' USD', '');
    });
    await browser.close();
    console.log(`✅ Valore della tesoreria estratto: $${portfolioValue}`);
    return parseFloat(portfolioValue.replace(/,/g, ''));
}

// 🔹 Funzione per ottenere il prezzo di SOL da CoinGecko
async function getSolPrice() {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const solPrice = response.data.solana.usd;
        console.log(`🔹 Prezzo attuale di SOL: $${solPrice}`);
        return solPrice;
    } catch (error) {
        console.error("❌ Errore nel recupero del prezzo di SOL:", error);
        return null;
    }
}

// 🔹 Funzione per calcolare i valori NFT in USD e SOL
async function calculateNFTValues(treasuryValue) {
    if (isNaN(treasuryValue)) {
        throw new Error("❌ Errore: impossibile leggere il valore della tesoreria.");
    }
    const treasuryGen1 = treasuryValue * 0.90; // 90% per Gen 1
    const treasuryGen2 = treasuryValue * 0.10; // 10% per Gen 2
    const nftGen1Count = 500;
    const nftGen2Count = 888;
    const nftGen1Value = treasuryGen1 / nftGen1Count;
    const nftGen2Value = treasuryGen2 / nftGen2Count;
    const solPrice = await getSolPrice();
    const nftGen1ValueSol = solPrice ? (nftGen1Value / solPrice) : null;
    const nftGen2ValueSol = solPrice ? (nftGen2Value / solPrice) : null;
    return {
        treasuryValue,
        treasuryGen1,
        treasuryGen2,
        nftGen1Value,
        nftGen2Value,
        solPrice,
        nftGen1ValueSol,
        nftGen2ValueSol
    };
}

// 🔹 Funzione per ottenere il prezzo di listing dell'ultimo NFT di Gen 1
async function getGen1ListingPrice() {
    try {
        const response = await axios.get('https://api.mainnet.tensordev.io/api/v1/mint/active_listings?collId=d48ce4ec-9083-4fc9-84f8-db3f2b53ce92&sortBy=ListingPriceAsc&limit=1&mints=', {
            headers: {
                'accept': 'application/json',
                'x-tensor-api-key': process.env.TENSOR_API_KEY,
            },
        });
        const priceInLamport = response.data.mints[0].listing.price; // Prezzo in lamport
        const solPrice = priceInLamport / 1000000000; // Conversione da lamport a sol
        const royalties = solPrice * 0.06;
        const priceWithRoyalties = solPrice + royalties;
        return priceWithRoyalties;
    } catch (error) {
        console.error('Errore durante il recupero del prezzo di listing di Gen 1:', error);
        return null;
    }
}

// 🔹 Funzione per ottenere il prezzo di listing dell'ultimo NFT di Gen 2
async function getGen2ListingPrice() {
    try {
        const response = await axios.get('https://api.mainnet.tensordev.io/api/v1/mint/active_listings?collId=f16f63a3-58b6-4a69-ade8-35f6ba817b00&sortBy=ListingPriceAsc&limit=1&mints=', {
            headers: {
                'accept': 'application/json',
                'x-tensor-api-key': process.env.TENSOR_API_KEY,
            },
        });
        const priceInLamport = response.data.mints[0].listing.price; // Prezzo in lamport
        const solPrice = priceInLamport / 1000000000; // Conversione da lamport a sol
        const royalties = solPrice * 0.06;
        const priceWithRoyalties = solPrice + royalties;
        return priceWithRoyalties;
    } catch (error) {
        console.error('Errore durante il recupero del prezzo di listing di Gen 2:', error);
        return null;
    }
}

// 🔹 Funzione per calcolare la percentuale di sconto
function calculateDiscount(listingPrice, nftValue) {
    if (listingPrice && nftValue) {
        const discount = ((listingPrice - nftValue) / nftValue) * 100;
        return discount.toFixed(2);
    }
    return 'Errore';
}

// 🔹 Funzione per salvare i dati in un file JSON
async function saveDataToFile(data) {
    const now = new Date();
    const formattedDate = now.toLocaleString("it-IT", { timeZone: "Europe/Rome" });
    const gen1ListingPrice = await getGen1ListingPrice();
    const gen2ListingPrice = await getGen2ListingPrice();
    const gen1Discount = gen1ListingPrice ? calculateDiscount(gen1ListingPrice * data.solPrice, data.nftGen1Value) : 'Errore';
    const gen2Discount = gen2ListingPrice ? calculateDiscount(gen2ListingPrice * data.solPrice, data.nftGen2Value) : 'Errore';

    const output = {
        lastUpdated: formattedDate,
        treasuryValue: Math.round(data.treasuryValue),
        treasuryGen1: Math.round(data.treasuryGen1),
        treasuryGen2: Math.round(data.treasuryGen2),
        solPrice: Math.round(data.solPrice),
        nftGen1Value: Math.round(data.nftGen1Value),
        nftGen1ValueSol: data.nftGen1ValueSol ? data.nftGen1ValueSol.toFixed(2) : 'Errore',
        nftGen2Value: Math.round(data.nftGen2Value),
        nftGen2ValueSol: data.nftGen2ValueSol ? data.nftGen2ValueSol.toFixed(2) : 'Errore',
        gen1ListingPrice: gen1ListingPrice ? (gen1ListingPrice * data.solPrice).toFixed(2) : 'Errore',
        gen2ListingPrice: gen2ListingPrice ? (gen2ListingPrice * data.solPrice).toFixed(2) : 'Errore',
        gen1Discount,
        gen2Discount
    };

    fs.writeFileSync('data.json', JSON.stringify(output, null, 2));
    console.log("✅ Dati salvati in data.json.");
}

// 🔹 Funzione principale
async function main() {
    try {
        const treasuryValue = await getTreasuryValue();
        const nftData = await calculateNFTValues(treasuryValue);
        await saveDataToFile(nftData);
    } catch (error) {
        console.error("❌ Errore generale:", error);
    }
}

// Esegui lo script
main().then(() => process.exit(0)).catch(error => {
    console.error("❌ Errore generale:", error);
    process.exit(1);
});
