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

const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { category, name, unit } = req.body;

        if (!id) return res.status(400).json({ success: false, error: "Product ID is required" });
        if (!name || !name.trim()) return res.status(400).json({ success: false, error: "Product name is required" });

        // Read all rows to find the row index of this product
        const readResp = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "Products!A:D",
        });
        const rows = readResp.data.values || [];
        // Row 0 is header; find the data row whose column A matches id
        const rowIdx = rows.findIndex((r, i) => i > 0 && String(r[0] || '').trim() === String(id).trim());
        if (rowIdx === -1) return res.status(404).json({ success: false, error: "Product not found" });

        // Sheets rows are 1-based, header is row 1, so data starts at row 2 → rowIdx+1
        const sheetRow = rowIdx + 1;
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `Products!A${sheetRow}:D${sheetRow}`,
            valueInputOption: "USER_ENTERED",
            requestBody: { values: [[id, category || '', name.trim(), unit || 'Nos']] },
        });

        res.json({ success: true, message: "Product updated", data: { id, category, name: name.trim(), unit } });
    } catch (error) {
        console.error("Error updating product:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ success: false, error: "Product ID is required" });

        const readResp = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "Products!A:D",
        });
        const rows = readResp.data.values || [];
        const rowIdx = rows.findIndex((r, i) => i > 0 && String(r[0] || '').trim() === String(id).trim());
        if (rowIdx === -1) return res.status(404).json({ success: false, error: "Product not found" });

        const sheetRow = rowIdx + 1;
        // Clear the entire row
        await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: `Products!A${sheetRow}:D${sheetRow}`,
        });

        res.json({ success: true, message: "Product deleted" });
    } catch (error) {
        console.error("Error deleting product:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = { getProducts, addProduct, updateProduct, deleteProduct };
