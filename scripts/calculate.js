const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const rootDir = path.join(__dirname, '..');
const totalValuePath = path.join(rootDir, 'totalvalue_output.json');
const dataJsonPath = path.join(rootDir, 'data.json');

async function getSolPrice() {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        return response.data.solana.usd;
    } catch (error) {
        console.error("❌ Error fetching SOL price:", error);
        return null;
    }
}

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
        console.error("❌ Error fetching NFT listing prices:", error);
        return { gen1: null, gen2: null };
    }
}

function getTreasuryFromTotalValue() {
    try {
        const outputData = fs.readFileSync(totalValuePath, 'utf8');
        const totalValueData = JSON.parse(outputData);
        console.log("✅ Data read from totalvalue_output.json:", totalValueData);
        return totalValueData;
    } catch (error) {
        console.error("❌ Error fetching treasury value:", error);
        return null;
    }
}

function calculateDifferencePercent(listing, real) {
    return ((listing - real) / real) * 100;
}

function getLabel(diff) {
    if (diff < 0) return "Discounted";
    if (diff > 0) return "Overvalued";
    return "Fair value";
}

async function main() {
    try {
        const totalValueData = getTreasuryFromTotalValue();
        if (!totalValueData) throw new Error("Treasury value unavailable");

        const treasuryValue = parseFloat(totalValueData.totalTreasury);
        const stableValue = parseFloat(totalValueData.totalstablevalue) || 0;

        const solPrice = await getSolPrice();
        if (!solPrice) throw new Error("SOL price unavailable");

        const listingPrices = await getListingPrices();

        const gen1ValReale = (treasuryValue * 0.90) / 500 / solPrice;
        const gen2ValReale = (treasuryValue * 0.10) / 888 / solPrice;

        const gen1Discount = listingPrices.gen1 !== null ? calculateDifferencePercent(listingPrices.gen1, gen1ValReale) : null;
        const gen2Discount = listingPrices.gen2 !== null ? calculateDifferencePercent(listingPrices.gen2, gen2ValReale) : null;

        const data = {
            lastUpdated: new Date().toLocaleDateString("it-IT", { timeZone: "Europe/Rome", day: '2-digit', month: '2-digit', year: '2-digit' }),
            treasuryValue: Math.round(treasuryValue),
            treasuryGen1: Math.round(treasuryValue * 0.90),
            treasuryGen2: Math.round(treasuryValue * 0.10),
            solPrice: Math.round(solPrice),
            nftGen1Value: Math.round(gen1ValReale * solPrice),
            nftGen1ValueSol: gen1ValReale.toFixed(2),
            nftGen2Value: Math.round(gen2ValReale * solPrice),
            nftGen2ValueSol: gen2ValReale.toFixed(2),
            gen1ListingPrice: listingPrices.gen1 !== null ? Math.round(listingPrices.gen1 * solPrice) : "N/A",
            gen1ListingPriceSol: listingPrices.gen1 !== null ? listingPrices.gen1.toFixed(2) : "N/A",
            gen2ListingPrice: listingPrices.gen2 !== null ? Math.round(listingPrices.gen2 * solPrice) : "N/A",
            gen2ListingPriceSol: listingPrices.gen2 !== null ? listingPrices.gen2.toFixed(2) : "N/A",
            gen1Discount: gen1Discount !== null ? gen1Discount.toFixed(2) : "N/A",
            gen1DiscountLabel: gen1Discount !== null ? getLabel(gen1Discount) : "N/A",
            gen2Discount: gen2Discount !== null ? gen2Discount.toFixed(2) : "N/A",
            gen2DiscountLabel: gen2Discount !== null ? getLabel(gen2Discount) : "N/A",
            stableValue: Math.round(stableValue),
            stablePercentage: Math.round((stableValue / treasuryValue) * 100)
        };

        fs.writeFileSync(dataJsonPath, JSON.stringify(data, null, 2));
        console.log("✅ data.json updated successfully!");
        console.log("📂 Updated content:", JSON.stringify(data, null, 2));

    } catch (error) {
        console.error("❌ General error:", error);
    }
}

main();
