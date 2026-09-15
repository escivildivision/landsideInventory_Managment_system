const { sheets, SPREADSHEET_ID } = require("../config/googleSheets");

const getCategories = async (req, res) => {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "Categories",
        });
        res.json({ success: true, data: response.data.values });
    } catch (error) {
        console.error("Error reading categories:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

const addCategory = async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, error: "Category name is required" });
        }

        // Get existing IDs
        const idResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "Categories!A2:A",
        });

        const rows = idResponse.data.values || [];
        const nextId = rows.length > 0
            ? Math.max(...rows.map(r => Number(r && r[0]) || 0)) + 1
            : 1;

        const values = [[nextId, name.trim()]]

        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: "Categories!A:B",
            valueInputOption: "USER_ENTERED",
            insertDataOption: "INSERT_ROWS",
            requestBody: { values },
        });

        res.status(201).json({
            success: true,
            message: "Category added successfully",
            data: { id: nextId, name: name.trim() },
        });
    } catch (error) {
        console.error("Error adding category:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = { getCategories, addCategory };
