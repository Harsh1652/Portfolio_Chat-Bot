import { CohereClient } from "cohere-ai";
import { OpenAI } from "openai";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// MongoDB Schema
const chunkSchema = new mongoose.Schema({
  content: { type: String, required: true },
  embedding: { type: [Number], required: true }
});

// Cache connection for serverless environment
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) return cachedDb;
  
  const client = await mongoose.connect(process.env.MONGODB_URI);
  cachedDb = client.connection;
  return cachedDb;
}

// Helper functions
const cosineSimilarity = (a, b) => {
  let dot = 0.0, normA = 0.0, normB = 0.0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

// The handler should work with the request body format from your frontend
export default async function handler(req, res) {
  // Make sure this line captures the question correctly
  const { question } = req.body;
  
  // Add at the beginning of your function
  console.log("API route hit:", req.url);
  console.log("Request body:", req.body);

  // Handle CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await connectToDatabase();
    
    // Check if it's a greeting
    if (question.toLowerCase().trim() === 'hi' || 
        question.toLowerCase().trim() === 'hello' ||
        question.toLowerCase().trim() === 'hey') {
      return res.json({ 
        answer: "Hello! I'm an AI assistant that can tell you about Harsh's experience, projects, and skills. What would you like to know?"
      });
    }

    // Initialize Cohere client for embeddings
    const cohere = new CohereClient({
      token: process.env.COHERE_API_KEY,
    });
    
    // Generate embeddings for the question
    const cohereRes = await cohere.embed({
      texts: [question],
      model: "embed-english-v3.0",
      inputType: "search_query",
    });

    const userEmbedding = cohereRes.embeddings[0];

    // Define Chunk model for this function
    const Chunk = mongoose.models.Chunk || mongoose.model('Chunk', chunkSchema);

    // Fetch all chunks from database
    const chunks = await Chunk.find();
    console.log(`Found ${chunks.length} chunks in database`);
    
    if (chunks.length === 0) {
      return res.json({ answer: "I don't have enough information to answer that question. Could you ask something about Harsh's experience, projects, or skills instead?" });
    }

    // Find the most relevant chunks
    const rankedChunks = chunks
      .map(chunk => ({ 
        chunk, 
        score: cosineSimilarity(userEmbedding, chunk.embedding) 
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    
    console.log("Highest score:", rankedChunks[0].score);
    
    const combinedContent = rankedChunks.map(item => item.chunk.content).join("\n\n");

    // Initialize OpenAI
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Generate response using OpenAI
    const userPrompt = `You are an AI assistant that provides BRIEF information about Harsh's portfolio.

IMPORTANT:
1. Keep ALL responses UNDER 4 SENTENCES TOTAL - this is critical
2. For lists, use at most 2-3 bullet points
3. For projects, just give a 1-2 sentence summary
4. For experience, just list the company name and core responsibility
5. Never repeat information
6. Focus on the specific question asked

Context:
${combinedContent}

User Question: ${question}
Answer (REMEMBER TO BE EXTREMELY BRIEF - 2-4 SENTENCES MAX):`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { 
          role: "system", 
          content: "You are a concise assistant for Harsh's portfolio. Format responses clearly but use at most 3-4 sentences total. Be direct and brief while maintaining accuracy."
        },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.1,
    });

    res.json({ answer: completion.choices[0].message.content });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}