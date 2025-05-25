// chat.js
import { CohereClient } from "cohere-ai";
import { OpenAI } from "openai";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// Configuration object - Enhanced with new features from server.js
const config = {
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
      keywords: ["projects", "project", "portfolio", "work", "created", "built", "developed", "chatbot", "chat bot"],
      identifiers: ["#projects", "projects:", "portfolio:"],
      knownProjects: [
        "shopease", "shop ease", 
        "chattify", 
        "securenet", "secure net", 
        "portfolio chatbot", "portfolio-chatbot", "portfoliochatbot",
        "chatbot", "chat bot"
      ],
      allProjects: ["shopease", "chattify", "securenet", "portfolio chatbot"]
    },
    skills: {
      keywords: ["skills", "skill", "technologies", "technology", "tech", "programming", "languages", "frameworks", "tools", "tech stack", "technical skills", "expertise", "proficient", "know", "experienced"],
      identifiers: ["#skills", "skills:", "technical skills:", "technologies:", "tech stack:", "programming languages:"],
      skillCategories: {
        languages: ["java", "javascript", "html", "css", "sql"],
        frameworks: ["spring boot", "spring", "react", "react.js", "node.js", "express", "express.js", "bootstrap", "tailwind"],
        databases: ["mysql", "mongodb", "postgresql"],
        tools: ["git", "github", "postman", "vs code", "intellij", "eclipse"],
        others: ["rest api", "maven", "npm", "api", "json"]
      }
    },
    experience: {
      keywords: ["experience", "work", "history", "job", "career", "intern", "internship", "employment", "worked", "working", "freelance", "freelancer"],
      identifiers: ["#experience", "experience:", "work history:", "work experience:", "employment:"],
      knownCompanies: ["excollo", "balaji exports", "freelance", "freelancer"]
    },
    education: {
      keywords: ["education", "study", "degree", "university", "college", "school", "course", "major", "academic"],
      identifiers: ["#education", "education:", "academic background:"],
      knownInstitutions: ["university", "college", "institute", "upes", "st.xavier", "xavier"]
    },
    services: {
      keywords: ["services", "offer", "offers", "providing", "provide", "do", "can do", "capabilities"],
      identifiers: ["#services", "services:", "offerings:"]
    },
    contact: {
      keywords: ["contact", "email", "phone", "number", "call", "reach", "linkedin", "github", "website", "portfolio", "social", "connect", "touch", "get in touch"],
      identifiers: ["#contact", "contact:", "contact info:", "contact information:", "get in touch:", "reach me:"]
    },
    resume: {
      keywords: ["resume", "cv", "curriculum vitae", "download", "pdf", "document", "hire", "hiring", "recruit", "recruitment"],
      identifiers: ["#resume", "resume:", "cv:", "download resume:", "resume link:"]
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
    greeting: "Hello! I'm an AI assistant that can tell you about Harsh's experience, projects, skills, contact information, and more. What would you like to know?",
    notFound: "I don't have enough information to answer that question. Could you ask something about Harsh's experience, projects, skills, contact information, or education instead?",
    notRelated: "I'm an assistant focused on providing information about Harsh. I can tell you about his experience, projects, skills, contact information, and education. What would you like to know about Harsh?",
    projectsList: "Harsh has worked on several key projects: ShopEase (e-commerce platform), Chattify (real-time chat application), SecureNet (security monitoring system), and Portfolio Chatbot (AI assistant for his portfolio). Which project would you like to know more about?",
    contact: "You can reach Harsh at: Email: harsh160502@gmail.com, Phone: +91 9982346893, LinkedIn: https://www.linkedin.com/in/harsh-gupta16/, GitHub: https://github.com/Harsh1652, Website: https://tinyurl.com/2ebnnt79",
    resume: "You can download Harsh's resume from: https://drive.google.com/file/d/1nYnWrLxtnjBWCE_P-LsfHyxctKSgYHNM/view?usp=sharing"
  },
  
  // Control variables
  maxChunks: 5,
  minScore: 0.5,
  
  // System prompt template - includes important instruction about projects
  systemPrompt: "You are a concise assistant for Harsh's portfolio. Format responses clearly but use at most 3-4 sentences total. Be direct and brief while maintaining accuracy. Avoid unnecessary detail or repetition. When asked about projects, always include all of Harsh's main projects: ShopEase, Chattify, SecureNet, and Portfolio Chatbot - omitting any of these projects is a serious error. For contact queries, provide specific contact details. For resume queries, provide the download link.",
  
  // User prompt template - Enhanced with specific instructions
  userPromptTemplate: `You are an AI assistant that provides BRIEF information about Harsh's portfolio.

IMPORTANT:
1. Keep ALL responses UNDER 4 SENTENCES TOTAL - this is critical
2. For lists, use at most 2-3 bullet points
3. For projects, just give a 1-2 sentence summary
4. For experience, just list the company name and core responsibility
5. For skills, group them into categories (languages, frameworks, tools)
6. For contact info, provide the specific contact details requested
7. For resume, provide the direct download link
8. Never repeat information
9. Focus on the specific question asked
10. When listing projects, ALWAYS include ALL projects mentioned in the context: ShopEase, SecureNet, Chattify, and Portfolio Chatbot

Context:
{context}

User Question: {question}
Answer (REMEMBER TO BE EXTREMELY BRIEF - 2-4 SENTENCES MAX):`
};

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

