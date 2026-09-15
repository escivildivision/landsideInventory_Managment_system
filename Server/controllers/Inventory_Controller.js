const { sheets, SPREADSHEET_ID } = require("../config/googleSheets");
const { generateRegisterPDF } = require("../services/pdfservices");

const getInventory = async (req, res) => {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "Inventory",
        });
        res.json({ success: true, data: response.data.values });
    } catch (error) {
        console.error("Error reading inventory:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

const generateInventoryPdf = async (req, res) => {
    try {
        const category = req.query.category;
        // Fetch both Products and Transactions in parallel
        const [productsRes, txnRes] = await Promise.all([
            sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: "Products",
            }),
            sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: "Transcations",
            }),
        ]);

        const pdf = await generateRegisterPDF(
            productsRes.data.values || [],
            txnRes.data.values || [],
            { category }
        );

        res.set({
            "Content-Type": "application/pdf",
            "Content-Disposition": "attachment; filename=material-consumption-register.pdf",
            "Content-Length": pdf.length,
        });
        res.send(pdf);
    } catch (error) {
        console.error("Error generating register PDF:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

const AddInventory = async (req, res) => {
    try {
        const {
            date,
            product_id,
            product_name,
            category,
            unit,
            opening_balance,
            received_qty,
            issued_qty,
            remarks,
            job_slip_no
        } = req.body;

        // Get existing IDs
        const idResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "Inventory!A2:A",
        });

        const ids = idResponse.data.values || [];

        // Generate next ID
        const nextId = ids.length > 0
            ? Math.max(...ids.map(row => Number(row[0]) || 0)) + 1
            : 1;

        // Calculate closing balance
        const closing_balance =
            Number(opening_balance) +
            Number(received_qty) -
            Number(issued_qty);

        // Prepare row
        const values = [[
            nextId,
            date,
            product_id,
            product_name,
            category,
            unit,
            opening_balance,
            received_qty,
            issued_qty,
            closing_balance,
            remarks,
            job_slip_no || ''
        ]];

        // Add row to Google Sheet
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: "Inventory!A:L",
            valueInputOption: "USER_ENTERED",
            insertDataOption: "INSERT_ROWS",
            requestBody: {
                values: values
            }
        });

        res.status(201).json({
            success: true,
            message: "Inventory added successfully",
            data: response.data
        });

    } catch (error) {
        console.error("Error adding inventory:", error.message);

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

const DeleteInventory = async (req, res) => {
    try {
        const { id } = req.params;

        // Get sheet metadata to find the proper sheetId for the Inventory sheet
        const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        const sheet = meta.data.sheets.find(s => s.properties && s.properties.title === "Inventory");
        if (!sheet) {
            return res.status(500).json({ success: false, message: "Inventory sheet not found in spreadsheet" });
        }
        const sheetId = sheet.properties.sheetId;

        // Read the ID column (A) starting from row 2
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "Inventory!A2:A",
        });

        const rows = response.data.values || [];

        // Normalize and compare as strings to avoid type/whitespace mismatches
        const target = String(id).trim();
        const rowIndex = rows.findIndex(row => String((row && row[0]) || "").trim() === target);

        if (rowIndex === -1) {
            return res.status(404).json({ success: false, message: "Inventory not found" });
        }

        // Compute zero-based startIndex/endIndex for batchDelete (endIndex is exclusive)
        // A2 corresponds to sheet row index 1 in zero-based indexing
        const sheetRowNumber = rowIndex + 2; // 1-based sheet row number
        const startIndex = sheetRowNumber - 1; // zero-based inclusive
        const endIndex = startIndex + 1; // exclusive

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
                requests: [
                    {
                        deleteDimension: {
                            range: {
                                sheetId: sheetId,
                                dimension: "ROWS",
                                startIndex: startIndex,
                                endIndex: endIndex,
                            },
                        },
                    },
                ],
            },
        });

        res.status(200).json({ success: true, message: `Inventory with id ${id} deleted successfully` });
    } catch (error) {
        console.error("Error deleting inventory:", error);
        res.status(500).json({ success: false, error: error.message || String(error) });
    }
}


module.exports = { getInventory, generateInventoryPdf, AddInventory, DeleteInventory };
