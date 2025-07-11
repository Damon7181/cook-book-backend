const express = require("express");
const {
  getAllRecipes,
  createRecipe,
  getRecipe,
  updateRecipe,
  deleteRecipe,
  saveRecipe,
  cookRecipe,
  addComment,
  rateRecipe,
} = require("../controllers/recipeController.js");
const { authMiddleware } = require("../middleware/authMiddleware.js");
const router = express.Router();
router.get("/", getAllRecipes);
router.post("/", authMiddleware, createRecipe);
router.get("/:id", getRecipe);
router.put("/:id", authMiddleware, updateRecipe);
router.delete("/:id", authMiddleware, deleteRecipe);
router.post("/:id/save", authMiddleware, saveRecipe);
router.post("/:id/cook", authMiddleware, cookRecipe);
router.post("/:id/comment", authMiddleware, addComment);
router.post("/:id/rate", authMiddleware, rateRecipe);
module.exports = router;
