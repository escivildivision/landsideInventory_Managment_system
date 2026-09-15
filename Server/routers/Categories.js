const express = require("express");
const { getCategories, addCategory } = require("../controllers/Categories_Controller");
const router = express.Router();

router.get("/get", getCategories);
router.post("/add", addCategory);

module.exports = router;