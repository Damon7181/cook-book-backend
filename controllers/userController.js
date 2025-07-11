const prisma = require("../prisma/client.js");

async function getProfile(req, res) {
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    include: {
      authoredRecipes: true,
      savedRecipes: true,
      cookedRecipes: true,
      comments: true,
      ratings: true,
    },
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json(user);
}

async function followUser(req, res) {
  const { id } = req.params;
  if (id === req.user.userId)
    return res.status(400).json({ error: "Cannot follow yourself" });
  await prisma.follows.create({
    data: { followerId: req.user.userId, followingId: id },
  });
  res.json({ message: "Followed user" });
}

async function unfollowUser(req, res) {
  const { id } = req.params;
  await prisma.follows.delete({
    where: {
      followerId_followingId: { followerId: req.user.userId, followingId: id },
    },
  });
  res.json({ message: "Unfollowed user" });
}

module.exports = {
  getProfile,
  followUser,
  unfollowUser,
};
