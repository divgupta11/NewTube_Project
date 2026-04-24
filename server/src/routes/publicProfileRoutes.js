const express = require("express");
const { getPublicProfileById } = require("../controllers/userController");
const { optionalProtect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/:userId", optionalProtect, getPublicProfileById);

module.exports = router;
