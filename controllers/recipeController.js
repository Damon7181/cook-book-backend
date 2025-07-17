const prisma = require("../prisma/client");
const { GoogleGenAI, Type } = require("@google/genai");

async function getAllRecipes(req, res) {
  const recipes = await prisma.recipe.findMany({
    include: {
      author: true,
      comments: true,
      ratings: true,
      ingredients: false,
      instructions: false,
    },
  });
  res.json(recipes);
}

async function createRecipe(req, res) {
  const { videoUrl } = req.body;
  let recipeData = req.body;
  console.log("Received videoUrl and data:", videoUrl, recipeData);

  if (videoUrl) {
    try {
      // Use documented Gemini 1.5 Pro API for YouTube video summarization
      const { GoogleGenerativeAI } = require("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      const result = await model.generateContent([
        "Extract structured recipe information (title, description, cuisine, image_URL, cookingTime, ingredients, instructions, servings, difficulty, tags) ONLY if the video is a real recipe or cooking video. Do NOT invent or generalize. Use the actual recipe and steps shown in the video. If the video is not a recipe, return nothing.",
        {
          fileData: {
            fileUri: videoUrl,
          },
        },
      ]);
      const text = result.response.text();
      let geminiJson;
      try {
        geminiJson = JSON.parse(text);
        console.log("Parsed Gemini JSON:", geminiJson);
      } catch {
        return res.status(400).json({
          error:
            "The submitted URL could not be processed. It may contain harmful or explicit material and cannot be fetched.",
          raw: text,
        });
      }
      // If Gemini returns nothing or empty/unsafe fields, block
      if (!geminiJson || !geminiJson.title || !geminiJson.image) {
        return res.status(400).json({
          error:
            "The submitted URL could not be processed. It may contain harmful or explicit material and cannot be fetched.",
          code: "HARMFUL_OR_EXPLICIT_URL",
          details: {
            url: videoUrl,
            reason: "Gemini did not return safe/valid data for this URL.",
          },
        });
      }
      recipeData = {
        title: geminiJson.title,
        description: geminiJson.description || "",
        cuisine: geminiJson.cuisine || "",
        image: geminiJson.image || "",
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

  // Image moderation (Google Vision SafeSearch) for both Gemini and manual input
  // if (recipeData.image) {
  //   try {
  //     const vision = require("@google-cloud/vision");
  //     const client = new vision.ImageAnnotatorClient();
  //     const [result] = await client.safeSearchDetection(recipeData.image);
  //     const safe = result.safeSearchAnnotation;
  //     if (safe) {
  //       const unsafeLikelihoods = ["LIKELY", "VERY_LIKELY"];
  //       if (
  //         unsafeLikelihoods.includes(safe.adult) ||
  //         unsafeLikelihoods.includes(safe.violence) ||
  //         unsafeLikelihoods.includes(safe.racy) ||
  //         unsafeLikelihoods.includes(safe.medical) ||
  //         unsafeLikelihoods.includes(safe.spoof)
  //       ) {
  //         return res.status(400).json({
  //           error:
  //             "The submitted URL contains an image that is harmful or explicit and cannot be fetched.",
  //         });
  //       }
  //     }
  //   } catch (err) {
  //     return res
  //       .status(500)
  //       .json({ error: "Image moderation failed: " + err.message });
  //   }
  // }

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
