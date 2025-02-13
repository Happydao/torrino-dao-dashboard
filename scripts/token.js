const axios = require('axios');
require('dotenv').config();

// Configurazione
const WALLET_ADDRESS = "EKjb5grMX19c3cAZa5LQjqksDpqqVLTGZrswh79WkPdD";
const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const JUPITER_API_URL = 'https://api.jup.ag/price/v2?ids=';
const REQUEST_DELAY = 1000; // 1 secondi di ritardo tra le richieste
const RETRY_DELAY = 3000; // 3 secondi di ritardo in caso di errore
const MAX_RETRIES = 3; // Numero massimo di tentativi
const TIMEOUT = 3000; // Timeout per le richieste API in millisecondi
let totalTreasuryValue = 0; // Totale valore della tesoreria
let tokenValues = []; // Array per memorizzare i valori dei singoli token

// Funzione per calcolare la quantità reale
function calculateRealAmount(amount, decimals) {
    return amount / Math.pow(10, decimals);
}

async function getTokenAccounts() {
    try {
        console.log("🔄 Recupero token da Helius DAS API...");
        
        const response = await axios.get(
            `https://api.helius.xyz/v0/addresses/${WALLET_ADDRESS}/balances?api-key=${HELIUS_API_KEY}`,
            { timeout: TIMEOUT }
        );

        if (response.data.tokens) {
            const tokens = response.data.tokens
                .filter(token => token.amount > 1) // Filtra solo token con più di 1 unità
                .map(token => ({
                    mint: token.mint,
                    rawAmount: token.amount,
                    realAmount: calculateRealAmount(token.amount, token.decimals),
                    decimals: token.decimals,
                    tokenName: token.name || 'Unknown'
                }))
                .sort((a, b) => b.realAmount - a.realAmount);

            console.log(`\n✅ Trovati ${tokens.length} token fungibili con più di 1 unità\n`);
            
            for (const token of tokens) {
                await getTokenPrice(token);
            }

            console.log("\n📋 RIEPILOGO VALORI TOKEN:\n");
            tokenValues.forEach(({ mint, value }) => {
                console.log(`${mint} - ${value.toFixed(2)} USD`);
            });
            
            console.log(`\n💰 VALORE TOTALE TESORERIA: ${totalTreasuryValue.toFixed(2)} USD\n`);
            
            // Output in JSON per essere letto da ts.js
            console.log(JSON.stringify({ totaltokenvalue: totalTreasuryValue }));
        }
    } catch (error) {
        console.error("❌ Errore nel recupero dei token:", error.response?.data || error.message);
    }
}

async function getTokenPrice(token) {
    let retries = 0;
    let success = false;
    
    console.log(`🔍 Analizzando token: ${token.tokenName} (${token.mint})`);
    
    while (retries < MAX_RETRIES && !success) {
        try {
            const response = await axios.get(
                `${JUPITER_API_URL}${token.mint}`,
                { timeout: TIMEOUT }
            );
            const tokenData = response.data?.data?.[token.mint];
            
            if (tokenData && tokenData.price !== null) {
                let price = parseFloat(tokenData.price); // Converte la stringa in numero
                let tokenValue = token.realAmount * price; // Calcola il valore in USD
                totalTreasuryValue += tokenValue; // Aggiorna il totale tesoreria
                tokenValues.push({ mint: token.mint, value: tokenValue }); // Memorizza il valore del token
                console.log(`✅ ${token.tokenName} (${token.mint})`);
                console.log(`   Quantità reale: ${token.realAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 6 })}`);
                console.log(`   Prezzo: ${price.toFixed(10)} USD`);
                console.log(`   Valore Totale: ${tokenValue.toFixed(2)} USD\n`);
            } else {
                console.log(`✅ ${token.tokenName} (${token.mint}) - Nessun prezzo disponibile`);
            }
            
            success = true;
        } catch (error) {
            console.error(`❌ Errore nel recupero del prezzo (tentativo ${retries + 1} di ${MAX_RETRIES}):`, error.response?.data || error.message);
            retries++;
            if (retries < MAX_RETRIES) {
                console.log(`⏳ Ritento tra ${RETRY_DELAY / 1000} secondi...`);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            }
        }
    }
    console.log(`⏳ Attesa di ${REQUEST_DELAY / 1000} secondi prima della prossima richiesta...`);
    await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
}

// Esegui
getTokenAccounts();
