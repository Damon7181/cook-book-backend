const axios = require("axios");
const prisma = require("../prisma/client");

async function getAllRecipes(req, res) {
  const recipes = await prisma.recipe.findMany({
    include: {
      author: true,
      comments: true,
      ratings: true,
      ingredients: true,
      instructions: true,
    },
  });
  res.json(recipes);
}

async function createRecipe(req, res) {
  debugger;
  // If a videoUrl is provided, use Gemini to extract recipe details
  const { videoUrl } = req.body;
  let recipeData = req.body;
  // console.log("Received videoUrl:", videoUrl);
  // console.log("Received recipeData:", recipeData);
  

  if (videoUrl) {
    try {
      // 1. Fetch HTML content
      const htmlRes = await axios.get(videoUrl);
      // console.log("Fetched HTML content from:", htmlRes.request.res.responseUrl);
      const htmlText = htmlRes.data;
      // console.log("Fetched HTML content:", htmlText);

      // 2. Prepare prompt
      const prompt = `
                        Extract structured recipe information from the following webpage content:

                        URL: ${videoUrl}

                        Content:
                        """
                        ${htmlText}
                        """

                        Return the response in the following JSON format:

                        {
                          "title": "...",
                          "cuisine": "...",
                          "prep_time": "...",
                          "cook_time": "...",
                          "total_time": "...",
                          "ingredients": ["..."],
                          "steps": ["..."],
                          "servings": "...",
                          "difficulty": "...",
                          "tags": ["..."]
                        }
                        `;
      // console.log("Gemini API Key:", process.env.GEMINI_API_KEY);
      // 3. Call Gemini API
      const geminiRes = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
        }
      );
      // const geminiRes = await axios.post(
      //   `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      //   {
      //     contents: [{ parts: [{ text: prompt }] }],
      //   }
      // );

      // console.log("Gemini response:", geminiRes.data);

      // 4. Parse Gemini response
      const text = geminiRes.data.candidates?.[0]?.content?.parts?.[0]?.text;
      console.log("Gemini response text:", text);
      let geminiJson;
      try {
        geminiJson = JSON.parse(text);
      } catch {
        return res
          .status(500)
          .json({ error: "Failed to parse Gemini response", raw: text });
      }

      // Map Gemini response to recipeData
      recipeData = {
        title: geminiJson.title,
        description: geminiJson.description || "",
        cuisine: geminiJson.cuisine || "",
        image: req.body.image || "",
        cookingTime: geminiJson.total_time || geminiJson.cook_time || "",
        ingredients: (geminiJson.ingredients || []).map((i) => ({
          name: i,
          quantity: "",
        })),
        instructions: (geminiJson.steps || []).map((s, idx) => ({
          step: idx + 1,
          text: s,
        })),
      };
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Create recipe as before
  const recipe = await prisma.recipe.create({
    data: {
      title: recipeData.title,
      description: recipeData.description,
      cuisine: recipeData.cuisine,
      image: recipeData.image,
      cookingTime: recipeData.cookingTime,
      authorId: req.user.userId,
      ingredients: { create: recipeData.ingredients },
      instructions: { create: recipeData.instructions },
    },
  });
  res.json(recipe);
}

async function getRecipe(req, res) {
  const { id } = req.params;
  const recipe = await prisma.recipe.findUnique({
    where: { id },
    include: {
      author: true,
      comments: true,
      ratings: true,
      ingredients: true,
      instructions: true,
    },
  });
  if (!recipe) return res.status(404).json({ error: "Recipe not found" });
  res.json(recipe);
}

async function updateRecipe(req, res) {
  const { id } = req.params;
  const data = req.body;
  const recipe = await prisma.recipe.update({ where: { id }, data });
  res.json(recipe);
}

async function deleteRecipe(req, res) {
  const { id } = req.params;
  await prisma.recipe.delete({ where: { id } });
  res.json({ message: "Recipe deleted" });
}

async function saveRecipe(req, res) {
  const { id } = req.params;
  await prisma.savedRecipe.create({
    data: { userId: req.user.userId, recipeId: id },
  });
  res.json({ message: "Recipe saved" });
}

async function cookRecipe(req, res) {
  const { id } = req.params;
  await prisma.cookedRecipe.create({
    data: { userId: req.user.userId, recipeId: id },
  });
  res.json({ message: "Recipe marked as cooked" });
}

async function addComment(req, res) {
  const { id } = req.params;
  const { text } = req.body;
  const comment = await prisma.comment.create({
    data: { userId: req.user.userId, recipeId: id, text },
  });
  res.json(comment);
}

async function rateRecipe(req, res) {
  const { id } = req.params;
  const { value } = req.body;
  const rating = await prisma.rating.upsert({
    where: { userId_recipeId: { userId: req.user.userId, recipeId: id } },
    update: { value },
    create: { userId: req.user.userId, recipeId: id, value },
  });
  res.json(rating);
}

module.exports = {
  getAllRecipes,
  createRecipe,
  getRecipe,
  updateRecipe,
  deleteRecipe,
  saveRecipe,
  cookRecipe,
  addComment,
  rateRecipe,
};
