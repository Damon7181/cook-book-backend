const prisma = require("../prisma/client");
const { GoogleGenAI, Type } = require("@google/genai");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Function to create youtube tumbnail
function getYouTubeThumbnail(url) {
  const id = url.split("v=")[1]?.split("&")[0];
  return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
}

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

// async function createRecipe(req, res) {
//   const { videoUrl } = req.body;
//   let recipeData = req.body;
//   console.log("Received videoUrl and data:", videoUrl, recipeData);

//   if (videoUrl) {
//     try {
//       const { GoogleGenerativeAI } = require("@google/generative-ai");
//       const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
//       const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
//       const result = await model.generateContent([
//         "Extract structured recipe information like title, description, cuisine, image_URL(Specially from youtube link thumbnail), cookingTime, ingredients, instructions",
//         {
//           fileData: {
//             fileUri: videoUrl,

//           },

//         },

//       ]);
//       const text = result.response.text();
//       let geminiJson;
//       try {
//         geminiJson = JSON.parse(text);
//         console.log("Parsed Gemini JSON:", geminiJson);
//       } catch {
//         return res.status(400).json({
//           error:
//             "The submitted URL could not be processed. It may contain harmful or explicit material and cannot be fetched.",
//           raw: text,
//         });
//       }
//       // If Gemini returns nothing or empty/unsafe fields, block
//       if (!geminiJson || !geminiJson.title || !geminiJson.image) {
//         return res.status(400).json({
//           error:
//             "The submitted URL could not be processed. It may contain harmful or explicit material and cannot be fetched.",
//           code: "HARMFUL_OR_EXPLICIT_URL",
//           details: {
//             url: videoUrl,
//             reason: "Gemini did not return safe/valid data for this URL.",
//           },
//         });
//       }
//       recipeData = {
//         title: geminiJson.title,
//         description: geminiJson.description || "",
//         cuisine: geminiJson.cuisine || "",
//         image: geminiJson.image || "",
//         cookingTime: geminiJson.total_time || geminiJson.cook_time || "",
//         ingredients: (geminiJson.ingredients || []).map((i) => ({
//           name: i,
//           quantity: "",
//         })),
//         instructions: (geminiJson.steps || []).map((s, idx) => ({
//           step: idx + 1,
//           text: s,
//         })),
//       };
//     } catch (err) {
//       return res.status(500).json({ error: err.message });
//     }
//   }

//   // Image moderation (Google Vision SafeSearch) for both Gemini and manual input
//   // if (recipeData.image) {
//   //   try {
//   //     const vision = require("@google-cloud/vision");
//   //     const client = new vision.ImageAnnotatorClient();
//   //     const [result] = await client.safeSearchDetection(recipeData.image);
//   //     const safe = result.safeSearchAnnotation;
//   //     if (safe) {
//   //       const unsafeLikelihoods = ["LIKELY", "VERY_LIKELY"];
//   //       if (
//   //         unsafeLikelihoods.includes(safe.adult) ||
//   //         unsafeLikelihoods.includes(safe.violence) ||
//   //         unsafeLikelihoods.includes(safe.racy) ||
//   //         unsafeLikelihoods.includes(safe.medical) ||
//   //         unsafeLikelihoods.includes(safe.spoof)
//   //       ) {
//   //         return res.status(400).json({
//   //           error:
//   //             "The submitted URL contains an image that is harmful or explicit and cannot be fetched.",
//   //         });
//   //       }
//   //     }
//   //   } catch (err) {
//   //     return res
//   //       .status(500)
//   //       .json({ error: "Image moderation failed: " + err.message });
//   //   }
//   // }

//   const recipe = await prisma.recipe.create({
//     data: {
//       title: recipeData.title,
//       description: recipeData.description,
//       cuisine: recipeData.cuisine,
//       image: recipeData.image,
//       cookingTime: recipeData.cookingTime,
//       authorId: req.user.userId,
//       ingredients: { create: recipeData.ingredients },
//       instructions: { create: recipeData.instructions },
//     },
//   });
//   res.json(recipe);
// }

