const express = require("express");
const { getProducts, addProduct } = require("../controllers/Products_Controller");

const router = express.Router();

router.get("/get", getProducts);
router.post("/add", addProduct);

module.exports = router;
