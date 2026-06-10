require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

// Test route — open http://localhost:5000 to check
app.get("/", (req, res) => {
  const keyLoaded = process.env.REACT_APP_AI_API_KEY ? "✅ Key loaded" : "❌ Key NOT found";
  res.send(`Server is running. API Key status: ${keyLoaded}`);
});

app.post("/api/ai", async (req, res) => {
  console.log("📨 Received AI request...");
  
  const apiKey = process.env.REACT_APP_AI_API_KEY;
  
  if (!apiKey) {
    console.error("❌ API key not found in .env");
    return res.status(500).json({ error: "API key missing" });
  }

  console.log("🔑 API Key found:", apiKey.substring(0, 10) + "...");

  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      req.body,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
      }
    );
    console.log("✅ Groq responded successfully");
    res.json(response.data);
  } catch (error) {
    console.error("❌ Groq API error:", error.response?.data || error.message);
    res.status(500).json({ 
      error: "AI request failed",
      details: error.response?.data || error.message 
    });
  }
});

app.listen(5000, () => {
  console.log("✅ Proxy server running on http://localhost:5000");
  console.log("🔑 API Key status:", process.env.REACT_APP_AI_API_KEY ? "Loaded ✅" : "NOT FOUND ❌");
});