// Cached data for frequent lookups - Enhanced with contact and resume terms
const portfolioTerms = new Set([
  'portfolio', 'website', 'github', 'link', 'project', 'resume', 
  'skill', 'skills', 'tech', 'stack', 'experience', 'job', 'work', 'contact',
  'education', 'degree', 'university', 'college', 'his', 'him', 'technologies',
  'programming', 'languages', 'frameworks', 'tools', 'email', 'phone', 
  'linkedin', 'cv', 'hire', 'recruitment'
]);

// Cached regex patterns for direct projects queries
const directProjectQueries = new Set([
  "his projects", "projects", "what are his projects", 
  "what projects has he worked on", "tell me about his projects",
  "what projects has harsh worked on"
]);

// Cached regex patterns for skills queries
const directSkillsQueries = new Set([
  "his skills", "skills", "what are his skills", 
  "what skills does he have", "tell me about his skills",
  "what skills does harsh have", "his tech stack", "what technologies does he know"
]);

// Add these new cached sets for direct queries
const directContactQueries = new Set([
  "contact", "contact info", "contact information", "how to contact", 
  "email", "phone", "linkedin", "github", "reach him", "get in touch"
]);

const directResumeQueries = new Set([
  "resume", "cv", "download resume", "resume link", "curriculum vitae"
]);

/**
 * Improved greeting detection with configuration-based approach
 * @param {string} text - User input to check
 * @returns {boolean} True if the text is recognized as a greeting
 */
function isGreeting(text) {
  const normalized = text.toLowerCase().trim();
  
  // Check exact matches first (faster)
  if (config.greetings.exactMatches.includes(normalized)) {
    return true;
  }
  
  // Only check regex patterns if needed
  return config.greetings.patterns.some(regex => regex.test(normalized));
}

/**
 * Detects intent from user question - Enhanced with contact and resume
 * @param {string} question - The user's question
 * @returns {Object} Map of category to relevance score
 */
