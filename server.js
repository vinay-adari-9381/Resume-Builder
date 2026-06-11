require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  const keyLoaded =
    process.env.REACT_APP_AI_API_KEY
      ? "✅ Key loaded"
      : "❌ Key NOT found";

  res.send(
    `Server running • ${keyLoaded}`
  );
});

app.post("/api/ai", async (req, res) => {

  const apiKey =
    process.env.REACT_APP_AI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "API key missing"
    });
  }

  try {

    const response =
      await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        req.body,
        {
          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${apiKey}`,
          },
        }
      );

    res.json(
      response.data
    );

  } catch (error) {

    console.error(
      error.response?.data ||
      error.message
    );

    res.status(500).json({
      error:
        "AI request failed",
      details:
        error.response?.data ||
        error.message
    });
  }
});

const PORT =
  process.env.PORT || 5000;

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Server running on ${PORT}`
    );
  }
);