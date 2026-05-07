/* eslint-disable no-console */
require("dotenv").config();
const { google } = require("googleapis");

function getOAuth2Client(redirectUriOverride) {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const redirectUri =
    redirectUriOverride ||
    process.env.GMAIL_REDIRECT_URI ||
    "https://developers.google.com/oauthplayground";

  if (!clientId || !clientSecret) {
    throw new Error("Missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET in .env");
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

async function main() {
  const command = process.argv[2];
  const code = process.argv[3];
  const redirectUri = process.argv[4];

  if (!command || !["auth-url", "exchange"].includes(command)) {
    console.log(
      "Usage:\n" +
        "  node scripts/gmail-oauth.js auth-url [redirectUri]\n" +
        "  node scripts/gmail-oauth.js exchange <code> [redirectUri]"
    );
    process.exit(1);
  }

  const oauth2Client = getOAuth2Client(redirectUri);

  if (command === "auth-url") {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: ["https://www.googleapis.com/auth/gmail.send"],
    });
    console.log(authUrl);
    return;
  }

  if (!code) {
    throw new Error("Missing authorization code for exchange");
  }

  const { tokens } = await oauth2Client.getToken(code);
  console.log("refresh_token:", tokens.refresh_token || "");
  console.log("access_token:", tokens.access_token || "");
  console.log("expiry_date:", tokens.expiry_date || "");
}

main().catch((err) => {
  console.error("gmail-oauth error:", err.message);
  process.exit(1);
});
