/* eslint-disable no-console */
require("dotenv").config();
const { verifyGmailCredentials, hasGmailEnvConfigured } = require("../src/services/gmail.service");

async function main() {
  if (!hasGmailEnvConfigured()) {
    console.error("FAIL: Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_SENDER_EMAIL in .env");
    process.exit(1);
  }
  const result = await verifyGmailCredentials();
  if (result.ok) {
    console.log("OK: Gmail credentials work. Sender:", result.sender);
    process.exit(0);
  }
  console.error("FAIL:", result.error);
  process.exit(1);
}

main();
