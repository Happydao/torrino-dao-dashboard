const { spawn } = require("child_process");

// Script da eseguire in sequenza
const scripts = ["token.js", "staking.js", "nft.js"];

// Valori per la tesoreria
let totalTreasury = 0;
let results = {}; // Oggetto per salvare i dati di ogni script

// Funzione per eseguire uno script e catturare il valore USD
const executeScript = (script) => {
    return new Promise((resolve, reject) => {
        console.log(`▶️ Eseguendo ${script}...`);

        const process = spawn("node", [`scripts/${script}`]);

        let outputData = "";

        process.stdout.on("data", (data) => {
            outputData += data.toString();
            console.log(data.toString()); // Stampa l'output in tempo reale
        });

        process.stderr.on("data", (data) => {
            console.error(`⚠️ Errore in ${script}:`, data.toString());
        });

        process.on("close", (code) => {
            if (code !== 0) {
                console.error(`❌ ${script} terminato con codice di errore ${code}`);
                return reject(0);
            }

            try {
                // Estrai l'oggetto JSON stampato dall'output
                const jsonMatch = outputData.match(/\{.*\}/s); // Cerca il JSON stampato
                if (!jsonMatch) {
                    throw new Error(`❌ Nessun JSON trovato in output di ${script}`);
                }

                const parsedOutput = JSON.parse(jsonMatch[0]); // Converte in oggetto

                // Determina quale valore salvare in base allo script eseguito
                let scriptValue = 0;
                if (script === "token.js" && parsedOutput.totaltokenvalue !== undefined) {
                    scriptValue = parseFloat(parsedOutput.totaltokenvalue);
                } else if (script === "staking.js" && parsedOutput.totalStakedValue !== undefined) {
                    scriptValue = parseFloat(parsedOutput.totalStakedValue);
                } else if (script === "nft.js" && parsedOutput.totalNFTValue !== undefined) {
                    scriptValue = parseFloat(parsedOutput.totalNFTValue);
                } else {
                    throw new Error(`❌ Chiave JSON non trovata per ${script}`);
                }

                // Salva il valore e aggiorna la tesoreria
                results[script] = scriptValue;
                totalTreasury += scriptValue;
                console.log(`✅ Valore totale ${script}: $${scriptValue.toFixed(2)} USD`);
                resolve(scriptValue);
            } catch (error) {
                console.error(`⚠️ Errore parsing JSON in ${script}:`, error.message);
                resolve(0);
            }
        });
    });
};

// Funzione principale per eseguire tutti gli script in sequenza
const calculateTotalTreasury = async () => {
    try {
        for (const script of scripts) {
            await executeScript(script);
        }

        console.log("📝 **Riepilogo Tesoreria**:");
        console.log(`💰 Token: $${results["token.js"] || 0}`);
        console.log(`🔹 Staking: $${results["staking.js"] || 0}`);
        console.log(`🎨 NFT: $${results["nft.js"] || 0}`);
        console.log(`🏦 Valore totale tesoreria combinato: $${totalTreasury.toFixed(2)} USD`);

    } catch (error) {
        console.error("❌ Errore nel calcolo della tesoreria totale:", error);
    }
};

// Esegui il calcolo della tesoreria totale
calculateTotalTreasury();
