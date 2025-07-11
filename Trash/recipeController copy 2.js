const prisma = require("../prisma/client");
const { GoogleGenAI, Type } = require("@google/genai");
const vision = require("@google-cloud/vision");

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
  const { videoUrl } = req.body;
  let recipeData = req.body;

  // Helper: moderate text for unsafe content (basic, can be replaced with a more advanced API)
  function containsUnsafeText(text) {
    const unsafeWords = [
      "porn",
      "sex",
      "nude",
      "violence",
      "drugs",
      "weapon",
      "kill",
      "murder",
      "abuse",
      "terror",
      "hate",
      "racist",
      "suicide",
      "blood",
      "gore",
      "explicit",
      "nsfw",
      "xxx",
      "adult",
      "gambling",
      "casino",
      "betting",
      "alcohol",
      "tobacco",
      "cigarette",
      "gun",
      "shoot",
      "rape",
      "molest",
      "incest",
      "child",
      "abduct",
      "exploit",
      "assault",
      "harass",
      "bully",
      "self-harm",
      "cut",
      "die",
      "death",
      "bomb",
      "explosion",
      "terrorist",
      "extremist",
      "behead",
      "torture",
      "execution",
      "orgy",
      "fetish",
      "bdsm",
      "bestiality",
      "zoophilia",
      "necrophilia",
      "pedophile",
      "pedo",
      "loli",
      "shota",
      "cp",
      "snuff",
      "snuff film",
      "snuff movie",
      "snuff video",
      "snuff content",
      "snuff material",
      "snuff media",
      "snuff footage",
      "snuff tape",
      "snuff recording",
      "snuff scene",
      "snuff act",
      "snuff murder",
      "snuff killing",
      "snuff execution",
      "snuff torture",
      "snuff beheading",
      "snuff decapitation",
      "snuff mutilation",
      "snuff dismemberment",
      "snuff cannibalism",
      "snuff necrophilia",
      "snuff bestiality",
      "snuff zoophilia",
      "snuff pedophilia",
      "snuff child",
      "snuff abuse",
      "snuff rape",
      "snuff molest",
      "snuff incest",
      "snuff exploitation",
      "snuff assault",
      "snuff harassment",
      "snuff bullying",
      "snuff self-harm",
      "snuff suicide",
      "snuff cut",
      "snuff die",
      "snuff death",
      "snuff bomb",
      "snuff explosion",
      "snuff terrorist",
      "snuff extremist",
      "snuff behead",
      "snuff torture",
      "snuff execution",
      "snuff orgy",
      "snuff fetish",
      "snuff bdsm",
      "snuff bestiality",
      "snuff zoophilia",
      "snuff necrophilia",
      "snuff pedophile",
      "snuff pedo",
      "snuff loli",
      "snuff shota",
      "snuff cp",
    ];
    if (!text) return false;
    const lower = text.toLowerCase();
    return unsafeWords.some((w) => lower.includes(w));
  }

  // If using Gemini, extract and moderate all fields
  if (videoUrl) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `Extract structured recipe information like title, description, cuisine, image_URL(Specially from youtube link thumbnail), cookingTime, ingredients, instructions from the following video or webpage URL: ${videoUrl}`;
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              cuisine: { type: Type.STRING },
              image: { type: Type.STRING },
              cook_time: { type: Type.STRING },
              total_time: { type: Type.STRING },
              ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
              steps: { type: Type.ARRAY, items: { type: Type.STRING } },
              servings: { type: Type.STRING },
              difficulty: { type: Type.STRING },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            propertyOrdering: [
              "title",
              "description",
              "cuisine",
              "image",
              "cook_time",
              "total_time",
              "ingredients",
              "steps",
              "servings",
              "difficulty",
              "tags",
            ],
          },
        },
      });
      let geminiJson;
      try {
        geminiJson = JSON.parse(response.text);
        console.log("Parsed Gemini JSON:", geminiJson);
      } catch {
        return res.status(500).json({
          error: "Failed to parse Gemini response",
          raw: response.text,
        });
      }
      // Moderate all fields for unsafe content
      const fieldsToCheck = [
        geminiJson.title,
        geminiJson.description,
        geminiJson.cuisine,
        ...(geminiJson.ingredients || []),
        ...(geminiJson.steps || []),
        ...(geminiJson.tags || []),
      ];
      for (const field of fieldsToCheck) {
        if (containsUnsafeText(field)) {
          return res
            .status(400)
            .json({ error: "Recipe contains unsafe or explicit content." });
        }
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
  } else {
    // If manual, moderate all fields
    const fieldsToCheck = [
      recipeData.title,
      recipeData.description,
      recipeData.cuisine,
      ...(recipeData.ingredients
        ? recipeData.ingredients.map((i) => i.name)
        : []),
      ...(recipeData.instructions
        ? recipeData.instructions.map((i) => i.text)
        : []),
      ...(recipeData.tags || []),
    ];
    for (const field of fieldsToCheck) {
      if (containsUnsafeText(field)) {
        return res
          .status(400)
          .json({ error: "Recipe contains unsafe or explicit content." });
      }
    }
  }

  // If there is an image, check with Google Vision SafeSearch
  if (recipeData.image) {
    try {
      const client = new vision.ImageAnnotatorClient();
      const [result] = await client.safeSearchDetection(recipeData.image);
      const safe = result.safeSearchAnnotation;
      if (safe) {
        const unsafeLikelihoods = ["LIKELY", "VERY_LIKELY"];
        if (
          unsafeLikelihoods.includes(safe.adult) ||
          unsafeLikelihoods.includes(safe.violence) ||
          unsafeLikelihoods.includes(safe.racy) ||
          unsafeLikelihoods.includes(safe.medical) ||
          unsafeLikelihoods.includes(safe.spoof)
        ) {
          return res
            .status(400)
            .json({ error: "Recipe image is unsafe or explicit." });
        }
      }
    } catch (err) {
      return res
        .status(500)
        .json({ error: "Image moderation failed: " + err.message });
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
