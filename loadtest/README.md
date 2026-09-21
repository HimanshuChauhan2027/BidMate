# Bid load test

Proves that concurrent bids on one auction never lose an update.

Use a test database, not production. The setup script writes to whatever
`MONGO_URI` in `server/.env` points at.

1. Start the server with rate limits off, otherwise you will just measure
   the limiter: `cd server && RATE_LIMIT_DISABLED=true npm run dev`
   (on Windows PowerShell: `$env:RATE_LIMIT_DISABLED="true"; npm run dev`).
2. Create the test data:
   `cd server && node scripts/loadtestSetup.js --bidders 200`
3. Run the load (install k6 from https://k6.io):
   `k6 run -e BASE_URL=http://localhost:5000/api loadtest/k6-bids.js`
4. Check the result in the database:
   `cd server && node scripts/loadtestVerify.js <auctionId printed in step 2>`
5. Clean up: `cd server && node scripts/loadtestSetup.js --cleanup`

Add `loadtest/tokens.json` to `.gitignore` (valid JWTs for test users).

## What to report

From the k6 summary: accepted vs rejected bids, `server_errors` (should be 0;
HTTP 429 also counts as an error, which means the limiter was still on),
and p95 of `place_bid`. From the verify script: PASS and the final bid count.
Only quote numbers you measured yourself, and say what hardware and database
you ran on.
