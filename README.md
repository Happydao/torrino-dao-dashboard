# Torrino DAO Treasury Dashboard

Interactive dashboard for monitoring the Torrino DAO treasury, NFT fair value vs listing price, portfolio allocation, and historical trends.

## Live Dashboard
- https://happydao.github.io/torrino-dao-dashboard/

## Related Links
- Torrino website: https://torrino.space
- Treasury on Solscan: https://solscan.io/account/EKjb5grMX19c3cAZa5LQjqksDpqqVLTGZrswh79WkPdD

## What This Project Does
- Aggregates treasury value from tokens, staking, and NFTs.
- Computes stablecoin share and treasury split across Gen1/Gen2.
- Tracks listing vs fair value for Torrino DAO and Solnauta.
- Renders charts (with zoom/pan) and allocation views for desktop/mobile.
- Exposes public run logs.

## Project Structure
- `index.html`: dashboard UI + client-side chart logic.
- `scripts/totalvalue.js`: runs token/staking/NFT scripts and builds treasury totals.
- `scripts/calculate.js`: enriches totals with SOL price, listing data, and writes dashboard aggregates.
- `scripts/token.js`, `scripts/staking.js`, `scripts/nft.js`: asset-level collectors.
- `scripts/prune-logs.js`: keeps logs history bounded.

### Data Outputs
- `data.json`: legacy aggregate payload (keep shape stable).
- `data/summary.json`: aggregate payload with exact totals and metadata.
- `data/tokens.json`: token-level details.
- `data/staking.json`: staking-level details.
- `data/nfts.json`: NFT-level details.
- `logs/latest.txt`, `logs/latest.json`: latest public run logs.

## Requirements
- Node.js 18+ (recommended)
- npm

## Environment Variables
Create a `.env` file in project root:

```bash
TENSOR_API_KEY=your_tensor_api_key
```

Used by `scripts/calculate.js` to fetch active listing prices.

## Install
```bash
npm install
```

## Run Data Pipeline
Generate fresh data files:

```bash
npm run start
npm run calculate
npm run prune-logs
```

Notes:
- `npm run start` writes `totalvalue_output.json`.
- `npm run calculate` updates `data.json` and `data/summary.json`.

## Run Dashboard Locally
Static preview (example):

```bash
python3 -m http.server 8080
```

Then open:
- http://127.0.0.1:8080/

## Deployment
The dashboard is published via GitHub Pages at:
- https://happydao.github.io/torrino-dao-dashboard/

## Notes for Contributors
- Keep `data.json` backward compatible.
- Prefer updating `data/summary.json` for richer metrics.
- If you change chart/table behavior, verify both desktop and mobile layouts.
