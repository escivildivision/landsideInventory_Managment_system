const { google } = require("googleapis");

const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY
            ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
            : undefined,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

module.exports = { auth, sheets, SPREADSHEET_ID };