function detectIntent(question) {
  const normalized = question.toLowerCase().trim();
  const intent = {};
  
  // Check for general projects query first
  const projectsKeywords = new Set(['projects', 'project']);
  const hasProjectKeyword = [...projectsKeywords].some(keyword => normalized.includes(keyword));
  const hasSpecificProject = config.categories.projects.knownProjects.some(project => 
    normalized.includes(project.toLowerCase().replace(/-/g, ' ').replace(/-/g, ''))
  );
  
  if (hasProjectKeyword && !hasSpecificProject) {
    intent.projects = 2; // Higher weight for general projects
  }
  
  // Check for general skills query
  const skillsKeywords = new Set(['skills', 'skill', 'technologies', 'tech stack', 'programming languages', 'tools', 'frameworks']);
  const hasSkillsKeyword = [...skillsKeywords].some(keyword => normalized.includes(keyword));
  const hasSpecificSkill = Object.values(config.categories.skills.skillCategories)
    .flat()
    .some(skill => normalized.includes(skill.toLowerCase()));
  
  if (hasSkillsKeyword && !hasSpecificSkill) {
    intent.skills = 2; // Higher weight for general skills query
  }
  
  // Check for contact queries
  const contactKeywords = new Set(['contact', 'email', 'phone', 'linkedin', 'github', 'reach', 'touch']);
  const hasContactKeyword = [...contactKeywords].some(keyword => normalized.includes(keyword));
  
  if (hasContactKeyword) {
    intent.contact = 2; // High priority for contact queries
  }
  
  // Check for resume queries
  const resumeKeywords = new Set(['resume', 'cv', 'download', 'hire', 'recruitment']);
  const hasResumeKeyword = [...resumeKeywords].some(keyword => normalized.includes(keyword));
  
  if (hasResumeKeyword) {
    intent.resume = 2; // High priority for resume queries
  }
  
  // Efficient category checking
  for (const [category, data] of Object.entries(config.categories)) {
    // Skip if we already detected a general query for this category
    if ((category === 'projects' && intent.projects === 2) || 
        (category === 'skills' && intent.skills === 2) ||
        (category === 'contact' && intent.contact === 2) ||
        (category === 'resume' && intent.resume === 2)) continue;
    
    // Optimize keyword matching
    let keywordMatches = 0;
    for (const keyword of data.keywords) {
      if (keyword === 'chatbot' || keyword === 'chat bot') {
        if (normalized.includes('chatbot') || normalized.includes('chat bot')) {
          keywordMatches++;
          break; // Only count once
        }
      } else if (normalized.includes(keyword)) {
        keywordMatches++;
      }
    }
    
    if (keywordMatches > 0) {
      intent[category] = keywordMatches;
    }
  }
  
  // Special handling for possessive forms
  if (normalized.includes('his') || normalized.includes('harsh')) {
    if (normalized.includes('experience') || normalized.includes('work')) {
      intent.experience = intent.experience || 1;
    }
    if (normalized.includes('project') || normalized.includes('projects')) {
      intent.projects = intent.projects || 1;
    }
    if (normalized.includes('skill') || normalized.includes('skills') || normalized.includes('technologies')) {
      intent.skills = intent.skills || 1;
    }
    if (normalized.includes('contact') || normalized.includes('email') || normalized.includes('phone')) {
      intent.contact = intent.contact || 1;
    }
    if (normalized.includes('resume') || normalized.includes('cv')) {
      intent.resume = intent.resume || 1;
    }
  }
  
  // Unified chatbot detection
  if (normalized.includes('chatbot') || normalized.includes('chat bot')) {
    intent.projects = intent.projects || 1;
  }
  
  // Enhanced skills detection for specific technologies
  if (hasSpecificSkill) {
    intent.skills = intent.skills || 1;
  }
  
  return intent;
}

/**
 * Determines if the question is about Harsh or his portfolio - Enhanced with contact and resume
 * @param {string} question - The user's question
 * @returns {boolean} True if related to Harsh, false otherwise
 */
