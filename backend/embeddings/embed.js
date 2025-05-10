// backend/embeddings/embed.js
import fs from "fs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { CohereClient } from "cohere-ai";
import Chunk from "../models/chunk.js";

dotenv.config();

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

await mongoose.connect(process.env.MONGODB_URI);

const rawText = fs.readFileSync("./embeddings/knowledge_base.txt", "utf-8");

const chunks = rawText
  .split(/\n\s*\n/)
  .map((chunk) => chunk.trim())
  .filter((chunk) => chunk.length > 0);

for (const content of chunks) {
  const embedRes = await cohere.embed({
    texts: [content],
    model: "embed-english-v3.0",
    inputType: "search_document",
  });

  const embedding = embedRes.embeddings[0];
  await Chunk.create({ content, embedding });
  console.log("✅ Stored chunk:", content.slice(0, 40) + "...");
}

console.log("🎉 All chunks processed.");
process.exit(0);
