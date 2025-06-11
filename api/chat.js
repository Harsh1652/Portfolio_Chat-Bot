import { OpenAI } from "openai";
import { CohereClient } from "cohere-ai";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

const config = {
  models: {
    embedding: "embed-english-v3.0",
    completion: "gpt-3.5-turbo",
    temperature: 0.1
  },
  
  responses: {
    greeting: "Hello! I'm an AI assistant that can tell you about Harsh's experience, projects, skills, contact information, and more. What would you like to know?",
    notFound: "I don't have enough information to answer that question. Could you ask something about Harsh's experience, projects, skills, contact information, or education instead?",
    notRelated: "I'm an assistant focused on providing information about Harsh. I can tell you about his experience, projects, skills, contact information, and education. What would you like to know about Harsh?",
    contact: "You can reach Harsh at: Email: harsh160502@gmail.com, Phone: +91 9982346893, LinkedIn: https://www.linkedin.com/in/harsh-gupta16/, GitHub: https://github.com/Harsh1652, Website: https://tinyurl.com/2ebnnt79",
    resume: "You can download Harsh's resume from: https://drive.google.com/file/d/1q3fo8tdYrtK6cIDZaKHKuDCsf4jSUtJP/view?usp=sharing",
    projects: "Harsh has worked on several key projects: ShopEase (e-commerce platform), Chattify (real-time chat application), SecureNet (security monitoring system), and Portfolio Chatbot (AI assistant for his portfolio). Which project would you like to know more about?"
  },
  
  systemPrompt: "You are a concise assistant for Harsh's portfolio. Format responses clearly but use at most 3-4 sentences total. Be direct and brief while maintaining accuracy. IMPORTANT: Always include GitHub repository links when they are mentioned in the provided context, especially for specific projects. For general questions about Harsh, refer to his main GitHub profile at https://github.com/Harsh1652."
};

const chunkSchema = new mongoose.Schema({
  content: { type: String, required: true },
  embedding: { type: [Number], required: true }
});

let cachedDb = null;
let Chunk = null;

async function connectToDatabase() {
  if (cachedDb && cachedDb.readyState === 1) {
    return cachedDb;
  }
  
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }

    const client = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      dbName: "chatbot"
    });

    cachedDb = client.connection;
    
    if (!Chunk) {
      Chunk = mongoose.models.Chunk || mongoose.model('Chunk', chunkSchema);
    }
    
    return cachedDb;
  } catch (error) {
    console.error("Database connection error:", error);
    throw error;
  }
}

