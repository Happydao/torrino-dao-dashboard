const { spawn } = require("child_process");
const scripts = ["scripts/token.js", "scripts/staking.js", "scripts/nft.js"];
let totalTreasury = 0;

const executeScript = (script) => {
    return new Promise((resolve) => {
        console.log(`▶️ Eseguendo ${script}...`);
        const process = spawn("node", [script]);
        let outputData = "";

        process.stdout.on("data", (data) => {
            outputData += data.toString();
            console.log(data.toString());
            
            // Cerca la variabile specifica per ogni script
            const valuePattern = {
                'token.js': /"totaltokenvalue"\s*:\s*([\d.]+)/,
                'staking.js': /"totalStakedValue"\s*:\s*([\d.]+)/,
                'nft.js': /"totalNFTValue"\s*:\s*([\d.]+)/
            };

            const match = outputData.match(valuePattern[script]);
            if (match) {
                const value = parseFloat(match[1]);
                console.log(`✅ Valore trovato per ${script}: $${value.toFixed(2)} USD`);
                resolve(value);
            }
        });

        process.stderr.on("data", (data) => {
            console.error(`⚠️ Errore in ${script}:`, data.toString());
        });
    });
};

const calculateTotalTreasury = async () => {
    try {
        for (const script of scripts) {
            const scriptValue = await executeScript(script);
            totalTreasury += scriptValue;
        }
        console.log(`🏦 Totale tesoreria: $${totalTreasury.toFixed(2)} USD`);
    } catch (error) {
        console.error("❌ Errore calcolo tesoreria:", error);
    }
};

calculateTotalTreasury();
