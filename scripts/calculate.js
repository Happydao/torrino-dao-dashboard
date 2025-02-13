const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

// Token e API keys
const GITHUB_TOKEN = process.env.G_TOKEN;

async function getSolPrice() {
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    return response.data.solana.usd;
}

async function getListingPrices() {
    const gen1Response = await axios.get(
        'https://api.mainnet.tensordev.io/api/v1/mint/active_listings?collId=d48ce4ec-9083-4fc9-84f8-db3f2b53ce92&sortBy=ListingPriceAsc&limit=1&mints=',
        { headers: { 'x-tensor-api-key': process.env.TENSOR_API_KEY } }
    );
    const gen2Response = await axios.get(
        'https://api.mainnet.tensordev.io/api/v1/mint/active_listings?collId=f16f63a3-58b6-4a69-ade8-35f6ba817b00&sortBy=ListingPriceAsc&limit=1&mints=',
        { headers: { 'x-tensor-api-key': process.env.TENSOR_API_KEY } }
    );

    return {
        gen1: (gen1Response.data.mints[0].listing.price / 1000000000) * 1.06,
        gen2: (gen2Response.data.mints[0].listing.price / 1000000000) * 1.06
    };
}

async function main() {
    try {
        // Leggi il valore 403190.76 dall'output della Github Action
        const treasuryValue = 403190.76;  // Questo valore andrà preso dall'output dell'action
        const solPrice = await getSolPrice();
        const listingPrices = await getListingPrices();

        const data = {
            lastUpdated: new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" }),
            treasuryValue: Math.round(treasuryValue),
            treasuryGen1: Math.round(treasuryValue * 0.90),
            treasuryGen2: Math.round(treasuryValue * 0.10),
            solPrice: Math.round(solPrice),
            nftGen1Value: Math.round((treasuryValue * 0.90) / 500),
            nftGen1ValueSol: ((treasuryValue * 0.90) / 500 / solPrice).toFixed(2),
            nftGen2Value: Math.round((treasuryValue * 0.10) / 888),
            nftGen2ValueSol: ((treasuryValue * 0.10) / 888 / solPrice).toFixed(2),
            gen1ListingPrice: (listingPrices.gen1 * solPrice).toFixed(2),
            gen1ListingPriceSol: listingPrices.gen1.toFixed(2),
            gen2ListingPrice: (listingPrices.gen2 * solPrice).toFixed(2),
            gen2ListingPriceSol: listingPrices.gen2.toFixed(2),
            gen1Discount: (-((listingPrices.gen1 - ((treasuryValue * 0.90) / 500 / solPrice)) / ((treasuryValue * 0.90) / 500 / solPrice) * 100)).toFixed(2),
            gen2Discount: (-((listingPrices.gen2 - ((treasuryValue * 0.10) / 888 / solPrice)) / ((treasuryValue * 0.10) / 888 / solPrice) * 100)).toFixed(2)
        };

        fs.writeFileSync('data.json', JSON.stringify(data, null, 2));
        console.log("✅ Data salvata in data.json");

    } catch (error) {
        console.error("❌ Errore:", error);
    }
}

main();
