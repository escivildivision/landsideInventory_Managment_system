const { sheets, SPREADSHEET_ID } = require("../config/googleSheets");
const { generateRegisterPDF } = require("../services/pdfservices");

/**
 * Recalculate inventory for a product by aggregating ALL its transactions.
 * Upserts a single row in the Inventory sheet for the given product_id.
 */
async function syncInventoryForProduct(productId) {
    try {
        // 1. Read all transactions
        const txnRes = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "Transcations!A2:J",
        });
        const txnRows = txnRes.data.values || [];

        // Columns: 0=ID, 1=Date, 2=JobSlip, 3=ProductID, 4=ProductName, 5=Category, 6=Unit, 7=Type, 8=Qty, 9=Remarks
        const productTxns = txnRows.filter(
            (row) => String(row[3] || "").trim() === String(productId).trim()
        );

        // 2. Aggregate quantities by transaction type
        let opening = 0, received = 0, issued = 0;
        let productName = "", category = "", unit = "", latestDate = "";

        for (const row of productTxns) {
            const type = String(row[7] || "").trim().toLowerCase();
            const qty = Number(row[8]) || 0;
            const date = row[1] || "";

            if (type === "opening") opening += qty;
            else if (type === "received") received += qty;
            else if (type === "issued") issued += qty;

            // Keep the latest product info
            productName = row[4] || productName;
            category = row[5] || category;
            unit = row[6] || unit;
            if (date > latestDate) latestDate = date;
        }

        const closing = opening + received - issued;

        // 3. Check if product already exists in the Inventory sheet
        const invRes = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "Inventory!A2:L",
        });
        const invRows = invRes.data.values || [];

        // Inventory columns: 0=ID, 1=Date, 2=ProductID, 3=ProductName, 4=Category, 5=Unit,
        //                    6=Opening, 7=Received, 8=Issued, 9=Closing, 10=Remarks, 11=JobSlipNo
        const invIndex = invRows.findIndex(
            (row) => String(row[2] || "").trim() === String(productId).trim()
        );

        if (invIndex !== -1) {
            // 4a. Update existing inventory row
            const sheetRow = invIndex + 2; // 1-based row number
            const existingId = invRows[invIndex][0];
            const existingRemarks = invRows[invIndex][10] || "";
            const existingJobSlip = invRows[invIndex][11] || "";

            const updatedRow = [[
                existingId,
                latestDate,
                productId,
                productName,
                category,
                unit,
                opening,
                received,
                issued,
                closing,
                existingRemarks,
                existingJobSlip,
            ]];

            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `Inventory!A${sheetRow}:L${sheetRow}`,
                valueInputOption: "RAW",
                requestBody: { values: updatedRow },
            });
        } else if (productTxns.length > 0) {
            // 4b. Create new inventory row
            const idRes = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: "Inventory!A2:A",
            });
            const ids = idRes.data.values || [];
            const nextId = ids.length > 0
                ? Math.max(...ids.map((r) => Number(r[0]) || 0)) + 1
                : 1;

            const newRow = [[
                nextId,
                latestDate,
                productId,
                productName,
                category,
                unit,
                opening,
                received,
                issued,
                closing,
                "",
                "",
            ]];

            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: "Inventory!A:L",
                valueInputOption: "RAW",
                insertDataOption: "INSERT_ROWS",
                requestBody: { values: newRow },
            });
        }

        console.log(`Inventory synced for product ${productId}: Opening=${opening}, Received=${received}, Issued=${issued}, Closing=${closing}`);
    } catch (error) {
        console.error(`Error syncing inventory for product ${productId}:`, error.message);
    }
}

