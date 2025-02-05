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
    await page.goto('https://app.step.finance/portfolio?wallet=EKjb5grMX19c3cAZa5LQjqksDpqqVLTGZrswh79WkPdD', {
        waitUntil: 'networkidle2',
        timeout: 120000
    });

    console.log("⏳ Aspetto il caricamento completo...");
    await page.waitForSelector('body', { timeout: 120000 });
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log("📥 Estrazione del valore della tesoreria...");
    const portfolioValue = await page.evaluate(() => {
        const element = [...document.querySelectorAll('span')]
            .find(el => el.textContent && el.textContent.includes('$'));

        if (!element) return null;
        return element.textContent.replace('$', '').replace('.', '').replace(',', '.').trim();
    });

    await browser.close();

    if (!portfolioValue || isNaN(portfolioValue)) {
        throw new Error("❌ Errore: impossibile leggere il valore della tesoreria.");
    }

    console.log(`✅ Valore della tesoreria estratto: $${portfolioValue}`);
    return parseFloat(portfolioValue);
}

// 🔹 Funzione per ottenere il prezzo di SOL da CoinGecko
async function getSolPrice() {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        return response.data.solana.usd || null;
    } catch (error) {
        console.error("❌ Errore nel recupero del prezzo di SOL:", error);
        return null;
    }
}

// 🔹 Funzione per calcolare i valori NFT in USD e SOL
async function calculateNFTValues(treasuryValue) {
    if (isNaN(treasuryValue)) throw new Error("❌ Errore: valore della tesoreria non valido.");

    const treasuryGen1 = treasuryValue * 0.90;
    const treasuryGen2 = treasuryValue * 0.10;
    const nftGen1Count = 500;
    const nftGen2Count = 888;
    const solPrice = await getSolPrice();

    return {
        treasuryValue,
        treasuryGen1,
        treasuryGen2,
        nftGen1Value: (treasuryGen1 / nftGen1Count).toFixed(2),
        nftGen2Value: (treasuryGen2 / nftGen2Count).toFixed(2),
        solPrice,
        nftGen1ValueSol: solPrice ? (treasuryGen1 / nftGen1Count / solPrice).toFixed(2) : 'Errore',
        nftGen2ValueSol: solPrice ? (treasuryGen2 / nftGen2Count / solPrice).toFixed(2) : 'Errore'
    };
}

// 🔹 Funzione per ottenere il prezzo di listing degli NFT
async function getListingPrice(collId) {
    try {
        const response = await axios.get(`https://api.mainnet.tensordev.io/api/v1/mint/active_listings?collId=${collId}&sortBy=ListingPriceAsc&limit=1&mints=`, {
            headers: { 'accept': 'application/json', 'x-tensor-api-key': process.env.TENSOR_API_KEY },
        });

        if (!response.data.mints || response.data.mints.length === 0) return null;
        const priceInLamport = response.data.mints[0].listing.price;
        return (priceInLamport / 1000000000) * 1.06;
    } catch (error) {
        console.error(`❌ Errore nel recupero del prezzo di listing per ${collId}:`, error);
        return null;
    }
}

// 🔹 Funzione per salvare i dati in un file JSON
async function saveDataToFile(data) {
    const now = new Date();
    const formattedDate = now.toLocaleString("it-IT", { timeZone: "Europe/Rome" });

    const gen1ListingPrice = await getListingPrice("d48ce4ec-9083-4fc9-84f8-db3f2b53ce92");
    const gen2ListingPrice = await getListingPrice("f16f63a3-58b6-4a69-ade8-35f6ba817b00");

    const output = {
        lastUpdated: formattedDate,
        treasuryValue: Math.round(data.treasuryValue),
        treasuryGen1: Math.round(data.treasuryGen1),
        treasuryGen2: Math.round(data.treasuryGen2),
        solPrice: Math.round(data.solPrice),
        nftGen1Value: Math.round(data.nftGen1Value),
        nftGen1ValueSol: data.nftGen1ValueSol,
        nftGen2Value: Math.round(data.nftGen2Value),
        nftGen2ValueSol: data.nftGen2ValueSol,
        gen1ListingPrice: gen1ListingPrice ? (gen1ListingPrice * data.solPrice).toFixed(2) : 'Errore',
        gen1ListingPriceSol: gen1ListingPrice ? gen1ListingPrice.toFixed(2) : 'Errore',
        gen2ListingPrice: gen2ListingPrice ? (gen2ListingPrice * data.solPrice).toFixed(2) : 'Errore',
        gen2ListingPriceSol: gen2ListingPrice ? gen2ListingPrice.toFixed(2) : 'Errore',
        gen1Discount: gen1ListingPrice ? (((gen1ListingPrice * data.solPrice - data.nftGen1Value) / data.nftGen1Value) * 100).toFixed(2) : 'Errore',
        gen2Discount: gen2ListingPrice ? (((gen2ListingPrice * data.solPrice - data.nftGen2Value) / data.nftGen2Value) * 100).toFixed(2) : 'Errore'
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
