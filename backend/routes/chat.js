import express from "express";
import { CohereClient } from "cohere-ai";
import OpenAI from "openai";
import dotenv from "dotenv";
import Chunk from "../models/chunk.js";

dotenv.config();

const router = express.Router();

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function cosineSimilarity(vecA, vecB) {
  const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dot / (normA * normB);
}

router.post("/chat", async (req, res) => {
  const { message } = req.body;

  // 1. Get embedding of the user message
  const response = await cohere.embed({
    texts: [message],
    model: "embed-english-v3.0",
    inputType: "search_query",
  });

  const questionEmbedding = response.embeddings[0];

  // 2. Fetch all stored chunks
  const chunks = await Chunk.find();

  // 3. Calculate similarity for each chunk
  const scoredChunks = chunks.map((chunk) => ({
    content: chunk.content,
    score: cosineSimilarity(questionEmbedding, chunk.embedding),
  }));

  // 4. Sort and pick top 3 chunks
  const topChunks = scoredChunks.sort((a, b) => b.score - a.score).slice(0, 3);

  const context = topChunks.map((c) => c.content).join("\n");

  // 5. Ask OpenAI with the context
  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo", // or gpt-4o if you prefer
    messages: [
      {
        role: "system",
        content: `You are an AI assistant who knows everything about Harsh's portfolio. Use only this context to answer:\n${context}`,
      },
      {
        role: "user",
        content: message,
      },
    ],
  });

  const answer = completion.choices[0].message.content;
  res.json({ answer });
});

export default router;