function isHarshRelated(question) {
  const normalized = question.toLowerCase().trim();
  
  // Fast check for explicit mentions
  if (normalized.includes('harsh')) {
    return true;
  }
  
  // Check for intent detection (more expensive, so do this second)
  const intent = detectIntent(question);
  if (Object.values(intent).some(Boolean)) {
    return true;
  }
  
  // Check for known terms (efficient lookup)
  const allKnownTerms = [
    ...config.categories.projects.knownProjects,
    ...config.categories.experience.knownCompanies,
    ...config.categories.education.knownInstitutions,
    ...Object.values(config.categories.skills.skillCategories).flat()
  ];
  
  if (allKnownTerms.some(term => normalized.includes(term.toLowerCase()))) {
    return true;
  }
  
  // Check common portfolio-related terms (using Set for O(1) lookups)
  for (const term of portfolioTerms) {
    if (normalized.includes(term)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get relevant chunks based on intent and semantic similarity - Enhanced with contact and resume
 * @param {Array} chunks - All available chunks
 * @param {Object} intent - Intent mapping from detectIntent
 * @param {Array} userEmbedding - User question embedding
 * @param {string} originalQuestion - The original question for context
 * @returns {Array} Relevant chunks with their scores
 */
function getRelevantChunks(chunks, intent, userEmbedding, originalQuestion = "") {
  const normalizedQuestion = originalQuestion.toLowerCase();
  const selectedChunkIds = new Set();
  let selectedChunks = [];
  
  // Pre-compute similarity scores once
  const rankedChunks = chunks
    .map(chunk => ({ 
      chunk, 
      score: cosineSimilarity(userEmbedding, chunk.embedding) 
    }))
    .sort((a, b) => b.score - a.score);
  
  // Helper function to safely add chunks without duplicates
  const addChunk = (chunk, score, reason = "") => {
    const chunkId = chunk._id.toString();
    if (!selectedChunkIds.has(chunkId) && selectedChunks.length < config.maxChunks) {
      selectedChunks.push({ chunk, score });
      selectedChunkIds.add(chunkId);
      console.log(`Added chunk (${reason}): ${chunk.content.substring(0, 50)}... [Score: ${score.toFixed(3)}]`);
      return true;
    }
    return false;
  };
  
  // Handle contact queries - Added from server.js
  if (intent.contact) {
    console.log("\nProcessing contact intent");
    
    const contactChunks = chunks.filter(chunk => {
      const content = chunk.content.toLowerCase();
      return content.includes('#contact') || 
             content.includes('contact:') ||
             content.includes('email') ||
             content.includes('phone') ||
             content.includes('linkedin') ||
             content.includes('github') ||
             content.includes('website');
    });
    
    contactChunks.forEach(chunk => addChunk(chunk, 1.0, "contact info"));
  }
  
  // Handle resume queries - Added from server.js
  if (intent.resume) {
    console.log("\nProcessing resume intent");
    
    const resumeChunks = chunks.filter(chunk => {
      const content = chunk.content.toLowerCase();
      return content.includes('#resume') || 
             content.includes('resume:') ||
             content.includes('cv:') ||
             content.includes('drive.google.com') ||
             content.includes('resume link') ||
             content.includes('download');
    });
    
    resumeChunks.forEach(chunk => addChunk(chunk, 1.0, "resume info"));
  }
  
  // Handle chatbot queries efficiently
  if (normalizedQuestion.includes('chatbot') || normalizedQuestion.includes('chat bot')) {
    const portfolioChatbotChunks = chunks.filter(chunk => {
      const content = chunk.content.toLowerCase();
      return content.includes('portfolio chatbot') || 
             content.includes('portfolio-chatbot') || 
             content.includes('chatbot') ||
             content.includes('chat bot');
    });
    
    portfolioChatbotChunks.forEach(chunk => addChunk(chunk, 1.0, "chatbot specific match"));
    
    // Early return if we found chatbot chunks and user is asking about projects
    if (portfolioChatbotChunks.length > 0 && intent.projects) {
      return selectedChunks;
    }
  }
  
  // Process skills intent
  if (intent.skills) {
    console.log("\nProcessing skills intent");
    
    // Check for general skills query
    const isGeneralSkillsQuery = 
      (normalizedQuestion.includes('skills') || normalizedQuestion.includes('technologies')) && 
      !Object.values(config.categories.skills.skillCategories)
        .flat()
        .some(skill => normalizedQuestion.includes(skill.toLowerCase()));
      
    if (isGeneralSkillsQuery) {
      // Get skills overview chunks first
      const skillsOverviewChunks = chunks.filter(chunk => {
        const content = chunk.content.toLowerCase();
        return (content.includes('#skills') || 
                content.includes('skills:') || 
                content.includes('technical skills:') ||
                content.includes('tech stack:')) && 
               (content.includes('overview') || 
                content.includes('programming languages') ||
                content.includes('frameworks') ||
                content.includes('tools'));
      });
      
      skillsOverviewChunks.forEach(chunk => addChunk(chunk, 1.0, "skills overview"));
      
      // Get specific skill category chunks
      chunks.forEach(chunk => {
        const content = chunk.content.toLowerCase();
        
        // Check for skill categories
        if (content.includes('programming languages') || 
            content.includes('frameworks') || 
            content.includes('databases') || 
            content.includes('tools') ||
            content.includes('technologies')) {
          addChunk(chunk, 0.98, "skill category");
        }
        
        // Check for specific skills mentioned
        for (const [category, skills] of Object.entries(config.categories.skills.skillCategories)) {
          for (const skill of skills) {
            if (content.includes(skill.toLowerCase())) {
              addChunk(chunk, 0.95, `specific skill: ${skill}`);
              break; // Only add once per chunk
            }
          }
        }
      });
    } else {
      // Handle specific skill queries
      const skillChunks = chunks.filter(chunk => {
        const content = chunk.content.toLowerCase();
        return content.includes('#skills') || 
               content.includes('skills:') ||
               content.includes('technical skills:') ||
               content.includes('tech stack:') ||
               Object.values(config.categories.skills.skillCategories)
                 .flat()
                 .some(skill => content.includes(skill.toLowerCase()));
      });
      
      skillChunks.forEach(chunk => addChunk(chunk, 0.95, "specific skills"));
    }
  }
  
  // Process projects intent
  if (intent.projects) {
    console.log("\nProcessing projects intent");
    
    // Check for general projects query
    const isGeneralProjectsQuery = 
      normalizedQuestion.includes('projects') && 
      !config.categories.projects.knownProjects.some(project => 
        normalizedQuestion.includes(project.toLowerCase())
      );
      
    if (isGeneralProjectsQuery) {
      // Get overview chunks first
      const projectsOverviewChunks = chunks.filter(chunk => {
        const content = chunk.content.toLowerCase();
        return (content.includes('#projects') || content.includes('projects:')) && 
               content.includes('overview');
      });
      
      projectsOverviewChunks.forEach(chunk => addChunk(chunk, 1.0, "projects overview"));
      
      // Map for faster lookups of project names
      const projectNameMap = new Map();
      config.categories.projects.knownProjects.forEach(project => {
        projectNameMap.set(project.toLowerCase(), true);
      });
      
      // Get specific project chunks efficiently
      chunks.forEach(chunk => {
        const content = chunk.content.toLowerCase();
        for (const projectName of config.categories.projects.knownProjects) {
          if (content.includes(projectName.toLowerCase())) {
            addChunk(chunk, 0.98, `project: ${projectName}`);
            break; // Only add once per chunk
          }
        }
      });
    } else {
      // Handle specific project queries
      const projectChunks = chunks.filter(chunk => {
        const content = chunk.content.toLowerCase();
        return content.includes('#projects') || 
               content.includes('projects:') ||
               content.includes('portfolio:') ||
               config.categories.projects.knownProjects.some(project => 
                 content.includes(project.toLowerCase())
               );
      });
      
      projectChunks.forEach(chunk => addChunk(chunk, 0.95, "specific project"));
    }
  }
  
  // Process other intent categories - Enhanced with education institutions
  for (const [category, relevance] of Object.entries(intent)) {
    if (!relevance || ['projects', 'skills', 'contact', 'resume'].includes(category)) continue;
    
    const categoryData = config.categories[category];
    
    // Find chunks based on category identifiers
    chunks.forEach(chunk => {
      const content = chunk.content.toLowerCase();
      for (const id of categoryData.identifiers) {
        if (content.includes(id)) {
          addChunk(chunk, 1.0, `${category} identifier`);
          break;
        }
      }
    });
    
    // Enhanced entity matching
    if (category === 'experience' && categoryData.knownCompanies) {
      chunks.forEach(chunk => {
        const content = chunk.content.toLowerCase();
        for (const company of categoryData.knownCompanies) {
          if (content.includes(company.toLowerCase())) {
            addChunk(chunk, 0.9, `company: ${company}`);
            break;
          }
        }
      });
    }
    
    if (category === 'education' && categoryData.knownInstitutions) {
      chunks.forEach(chunk => {
        const content = chunk.content.toLowerCase();
        for (const institution of categoryData.knownInstitutions) {
          if (content.includes(institution.toLowerCase())) {
            addChunk(chunk, 0.9, `institution: ${institution}`);
            break;
          }
        }
      });
    }
  }
  
  // Add top semantic matches to reach maxChunks
  console.log("\nAdding semantic matches...");
  for (const rankedChunk of rankedChunks) {
    if (selectedChunks.length >= config.maxChunks || rankedChunk.score < config.minScore) break;
    addChunk(rankedChunk.chunk, rankedChunk.score, "semantic similarity");
  }
  
  console.log(`\nFinal selection: ${selectedChunks.length} chunks`);
  return selectedChunks;
}

export default async (req, res) => {
  // Add detailed logging
  console.log("API endpoint hit", {
    method: req.method,
    path: req.path,
    body: JSON.stringify(req.body).slice(0, 100)
  });
  
  // Handle CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', 'https://harsh-portfolio-harsh1652s-projects.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { question } = req.body;
    
    console.log(`\n=== Processing question: "${question}" ===`);

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
    
    // Special case: Direct queries handling
    const normalizedQuestion = question.toLowerCase().trim();
    
    // Direct projects list question
    if (directProjectQueries.has(normalizedQuestion) &&
        !normalizedQuestion.includes("chatbot") &&
        !normalizedQuestion.includes("securenet") &&
        !normalizedQuestion.includes("shopease") &&
        !normalizedQuestion.includes("chattify")) {
      return res.json({ answer: config.responses.projectsList });
    }

    // Direct contact queries
    if (directContactQueries.has(normalizedQuestion) ||
        normalizedQuestion.includes("how to contact harsh") ||
        normalizedQuestion.includes("harsh contact") ||
        normalizedQuestion.includes("contact harsh")) {
      return res.json({ answer: config.responses.contact });
    }

    // Direct resume queries
    if (directResumeQueries.has(normalizedQuestion) ||
        normalizedQuestion.includes("harsh resume") ||
        normalizedQuestion.includes("download harsh resume")) {
      return res.json({ answer: config.responses.resume });
    }

    // Special case: Direct skills list question
    if (directSkillsQueries.has(normalizedQuestion) &&
        !Object.values(config.categories.skills.skillCategories)
          .flat()
          .some(skill => normalizedQuestion.includes(skill.toLowerCase()))) {
      // Let the regular flow handle it to get from embeddings
      console.log("General skills query detected, will use embeddings");
    }
    
    // Add more detailed DB connection logging
    console.log("Connecting to MongoDB...");
    await connectToDatabase();
    console.log("MongoDB connected successfully");

    // Initialize Cohere client for embeddings
    const cohere = new CohereClient({
      token: process.env.COHERE_API_KEY,
    });
    
    // Generate embeddings for the question
    const cohereRes = await cohere.embed({
      texts: [question],
      model: config.models.embedding,
      inputType: "search_query",
    });

    const userEmbedding = cohereRes.embeddings[0];

    // Define Chunk model for this function
    const Chunk = mongoose.models.Chunk || mongoose.model('Chunk', chunkSchema);

    // Fetch all chunks from database
    const chunks = await Chunk.find().lean(); // Using lean() for better performance
    console.log(`Found ${chunks.length} chunks in database`);
    
    // Debug: Log all chunk content snippets
    console.log("\nAll chunks in database:");
    chunks.forEach((chunk, i) => {
      console.log(`${i+1}. ${chunk.content.substring(0, 60)}...`);
    });
    
    if (chunks.length === 0) {
      return res.json({ answer: config.responses.notFound });
    }

    // Detect intent and get relevant chunks
    const intent = detectIntent(question);
    console.log("Detected intent:", intent);
    
    const selectedChunks = getRelevantChunks(chunks, intent, userEmbedding, question);
    
    // Log selected chunks with scores
    console.log("\n=== Final selected chunks ===");
    selectedChunks.forEach((item, i) => {
      console.log(`${i+1}. (score: ${item.score.toFixed(3)}): ${item.chunk.content.substring(0, 80)}...`);
    });

    // Handle empty results
    if (!selectedChunks.length) {
      console.log("No relevant chunks found, returning notFound message");
      return res.json({ 
        answer: config.responses.notFound
      });
    }

    const combinedContent = selectedChunks.map(item => item.chunk.content).join("\n\n");

    // Initialize OpenAI
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Use template for user prompt
    const userPrompt = config.userPromptTemplate
      .replace("{context}", combinedContent)
      .replace("{question}", question);

    // Generate response using OpenAI
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

    const answer = completion.choices[0].message.content;
    console.log(`\nGenerated answer: ${answer}`);
    console.log("=====================================\n");

    res.json({ answer });
  } catch (error) {
    console.error("API Error:", {
      message: error.message,
      stack: error.stack,
      mongoURI: process.env.MONGODB_URI ? "URI exists" : "No URI found"
    });
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
};