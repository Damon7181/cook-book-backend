// const axios = require("axios");

// async function extractRecipeFromUrl(req, res) {
//   const { url } = req.body;
//   if (!url) return res.status(400).json({ error: "URL is required" });

//   try {
//     // 1. Fetch HTML content
//     const htmlRes = await axios.get(url);
//     const htmlText = htmlRes.data;

//     // 2. Prepare prompt
//     const prompt = `
// Extract structured recipe information from the following webpage content:

// URL: ${url}

// Content:
// """
// ${htmlText}
// """

// Return the response in the following JSON format:

// {
//   "title": "...",
//   "cuisine": "...",
//   "prep_time": "...",
//   "cook_time": "...",
//   "total_time": "...",
//   "ingredients": ["..."],
//   "steps": ["..."],
//   "servings": "...",
//   "difficulty": "...",
//   "tags": ["..."]
// }
// `;

//     // 3. Call Gemini API
//     const geminiRes = await axios.post(
//       "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + process.env.GEMINI_API_KEY,
//       {
//         contents: [{ parts: [{ text: prompt }] }]
//       }
//     );

//     // 4. Parse and return Gemini response
//     const text = geminiRes.data.candidates?.[0]?.content?.parts?.[0]?.text;
//     let json;
//     try {
//       json = JSON.parse(text);
//     } catch {
//       return res.status(500).json({ error: "Failed to parse Gemini response", raw: text });
//     }
//     res.json(json);

//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// }

// module.exports = { extractRecipeFromUrl };
