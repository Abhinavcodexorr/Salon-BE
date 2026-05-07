const { success } = require("../utils/response");
const {
  getGmailAuthorizationUrl,
  exchangeGmailCodeForTokens,
} = require("../services/gmail.service");

async function getAuthUrl(req, res, next) {
  try {
    const redirectUri = req.query.redirectUri ? String(req.query.redirectUri).trim() : undefined;
    const authUrl = getGmailAuthorizationUrl(redirectUri);
    success(
      res,
      {
        authUrl,
        instructions: "Open authUrl, complete consent, then call exchange-code with returned code.",
      },
      "Gmail authorization URL generated"
    );
  } catch (err) {
    next(err);
  }
}

async function exchangeCode(req, res, next) {
  try {
    const code = req.body?.code;
    const redirectUri = req.body?.redirectUri ? String(req.body.redirectUri).trim() : undefined;
    const tokens = await exchangeGmailCodeForTokens(code, redirectUri);
    success(
      res,
      {
        refreshToken: tokens.refresh_token || null,
        accessToken: tokens.access_token || null,
        expiryDate: tokens.expiry_date || null,
        scope: tokens.scope || null,
        tokenType: tokens.token_type || null,
      },
      "Gmail OAuth code exchanged successfully"
    );
  } catch (err) {
    next(err);
  }
}

module.exports = { getAuthUrl, exchangeCode };