const getTransactions = async (req, res) => {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "Transcations",
        });
        res.json({ success: true, data: response.data.values });
    } catch (error) {
        console.error("Error reading transactions:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};

const getTransactionById = async (req, res) => {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "Transcations!A2:I",
        });
        const target = String(req.params.id).trim();
        const transaction = (response.data.values || []).find(
            (row) => String((row && row[0]) || "").trim() === target
        );

        if (!transaction) {
            return res.status(404).json({ success: false, message: "Transaction not found" });
        }

        res.json({ success: true, data: transaction });
    } catch (error) {
        console.error("Error reading transaction:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};


const AddNewTransaction = async (req, res) => {
    try {

        const {
            date,
            product_id,
            product_name,
            category,
            unit,
            transaction_type,
            quantity,
            remarks,
            job_slip_no
        } = req.body;


        // Get existing IDs
        const idResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "Transcations!A2:A",
        });

        const ids = idResponse.data.values || [];

        // Generate next ID
        const nextId = ids.length > 0
            ? Math.max(...ids.map(row => Number(row[0]) || 0)) + 1
            : 1;

        // Prepare row
        const values = [[
            nextId,
            date,
            job_slip_no || '',
            product_id,
            product_name,
            category,
            unit,
            transaction_type,
            quantity,
            remarks
        ]];

        // Add row to Google Sheet
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: "Transcations!A:J",
            valueInputOption: "RAW",
            insertDataOption: "INSERT_ROWS",
            requestBody: {
                values: values
            }
        });

        // Sync inventory for this product
        await syncInventoryForProduct(product_id);

        res.status(201).json({
            success: true,
            message: "Transaction added successfully",
            data: response.data
        });


    }
    catch (error) {
        console.error("Error reading transactions:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
}


const DeleteTransaction = async (req, res) => {
    try {
        const { id } = req.params;

        // Get sheet metadata to find the proper sheetId for the Inventory sheet
        const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
        const sheet = meta.data.sheets.find(s => s.properties && s.properties.title === "Transcations");
        if (!sheet) {
            return res.status(500).json({ success: false, message: "Transaction sheet not found in spreadsheet" });
        }
        const sheetId = sheet.properties.sheetId;

        // Read all columns to get product_id before deleting
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "Transcations!A2:J",
        });

        const rows = response.data.values || [];

        // Normalize and compare as strings to avoid type/whitespace mismatches
        const target = String(id).trim();
        const rowIndex = rows.findIndex(row => String((row && row[0]) || "").trim() === target);

        if (rowIndex === -1) {
            return res.status(404).json({ success: false, message: "Transaction not found" });
        }

        // Save the product_id before deleting so we can sync inventory after
        const deletedProductId = rows[rowIndex][3];

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

        // Sync inventory after deletion
        if (deletedProductId) {
            await syncInventoryForProduct(deletedProductId);
        }

        res.status(200).json({ success: true, message: `Transaction with id ${id} deleted successfully` });
    } catch (error) {
        console.error("Error deleting transaction:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }

}

const UpdateTransaction = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            date,
            product_id,
            product_name,
            category,
            unit,
            transaction_type,
            quantity,
            remarks,
            job_slip_no,
        } = req.body;

        // Read full row data to detect if product changed
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: "Transcations!A2:J",
        });
        const rows = response.data.values || [];
        const target = String(id).trim();
        const rowIndex = rows.findIndex((row) => String((row && row[0]) || "").trim() === target);

        if (rowIndex === -1) {
            return res.status(404).json({ success: false, message: "Transaction not found" });
        }

        // Save old product_id in case product was changed
        const oldProductId = rows[rowIndex][3];

        const sheetRowNumber = rowIndex + 2;
        const values = [[
            rows[rowIndex][0],
            date,
            job_slip_no || '',
            product_id,
            product_name,
            category,
            unit,
            transaction_type,
            quantity,
            remarks,
        ]];

        const updateResponse = await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `Transcations!A${sheetRowNumber}:J${sheetRowNumber}`,
            valueInputOption: "RAW",
            requestBody: { values },
        });

        // Sync inventory for the current product
        await syncInventoryForProduct(product_id);

        // If product was changed, also sync the old product
        if (oldProductId && String(oldProductId).trim() !== String(product_id).trim()) {
            await syncInventoryForProduct(oldProductId);
        }

        res.status(200).json({
            success: true,
            message: "Transaction updated successfully",
            data: updateResponse.data,
        });
    } catch (error) {
        console.error("Error updating transaction:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
};


const generateTransactionPdf = async (req, res) => {
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


module.exports = { getTransactions, getTransactionById, AddNewTransaction, DeleteTransaction, UpdateTransaction, generateTransactionPdf };