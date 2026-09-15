const express = require("express");
const { getInventory, generateInventoryPdf, AddInventory, DeleteInventory } = require("../controllers/Inventory_Controller");

const router = express.Router();


router.get("/get", getInventory);
router.get("/pdf", generateInventoryPdf);
router.post("/add", AddInventory);
router.delete("/delete/:id", DeleteInventory);

module.exports = router
