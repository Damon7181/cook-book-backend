const prisma = require("../prisma/client.js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

async function signup(req, res) {
  const { name, email, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({
      data: { name, email, password: hashed },
    });
    res.json(user);
  } catch (e) {
    res.status(400).json({ error: "Email already exists" });
  }
}

async function login(req, res) {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.password)))
    return res.status(401).json({ error: "Invalid credentials" });
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
  res.json({ token, user });
}

module.exports = {
  signup,
  login,
};
