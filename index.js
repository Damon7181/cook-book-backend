const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const authRoutes = require("./routes/auth.js");
const userRoutes = require("./routes/users.js");
const recipeRoutes = require("./routes/recipes.js");

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/recipes", recipeRoutes);

app.get("/", (req, res) => res.send("API is running"));

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
