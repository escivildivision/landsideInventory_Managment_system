const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

const allowedOrigins = [
    "https://landsidefrontend.netlify.app",
    "http://localhost:5173",
    "http://localhost:3000",
    process.env.FRONTEND_URL
].filter(Boolean);

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

// Layer 1: Force Content-Type for POST/PUT in case Netlify CDN strips it
app.use((req, res, next) => {
    if ((req.method === "POST" || req.method === "PUT") && req.body === undefined) {
        const ct = req.headers["content-type"] || "";
        if (!ct.includes("application/json")) {
            req.headers["content-type"] = "application/json";
        }
    }
    next();
});

// Layer 2: Standard JSON parser
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Layer 3: Final fallback — if body is still a raw string, parse it manually
// On Netlify, serverless-http may set req.body to the raw JSON string even after
// express.json() runs, so we must always re-parse if it's a string.
app.use((req, res, next) => {
    if (typeof req.body === "string") {
        try {
            req.body = JSON.parse(req.body);
        } catch (e) {
            req.body = {};
        }
    } else if (req.body === undefined) {
        req.body = {};
    }
    next();
});

const transaction = require("./routers/Transaction");
const products = require("./routers/Products");
const categories = require("./routers/Categories");
const inventory = require("./routers/Inventory");
const measurements = require("./routers/UnitRoutes")
// --- Routes ---

// GET all categories
app.use("/api/categories", categories);
app.use("/api/products", products);
app.use("/api/inventory", inventory);
app.use("/api/transaction", transaction)
app.use("/api/measurements", measurements)

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