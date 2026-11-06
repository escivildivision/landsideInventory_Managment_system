const express = require("express");
const { getProducts, addProduct, updateProduct, deleteProduct } = require("../controllers/Products_Controller");

const router = express.Router();

router.get("/get", getProducts);
router.post("/add", addProduct);
router.put("/update/:id", updateProduct);
router.delete("/delete/:id", deleteProduct);

module.exports = router;

