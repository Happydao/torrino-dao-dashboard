const { spawn } = require("child_process");
const fs = require("fs");
const axios = require("axios");

// Funzione per eseguire totalvalue.js e ottenere il valore della tesoreria
const getTreasuryValue = () => {
    return new Promise((resolve, reject) => {
        console.log("▶️ Avvio totalvalue.js per calcolare la tesoreria...");

        const process = spawn("node", ["scripts/totalvalue.js"]);
        let outputData = "";

        process.stdout.on("data", (data) => {
            outputData += data.toString();
            console.log(data.toString());
        });

        process.stderr.on("data", (data) => {
            console.error(`⚠️ Errore in totalvalue.js:`, data.toString());
        });

        process.on("close", (code) => {
            if (code !== 0) {
                return reject("❌ Errore nell'esecuzione di totalvalue.js");
            }

            // Estrazione del valore tesoreria dallo stdout
            const match = outputData.match(/"totalTreasury"\s*:\s*([\d.]+)/);
            const treasuryValue = match ? parseFloat(match[1]) : null;

            if (treasuryValue !== null) {
                console.log(`✅ Valore tesoreria estratto: $${treasuryValue}`);
                resolve(treasuryValue);
            } else {
                reject("❌ Errore: impossibile estrarre il valore della tesoreria.");
            }
        });
    });
};

// Funzione per ottenere il prezzo di SOL da CoinGecko
const getSolPrice = async () => {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
        const solPrice = response.data.solana.usd;
        console.log(`🔹 Prezzo attuale di SOL: $${solPrice}`);
        return solPrice;
    } catch (error) {
        console.error("❌ Errore nel recupero del prezzo di SOL:", error);
        return null;
    }
};

// Funzione per calcolare i valori NFT
const calculateNFTValues = async (treasuryValue) => {
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
        solPrice,
        nftGen1Value,
        nftGen1ValueSol,
        nftGen2Value,
        nftGen2ValueSol
    };
};

// Funzione principale per aggiornare data.json
const updateDataJson = async () => {
    try {
        const treasuryValue = await getTreasuryValue();
        const nftData = await calculateNFTValues(treasuryValue);

        // Creazione del JSON finale
        const data = {
            lastUpdated: new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" }),
            ...nftData,
            gen1ListingPrice: 506.69,
            gen1ListingPriceSol: 2.54,
            gen2ListingPrice: 31.67,
            gen2ListingPriceSol: 0.16,
            gen1Discount: "-32.11",
            gen2Discount: "-32.17"
        };

        // Salvataggio in data.json
        fs.writeFileSync("data.json", JSON.stringify(data, null, 2));
        console.log("✅ File data.json aggiornato con successo.");
    } catch (error) {
        console.error("❌ Errore nell'aggiornamento di data.json:", error);
    }
};

// Eseguire lo script
updateDataJson();
