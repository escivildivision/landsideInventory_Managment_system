const express = require("express");
const { sheets } = require("../config/googleSheets");

const router = express.Router();

router.get("/get", async (req, res) => {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.SPREADSHEET_ID,
            range: "Measurements!B2:B50",
        });
        const rows = response.data.values || [];
        const units = rows.flat();
        return res.status(200).json({ success: true, data: units })
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
})
module.exports = router
