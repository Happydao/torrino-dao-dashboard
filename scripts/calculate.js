const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

// 🔹 Recupera il prezzo di SOL da CoinGecko
async function getSolPrice() {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        return response.data.solana.usd;
    } catch (error) {
        console.error("❌ Errore nel recupero del prezzo di SOL:", error);
        return null;
    }
}

// 🔹 Recupera i prezzi di listing NFT (Gen 1 e Gen 2)
async function getListingPrices() {
    try {
        const gen1Response = await axios.get(
            'https://api.mainnet.tensordev.io/api/v1/mint/active_listings?collId=d48ce4ec-9083-4fc9-84f8-db3f2b53ce92&sortBy=ListingPriceAsc&limit=1&mints=',
            { headers: { 'x-tensor-api-key': process.env.TENSOR_API_KEY } }
        );
        const gen2Response = await axios.get(
            'https://api.mainnet.tensordev.io/api/v1/mint/active_listings?collId=f16f63a3-58b6-4a69-ade8-35f6ba817b00&sortBy=ListingPriceAsc&limit=1&mints=',
            { headers: { 'x-tensor-api-key': process.env.TENSOR_API_KEY } }
        );

        return {
            gen1: gen1Response.data.mints.length > 0 ? (gen1Response.data.mints[0].listing.price / 1e9) * 1.06 : null,
            gen2: gen2Response.data.mints.length > 0 ? (gen2Response.data.mints[0].listing.price / 1e9) * 1.06 : null
        };
    } catch (error) {
        console.error("❌ Errore nel recupero dei prezzi di listing NFT:", error);
        return { gen1: null, gen2: null };
    }
}

// 🔹 Legge il valore della tesoreria dall'output JSON di `totalvalue.js`
function getTreasuryFromTotalValue() {
    try {
        const outputData = fs.readFileSync('../totalvalue_output.json', 'utf8');
        const totalValueData = JSON.parse(outputData);
        return totalValueData;
    } catch (error) {
        console.error("❌ Errore nel recupero del valore della tesoreria da `totalvalue_output.json`:", error);
        return null;
    }
}

// 🔹 Funzione principale per calcolare e scrivere `data.json`
async function main() {
    try {
        // 🔄 Ottiene il valore della tesoreria da `totalvalue.js`
        const totalValueData = getTreasuryFromTotalValue();
        if (!totalValueData) {
            console.error("❌ Errore: valore della tesoreria non disponibile.");
            return;
        }

        const treasuryValue = parseFloat(totalValueData.totalTreasury);
        const tokenValue = parseFloat(totalValueData.tokenValue);
        const stakingValue = parseFloat(totalValueData.stakingValue);
        const nftValue = parseFloat(totalValueData.nftValue);

        console.log(`✅ Valore tesoreria ricevuto da totalvalue.js: $${treasuryValue}`);

        // 🔹 Ottieni il prezzo di SOL
        const solPrice = await getSolPrice();
        if (solPrice === null) {
            console.error("❌ Errore: prezzo SOL non disponibile.");
            return;
        }

        // 🔹 Ottieni i prezzi di listing NFT
        const listingPrices = await getListingPrices();

        // 🔹 Costruisce i dati per `data.json`
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
            gen1ListingPrice: listingPrices.gen1 !== null ? (listingPrices.gen1 * solPrice).toFixed(2) : "N/A",
            gen1ListingPriceSol: listingPrices.gen1 !== null ? listingPrices.gen1.toFixed(2) : "N/A",
            gen2ListingPrice: listingPrices.gen2 !== null ? (listingPrices.gen2 * solPrice).toFixed(2) : "N/A",
            gen2ListingPriceSol: listingPrices.gen2 !== null ? listingPrices.gen2.toFixed(2) : "N/A",
            gen1Discount: listingPrices.gen1 !== null
                ? (-((listingPrices.gen1 - ((treasuryValue * 0.90) / 500 / solPrice)) / ((treasuryValue * 0.90) / 500 / solPrice) * 100)).toFixed(2)
                : "N/A",
            gen2Discount: listingPrices.gen2 !== null
                ? (-((listingPrices.gen2 - ((treasuryValue * 0.10) / 888 / solPrice)) / ((treasuryValue * 0.10) / 888 / solPrice) * 100)).toFixed(2)
                : "N/A"
        };

        // 🔹 Salva `data.json`
        fs.writeFileSync('../data.json', JSON.stringify(data, null, 2));
        console.log("✅ `data.json` aggiornato con successo!");
        console.log("📂 Contenuto aggiornato:", JSON.stringify(data, null, 2));

    } catch (error) {
        console.error("❌ Errore generale:", error);
    }
}

// 🔹 Esegui lo script
main();
