const { spawn } = require("child_process");
const scripts = ["token.js", "staking.js", "nft.js"];
let totalTreasury = 0;
let results = {};

const executeScript = (script) => {
    return new Promise((resolve) => {
        console.log(`▶️ Eseguendo ${script}...`);
        const process = spawn("node", [`scripts/${script}`]);
        let outputData = "";

        process.stdout.on("data", (data) => {
            outputData += data.toString();
            console.log(data.toString());
        });

        process.stderr.on("data", (data) => {
            console.error(`⚠️ Errore in ${script}:`, data.toString());
        });

        process.on("close", (code) => {
            try {
                // Cerca il JSON nell'output, può essere in qualsiasi punto
                const jsonRegex = {
                    'token.js': /{"totaltokenvalue":\s*([\d.]+)}/,
                    'staking.js': /{"totalStakedValue":\s*([\d.]+)}/,
                    'nft.js': /{"totalNFTValue":\s*([\d.]+)}/
                };

                const match = outputData.match(jsonRegex[script]);
                if (match) {
                    const value = parseFloat(match[1]);
                    results[script] = value;
                    totalTreasury += value;
                    console.log(`✅ Valore totale ${script}: $${value.toFixed(2)} USD`);
                    resolve(value);
                } else {
                    console.error(`⚠️ Nessun valore trovato in ${script}`);
                    resolve(0);
                }
            } catch (error) {
                console.error(`⚠️ Errore in ${script}:`, error.message);
                resolve(0);
            }
        });
    });
};

const fs = require("fs"); // Importa il modulo per scrivere su file

const calculateTotalTreasury = async () => {
    try {
        for (const script of scripts) {
            await executeScript(script);
        }
        console.log("\n📝 **Riepilogo Tesoreria**:");
        console.log(`💰 Token: $${results["token.js"] || 0}`);
        console.log(`🔹 Staking: $${results["staking.js"] || 0}`);
        console.log(`🎨 NFT: $${results["nft.js"] || 0}`);
        console.log(`🏦 Valore totale tesoreria: $${totalTreasury.toFixed(2)} USD`);

        const treasuryData = {
            totalTreasury: totalTreasury.toFixed(2),
            tokenValue: results["token.js"] || 0,
            stakingValue: results["staking.js"] || 0,
            nftValue: results["nft.js"] || 0
        };

        console.log("\n--- JSON OUTPUT START ---");
        console.log(JSON.stringify(treasuryData));
        console.log("--- JSON OUTPUT END ---");

        // 🔹 Salva i dati in un file per essere usati da `calculate.js`
        fs.writeFileSync("totalvalue_output.json", JSON.stringify(treasuryData, null, 2));
        console.log("✅ `totalvalue_output.json` salvato con successo!");

    } catch (error) {
        console.error("❌ Errore nel calcolo della tesoreria:", error);
    }
};

calculateTotalTreasury();
