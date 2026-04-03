const express = require("express");
const { toggleSubscribe, getChannelById } = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/channel/:channelId", getChannelById);
router.patch("/subscribe/:channelId", protect, toggleSubscribe);
router.post("/subscribe/:channelId", protect, toggleSubscribe);

module.exports = router;
