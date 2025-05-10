import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { OpenAI } from "openai";
import { CohereClient } from "cohere-ai";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Chunk from "./models/chunk.js";

dotenv.config();

// Configuration object - keeps all configurable elements in one place for easy updating
const config = {
  // Server configuration
  port: process.env.PORT || 3001,
  
  // NLP models configuration
  models: {
    embedding: "embed-english-v3.0",
    completion: "gpt-3.5-turbo",
    temperature: 0.1
  },
  
  // Content categories for semantic search
  categories: {
    about: {
      keywords: ["who", "about", "harsh", "background", "bio", "profile"],
      identifiers: ["#about", "about me:", "profile:", "bio:"]
    },
    projects: {
      keywords: ["projects", "portfolio", "work", "created", "built", "developed"],
      identifiers: ["#projects", "projects:", "portfolio:"],
      knownProjects: ["shopease", "chattify", "securenet"] // Can be dynamically loaded from DB
    },
    experience: {
      keywords: ["experience", "work", "history", "job", "career", "intern", "internship", "employment"],
      identifiers: ["#experience", "experience:", "work history:"],
      knownCompanies: ["excollo", "balaji exports", "freelance"] // Can be dynamically loaded from DB
    },
    education: {
      keywords: ["education", "study", "degree", "university", "college", "school", "course", "major", "academic"],
      identifiers: ["#education", "education:", "academic background:"],
      knownInstitutions: ["university", "college", "institute"] // Can be dynamically loaded from DB
    },
    services: {
      keywords: ["services", "offer", "offers", "providing", "provide", "do", "can do", "capabilities"],
      identifiers: ["#services", "services:", "offerings:"]
    }
  },
  
  // Greeting patterns (can be extended)
  greetings: {
    exactMatches: [
      'hi', 'hello', 'hey', 'greetings', 
      'good morning', 'good afternoon', 'good evening',
      'yo', 'sup', 'howdy', 'hola'
    ],
    patterns: [
      /^h+[aei]+\W*$/i,         // hi, hiii, heeey, etc.
      /^h+e+l+o+\W*$/i,         // hello, helloo, etc.
      /^h+e+y+\W*$/i,           // hey, heyyy, etc.
      /^yo+\W*$/i,              // yo, yoo, etc.
      /^s+u+p+\W*$/i,           // sup, suuup, etc.
      /^how(dy|'?s it going)\W*$/i,  // howdy, hows it going, etc.
      /^what'?s? up\W*$/i       // whats up, what up, etc.
    ]
  },
  
  // Response templates
  responses: {
    greeting: "Hello! I'm an AI assistant that can tell you about Harsh's experience, projects, and skills. What would you like to know?",
    notFound: "I don't have enough information to answer that question. Could you ask something about Harsh's experience, projects, or skills instead?",
    notRelated: "I'm an assistant focused on providing information about Harsh. I can tell you about his experience, projects, and skills. What would you like to know about Harsh?"
  },
  
  // Control variables
  maxChunks: 5, // Reduced from 7 to reduce verbosity
  minScore: 0.6, // Minimum similarity score to consider a chunk relevant
  
  // System prompt template - simplified for shorter responses
  systemPrompt: "You are a concise assistant for Harsh's portfolio. Format responses clearly but use at most 3-4 sentences total. Be direct and brief while maintaining accuracy. Avoid unnecessary detail or repetition.",
  
  // User prompt template - simplified and focused on brevity
  userPromptTemplate: `You are an AI assistant that provides BRIEF information about Harsh's portfolio.

IMPORTANT:
1. Keep ALL responses UNDER 4 SENTENCES TOTAL - this is critical
2. For lists, use at most 2-3 bullet points
3. For projects, just give a 1-2 sentence summary
4. For experience, just list the company name and core responsibility
5. Never repeat information
6. Focus on the specific question asked

Context:
{context}

User Question: {question}
Answer (REMEMBER TO BE EXTREMELY BRIEF - 2-4 SENTENCES MAX):`
};

const app = express();
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.com'] 
    : ['http://localhost:3000']
}));
app.use(bodyParser.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

// Helper functions
const cosineSimilarity = (a, b) => {
  let dot = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Improved greeting detection with configuration-based approach
 * @param {string} text - User input to check
 * @returns {boolean} True if the text is recognized as a greeting
 */
function isGreeting(text) {
  const normalized = text.toLowerCase().trim();
  
  // Check exact matches from config
  if (config.greetings.exactMatches.includes(normalized)) {
    return true;
  }
  
  // Check regex patterns from config
  return config.greetings.patterns.some(regex => regex.test(normalized));
}

/**
 * Detects intent from user question
 * @param {string} question - The user's question
 * @returns {Object} Map of category to relevance score
 */
function detectIntent(question) {
  const normalized = question.toLowerCase().trim();
  const intent = {};
  
  // Check each category for keyword matches
  Object.entries(config.categories).forEach(([category, data]) => {
    const keywordMatches = data.keywords.filter(keyword => 
      normalized.includes(keyword)
    ).length;
    
    intent[category] = keywordMatches > 0 ? true : false;
  });
  
  return intent;
}

/**
 * Determines if the question is about Harsh or his portfolio
 * @param {string} question - The user's question
 * @returns {boolean} True if related to Harsh, false otherwise
 */
function isHarshRelated(question) {
  const normalized = question.toLowerCase().trim();
  
  // Check if question explicitly mentions Harsh
  if (normalized.includes('harsh')) {
    return true;
  }
  
  // Check if any intent category is detected
  const intent = detectIntent(question);
  if (Object.values(intent).some(Boolean)) {
    return true;
  }
  
  // Check for known project or company mentions
  const allKnownTerms = [
    ...config.categories.projects.knownProjects || [],
    ...config.categories.experience.knownCompanies || [],
    ...config.categories.education.knownInstitutions || []
  ];
  
  if (allKnownTerms.some(term => normalized.includes(term.toLowerCase()))) {
    return true;
  }
  
  // List of common portfolio-related terms
  const portfolioTerms = [
    'portfolio', 'website', 'github', 'link', 'project', 'resume', 
    'skill', 'tech', 'stack', 'experience', 'job', 'work', 'contact',
    'education', 'degree', 'university', 'college'
  ];
  
  if (portfolioTerms.some(term => normalized.includes(term))) {
    return true;
  }
  
  return false;
}

/**
 * Get relevant chunks based on intent and semantic similarity
 * @param {Array} chunks - All available chunks
 * @param {Object} intent - Intent mapping from detectIntent
 * @param {Array} userEmbedding - User question embedding
 * @returns {Array} Relevant chunks with their scores
 */
function getRelevantChunks(chunks, intent, userEmbedding) {
  // First, compute similarity scores for all chunks
  const rankedChunks = chunks
    .map(chunk => ({ 
      chunk, 
      score: cosineSimilarity(userEmbedding, chunk.embedding) 
    }))
    .sort((a, b) => b.score - a.score);
  
  // Create a set to track selected chunk IDs to avoid duplicates
  const selectedChunkIds = new Set();
  let selectedChunks = [];
  
  // Helper function to safely add chunks without duplicates
  const addChunk = (chunk, score) => {
    if (!selectedChunkIds.has(chunk._id.toString()) && selectedChunks.length < config.maxChunks) {
      selectedChunks.push({ chunk, score });
      selectedChunkIds.add(chunk._id.toString());
      return true;
    }
    return false;
  };
  
  // For each category in the intent, find relevant chunks
  Object.entries(intent).forEach(([category, isRelevant]) => {
    if (!isRelevant) return;
    
    const categoryData = config.categories[category];
    
    // Find chunks based on category identifiers
    chunks.filter(chunk => {
      const content = chunk.content.toLowerCase();
      return categoryData.identifiers.some(id => content.includes(id));
    }).forEach(chunk => addChunk(chunk, 1.0));
    
    // For projects and experience, add known items if they're in the config
    if (category === 'projects' && categoryData.knownProjects) {
      chunks.filter(chunk => {
        const content = chunk.content.toLowerCase();
        return categoryData.knownProjects.some(project => content.includes(project));
      }).forEach(chunk => addChunk(chunk, 0.9));
    }
    
    if (category === 'experience' && categoryData.knownCompanies) {
      chunks.filter(chunk => {
        const content = chunk.content.toLowerCase();
        return categoryData.knownCompanies.some(company => content.includes(company));
      }).forEach(chunk => addChunk(chunk, 0.9));
    }
    
    if (category === 'education' && categoryData.knownInstitutions) {
      chunks.filter(chunk => {
        const content = chunk.content.toLowerCase();
        return categoryData.knownInstitutions.some(institution => content.includes(institution));
      }).forEach(chunk => addChunk(chunk, 0.9));
    }
  });
  
  // Add top semantic matches if we haven't reached our limit
  for (const rankedChunk of rankedChunks) {
    if (selectedChunks.length >= config.maxChunks || rankedChunk.score < config.minScore) break;
    addChunk(rankedChunk.chunk, rankedChunk.score);
  }
  
  return selectedChunks;
}

async function startServer() {
  console.log("🔍 MONGO_URI:", process.env.MONGODB_URI);

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("✅ Connected to MongoDB");

  app.post("/api/chat", async (req, res) => {
    const { question } = req.body;
    
    console.log(`Received question: "${question}"`);

    // Check if it's a greeting
    if (isGreeting(question)) {
      console.log("Greeting detected, returning welcome message");
      return res.json({ 
        answer: config.responses.greeting
      });
    }
    
    // Check if question is related to Harsh
    if (!isHarshRelated(question)) {
      console.log("Non-Harsh related question detected, returning redirect message");
      return res.json({
        answer: config.responses.notRelated
      });
    }

    // Generate embeddings for the question
    const cohereRes = await cohere.embed({
      texts: [question],
      model: config.models.embedding,
      inputType: "search_query",
    });

    const userEmbedding = cohereRes.embeddings[0];

    // Fetch all chunks from database
    const chunks = await Chunk.find();
    console.log(`Found ${chunks.length} chunks in database`);

    // Detect intent and get relevant chunks
    const intent = detectIntent(question);
    console.log("Detected intent:", intent);
    
    const selectedChunks = getRelevantChunks(chunks, intent, userEmbedding);
    
    // Log selected chunks with scores
    selectedChunks.forEach((item, i) => {
      console.log(`Selected chunk ${i+1} (score: ${item.score.toFixed(3)}): ${item.chunk.content.substring(0, 40)}...`);
    });

    // Handle empty results
    if (!selectedChunks.length) {
      return res.json({ 
        answer: config.responses.notFound
      });
    }

    const combinedContent = selectedChunks.map(item => item.chunk.content).join("\n\n");

    // Use template for user prompt
    const userPrompt = config.userPromptTemplate
      .replace("{context}", combinedContent)
      .replace("{question}", question);

    const completion = await openai.chat.completions.create({
      model: config.models.completion,
      messages: [
        { 
          role: "system", 
          content: config.systemPrompt
        },
        { role: "user", content: userPrompt }
      ],
      temperature: config.models.temperature,
    });

    res.json({ answer: completion.choices[0].message.content });
  });

  // Add a simple health check endpoint
  app.get("/health", (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Server is running!' });
  });

  app.listen(config.port, () => {
    console.log(`🚀 Server running on http://localhost:${config.port}`);
  });
}

startServer().catch(console.error);