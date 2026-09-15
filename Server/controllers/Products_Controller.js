const { sheets, SPREADSHEET_ID } = require("../config/googleSheets");

const getProducts = async (req, res) => {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "Products",
        });
        res.json({ success: true, data: response.data.values });
    } catch (error) {
        console.error("Error reading products:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

const addProduct = async (req, res) => {
    try {
        const { category, name, unit } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, error: "Product name is required" });
        }

        // Get existing Product IDs from Products!A2:A
        const idResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "Products!A2:A",
        });

        const rows = idResponse.data.values || [];
        let maxNum = 0;
        rows.forEach(r => {
            const rawId = String((r && r[0]) || '').trim();
            const numPart = parseInt(rawId.replace(/\D/g, ''), 10);
            if (!isNaN(numPart) && numPart > maxNum) {
                maxNum = numPart;
            }
        });

        const nextNum = maxNum + 1;
        const productId = `P${String(nextNum).padStart(3, '0')}`;

        const values = [[
            productId,
            category || '',
            name.trim(),
            unit || 'Nos'
        ]];

        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: "Products!A:D",
            valueInputOption: "USER_ENTERED",
            insertDataOption: "INSERT_ROWS",
            requestBody: { values },
        });

        res.status(201).json({
            success: true,
            message: "Product added successfully",
            data: {
                id: productId,
                category: category || '',
                name: name.trim(),
                unit: unit || 'Nos'
            },
        });
    } catch (error) {
        console.error("Error adding product:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = { getProducts, addProduct };
