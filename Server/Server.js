const express = require("express");
const cors = require("cors");
require("dotenv").config();

const allowedOrigins = [
    "https://landsidefrontend.netlify.app",
    "http://localhost:5173",
    "http://localhost:3000"
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(null, true);
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));
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

// Root health check endpoint
app.get("/api", (req, res) => {
    res.json({ message: "LandsideInventory Backend API running!" });
});

app.get("/", (req, res) => {
    res.json({ message: "LandsideInventory Backend API running!" });
});

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

module.exports = app;