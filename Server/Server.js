const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());
const transaction = require("./routers/Transaction");
const products = require("./routers/Products");
const categories = require("./routers/Categories");
const inventory = require("./routers/Inventory");

const { sheets, SPREADSHEET_ID } = require("./config/googleSheets");

// --- Routes ---

// GET all categories
app.use("/api/categories", categories);
app.use("/api/products", products);
app.use("/api/inventory", inventory);
app.use("/api/transaction", transaction)

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
});