async function createRecipe(req, res) {
  const { videoUrl } = req.body;
  let recipeData = req.body;

  console.log("Received videoUrl and data:", videoUrl, recipeData);

  if (videoUrl) {
    try {
      // Init Gemini
      const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        config: {
          temperature: 0.4,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 2048,
        },
      });

      // Configure structured data format
      const structuredConfig = {
        title: { type: "string", description: "Recipe title" },
        description: {
          type: "string",
          description: "Brief recipe description",
        },
        cuisine: {
          type: "string",
          description: "Cuisine type (e.g., Italian, Mexican)",
        },
        image: { type: "string", description: "YouTube video thumbnail URL" },
        cook_time: { type: "string", description: "Cooking time duration" },
        total_time: {
          type: "string",
          description: "Total preparation and cooking time",
        },
        ingredients: {
          type: "array",
          items: { type: "string" },
          description: "List of ingredients",
        },
        steps: {
          type: "array",
          items: { type: "string" },
          description: "Step by step instructions",
        },
        servings: { type: "string", description: "Number of servings" },
        difficulty: { type: "string", description: "Recipe difficulty level" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Recipe tags/categories",
        },
      };

      // Prompt Gemini with URL and request structured data
      const result = await model.generateContent([
        {
          role: "user",
          parts: [
            {
              text: `You are a professional cooking assistant. Analyze this YouTube video and extract recipe information according to the structured format. Return only valid JSON without any markdown or explanations.`,
            },
            {
              inlineData: {
                mimeType: "application/json",
                data: JSON.stringify(structuredConfig),
              },
            },
            {
              fileData: {
                fileUri: videoUrl,
                mimeType: "video/*",
              },
            },
          ],
        },
      ]);
      //       const result = await model.generateContent([
      //         `You are a professional cooking assistant.
      // Analyze this YouTube video and extract detailed recipe information. Return only a **strict JSON** object in the following format and rules:

      // {
      //   "title": "string",
      //   "description": "string",
      //   "cuisine": "string",
      //   "image": "string (this must be the YouTube thumbnail URL, in the format: https://i.ytimg.com/vi/VIDEO_ID/maxresdefault.jpg)",
      //   "cook_time": "string",
      //   "total_time": "string",
      //   "ingredients": ["string"],
      //   "steps": ["string"],
      //   "servings": "string",
      //   "difficulty": "string",
      //   "tags": ["string"]
      // }

      //  For the "image" field:
      // - Extract the VIDEO_ID from the YouTube URL.
      // - Return the thumbnail in the format: https://i.ytimg.com/vi/OAZpSsu03VA/hq720.jpg?sqp=-oaymwFBCNAFEJQDSFryq4qpAzMIARUAAIhCGADYAQHiAQoIGBACGAY4AUAB8AEB-AG2CIACgA-KAgwIABABGH8gTygcMA8=&rs=AOn4CLCBltB6e7Krfb9j7D10T9QndA1i_w
      // - Do NOT use any other image source or broken URL format.

      // Only return valid JSON. Do not include markdown, explanations, or extra text.`,
      //         {
      //           fileData: {
      //             fileUri: videoUrl,
      //           },
      //         },
      //       ]);

      const text = result.response.text();

      let geminiJson;
      try {
        geminiJson = JSON.parse(text);
        console.log("Parsed Gemini JSON:", geminiJson);
      } catch {
        return res.status(400).json({
          error: "Gemini returned invalid JSON.",
          raw: text,
        });
      }

      // Use thumbnail fallback if needed
      if (!geminiJson.image || !geminiJson.image.startsWith("http")) {
        geminiJson.image = getYouTubeThumbnail(videoUrl);
      }

      // Prepare recipe data
      recipeData = {
        title: geminiJson.title,
        description: geminiJson.description || "",
        cuisine: geminiJson.cuisine || "",
        image: geminiJson.image,
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

  // Save to DB
  try {
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
  } catch (err) {
    res.status(500).json({ error: "Database error: " + err.message });
  }
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
