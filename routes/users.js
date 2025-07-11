const express = require("express");
const {
  getProfile,
  followUser,
  unfollowUser,
} = require("../controllers/userController.js");
const { authMiddleware } = require("../middleware/authMiddleware.js");
const router = express.Router();
router.get("/me", authMiddleware, getProfile);
router.post(":id/follow", authMiddleware, followUser);
router.post(":id/unfollow", authMiddleware, unfollowUser);
module.exports = router;
