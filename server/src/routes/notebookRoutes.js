const express = require("express");
const {
  getNotebookSession,
  generateSummary,
  askQuestion,
  addNote,
  deleteNote
} = require("../controllers/notebookController");
const { optionalProtect } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/:videoId", optionalProtect, getNotebookSession);
router.post("/:videoId/summary", optionalProtect, generateSummary);
router.post("/:videoId/question", optionalProtect, askQuestion);
router.post("/:videoId/notes", optionalProtect, addNote);
router.delete("/:videoId/notes/:noteId", optionalProtect, deleteNote);

module.exports = router;
