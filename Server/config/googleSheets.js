const { google } = require("googleapis");

const formatPrivateKey = (key) => {
    if (!key) return undefined;
    let formatted = key.trim();
    // Remove surrounding double or single quotes if present
    if ((formatted.startsWith('"') && formatted.endsWith('"')) ||
        (formatted.startsWith("'") && formatted.endsWith("'"))) {
        formatted = formatted.slice(1, -1).trim();
    }
    // Replace escaped \n with actual newlines
    formatted = formatted.replace(/\\n/g, "\n");
    // Replace \r\n with \n
    formatted = formatted.replace(/\r\n/g, "\n");
    return formatted;
};

const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL ? process.env.GOOGLE_CLIENT_EMAIL.trim() : undefined,
        private_key: formatPrivateKey(process.env.GOOGLE_PRIVATE_KEY),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID ? process.env.SPREADSHEET_ID.trim() : undefined;

module.exports = { auth, sheets, SPREADSHEET_ID };

