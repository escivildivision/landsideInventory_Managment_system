const express = require("express");
const { sheets, SPREADSHEET_ID } = require("../config/googleSheets");

const router = express.Router();

const { getTransactions, getTransactionById, AddNewTransaction, DeleteTransaction, UpdateTransaction, generateTransactionPdf } = require("../controllers/Transaction_Controller");

router.get("/get", getTransactions);
router.get("/get/:id", getTransactionById);
router.get("/pdf", generateTransactionPdf);
router.post("/add", AddNewTransaction);
router.put("/update/:id", UpdateTransaction);
router.delete("/delete/:id", DeleteTransaction);



module.exports = router;