const cosineSimilarity = (a, b) => {
  let dot = 0.0, normA = 0.0, normB = 0.0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

function isGreeting(text) {
  const greetings = ['hi', 'hello', 'hey', 'greetings'];
  return greetings.includes(text.toLowerCase().trim());
}

function isHarshRelated(question) {
  const normalized = question.toLowerCase();
  const harshTerms = [
    'harsh', 'his', 'him', 'he', 'harsh gupta',
    'portfolio', 'project', 'projects', 'skill', 'skills', 'experience', 'contact', 'resume',
    'shopease', 'chattify', 'securenet', 'secure net', 'chatbot', 'chat bot',
    'services', 'service', 'education', 'work', 'job', 'career',
    'technologies', 'tech', 'programming', 'developer', 'engineer',
    'about', 'who', 'what', 'tell me'
  ];
  return harshTerms.some(term => normalized.includes(term));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: "Question is required" });
    }

    const normalizedQuestion = question.toLowerCase().trim();
    
    if (isGreeting(normalizedQuestion)) {
      return res.json({ answer: config.responses.greeting });
    }

    if (!isHarshRelated(normalizedQuestion)) {
      return res.json({ answer: config.responses.notRelated });
    }

    // Handle direct queries first
    if (normalizedQuestion.includes('contact') || normalizedQuestion.includes('email') || normalizedQuestion.includes('phone') || normalizedQuestion.includes('reach')) {
      return res.json({ answer: config.responses.contact });
    }

    if (normalizedQuestion.includes('resume') || normalizedQuestion.includes('cv')) {
      return res.json({ answer: config.responses.resume });
    }
    
    // Handle general projects query (not specific project names)
    if ((normalizedQuestion.includes('project') || normalizedQuestion.includes('projects')) && 
        !normalizedQuestion.includes('securenet') && 
        !normalizedQuestion.includes('shopease') && 
        !normalizedQuestion.includes('chattify') &&
        !normalizedQuestion.includes('portfolio chatbot') &&
        !normalizedQuestion.includes('chatbot')) {
      return res.json({ answer: config.responses.projects });
    }

    // For all other queries (including specific projects, skills, experience, services, etc.), 
    // try to use the database
    try {
      console.log("Attempting database connection...");
      const db = await connectToDatabase();
      console.log("Database connected successfully");
      
      console.log("Generating embeddings for question:", normalizedQuestion);
      const userEmbedding = await cohere.embed({
        texts: [normalizedQuestion],
        model: config.models.embedding,
        input_type: "search_query"
      });

      const embedding = userEmbedding.embeddings[0];
      console.log("Generated embedding with length:", embedding.length);

      console.log("Fetching chunks from database...");
      const chunks = await Chunk.find({});
      console.log("Retrieved chunks count:", chunks.length);
      
      if (chunks.length === 0) {
        console.log("No chunks found in database - database might be empty");
        // Try to populate with some basic data if empty
        return res.json({ 
          answer: "I'm having trouble accessing the database right now. For specific information about Harsh's projects, skills, and experience, please try asking about his contact information or resume which I can provide directly." 
        });
      }

      // Log first chunk for debugging
      if (chunks.length > 0) {
        console.log("Sample chunk content:", chunks[0].content.substring(0, 100) + "...");
        console.log("Sample chunk embedding length:", chunks[0].embedding ? chunks[0].embedding.length : "No embedding");
      }

      const similarities = chunks.map((chunk, index) => {
        const similarity = cosineSimilarity(embedding, chunk.embedding);
        console.log(`Chunk ${index} similarity: ${similarity.toFixed(3)}`);
        
        // Add keyword bonus for better matching
        let keywordBonus = 0;
        const chunkText = chunk.content.toLowerCase();
        const questionText = normalizedQuestion.toLowerCase();
        
        // Check for direct keyword matches
        if (questionText.includes('skill') && chunkText.includes('skill')) keywordBonus += 0.2;
        if (questionText.includes('experience') && chunkText.includes('experience')) keywordBonus += 0.2;
        if (questionText.includes('education') && chunkText.includes('education')) keywordBonus += 0.2;
        if (questionText.includes('project') && chunkText.includes('project')) keywordBonus += 0.1;
        if (questionText.includes('about') && chunkText.includes('about')) keywordBonus += 0.2;
        if (questionText.includes('who') && chunkText.includes('about')) keywordBonus += 0.3;
        if (questionText.includes('harsh') && chunkText.includes('harsh')) keywordBonus += 0.1;
        
        // Special handling for "who is harsh" type questions - prioritize About and Contact chunks
        if ((questionText.includes('who is harsh') || questionText.includes('who harsh')) && 
            (chunkText.includes('#about') || chunkText.includes('#contact') || chunkText.includes('github - https://github.com/harsh1652'))) {
          keywordBonus += 0.6;
        }
        
        // Project-specific keyword matching with higher bonus
        if ((questionText.includes('shopease') || questionText.includes('shop ease')) && 
            chunkText.includes('shopease')) keywordBonus += 0.5;
        if ((questionText.includes('securenet') || questionText.includes('secure net')) && 
            chunkText.includes('securenet')) keywordBonus += 0.5;
        if (questionText.includes('chattify') && chunkText.includes('chattify')) keywordBonus += 0.5;
        if ((questionText.includes('portfolio chatbot') || questionText.includes('chatbot')) && 
            chunkText.includes('portfolio-chatbot')) keywordBonus += 0.5;
        
        // Additional specific keywords for projects
        if (questionText.includes('ecommerce') || questionText.includes('e-commerce')) {
          if (chunkText.includes('shopease') || chunkText.includes('e-commerce')) keywordBonus += 0.3;
        }
        if (questionText.includes('security') || questionText.includes('intrusion') || questionText.includes('vulnerability')) {
          if (chunkText.includes('securenet') || chunkText.includes('security') || chunkText.includes('intrusion')) keywordBonus += 0.3;
        }
        if (questionText.includes('chat') || questionText.includes('messaging')) {
          if (chunkText.includes('chattify') || chunkText.includes('chat')) keywordBonus += 0.3;
        }
        
        // GitHub repository queries
        if ((questionText.includes('github') || questionText.includes('repo') || questionText.includes('repository')) && 
            chunkText.includes('github')) keywordBonus += 0.4;
        
        const finalSimilarity = similarity + keywordBonus;
        console.log(`Chunk ${index} final similarity (with keyword bonus): ${finalSimilarity.toFixed(3)}`);
        
        return {
          chunk,
          similarity: finalSimilarity
        };
      }).sort((a, b) => b.similarity - a.similarity);

      console.log("Top 3 similarities:", similarities.slice(0, 3).map(s => s.similarity.toFixed(3)));

      // Use a lower threshold for similarity
      const topChunks = similarities.slice(0, 3).filter(item => item.similarity > 0.1);
      console.log("Chunks above threshold (0.1):", topChunks.length);

      if (topChunks.length === 0) {
        console.log("No relevant chunks found with similarity > 0.1");
        console.log("Best similarity was:", similarities[0]?.similarity || "No chunks");
        // Use the top 2 chunks regardless of similarity as fallback
        const fallbackChunks = similarities.slice(0, 2);
        console.log("Using fallback: top 2 chunks with similarities:", fallbackChunks.map(s => s.similarity.toFixed(3)));
        
        if (fallbackChunks.length > 0) {
          const combinedContent = fallbackChunks.map(item => item.chunk.content).join('\n\n');
          
          const userPrompt = `Based on the following information about Harsh, answer the user's question briefly:

${combinedContent}

Question: ${question}

Answer (keep it brief, 2-3 sentences max. If GitHub repositories are mentioned in the context above, include them in your response):`;

          console.log("Sending fallback request to OpenAI...");
          const completion = await openai.chat.completions.create({
            model: config.models.completion,
            messages: [
              { role: "system", content: config.systemPrompt },
              { role: "user", content: userPrompt }
            ],
            temperature: config.models.temperature,
          });

          const answer = completion.choices[0].message.content;
          console.log("Generated fallback answer:", answer);
          return res.json({ answer });
        }
        
        return res.json({ 
          answer: "I found some information in the database, but it doesn't seem directly relevant to your question. Could you try rephrasing your question or ask about Harsh's contact information or resume?" 
        });
      }

      const combinedContent = topChunks.map(item => item.chunk.content).join('\n\n');
      console.log("Combined content length:", combinedContent.length);
      console.log("Combined content preview:", combinedContent.substring(0, 200) + "...");

      const userPrompt = `Based on the following information about Harsh, answer the user's question briefly:

${combinedContent}

Question: ${question}

Answer (keep it brief, 2-3 sentences max. If GitHub repositories are mentioned in the context above, include them in your response):`;

      console.log("Sending request to OpenAI...");
      const completion = await openai.chat.completions.create({
        model: config.models.completion,
        messages: [
          { role: "system", content: config.systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: config.models.temperature,
      });

      const answer = completion.choices[0].message.content;
      console.log("Generated answer:", answer);
      return res.json({ answer });

    } catch (dbError) {
      console.error("Database/AI Error details:", dbError.message);
      console.error("Error stack:", dbError.stack);
      return res.json({ 
        answer: "I'm having technical difficulties accessing the database right now. For immediate assistance, you can contact Harsh directly or download his resume using the contact and resume options." 
      });
    }

  } catch (error) {
    console.error("API Error:", error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}