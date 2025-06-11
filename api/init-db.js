import { CohereClient } from "cohere-ai";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

// Use the existing data from your backend/embeddings/data.js
const portfolioData = [
  {
    "id": "chunk-1",
    "text": "#About Me\r\nHi there! 👋 I'm Harsh Gupta, a Software Engineer with a strong passion for building intelligent and scalable applications. I recently completed my MCA from UPES (2025) and have been exploring the world of AI-powered solutions, backend systems, and automation workflows ever since.\r\nI love working at the intersection of AI, backend engineering, and workflow automation. Some of my recent projects include:\r\nDeveloping AI automation agents with n8n and LLM integrations\r\nBuilding an AI-powered chatbot (the very one you're talking to!) using OpenAI GPT and vector search\r\nCreating full-stack applications and real-time systems using Node.js, MongoDB, Spring Boot, and more\r\nThis chatbot is designed to help you explore my portfolio, projects, and skills — feel free to ask me anything! Whether you're curious about my latest work or my technical background, I'm here to chat. 🚀"
  },
  {
    "id": "chunk-2",
    "text": "#Experience\r\n    Excollo\r\n        Software Engineer\r\n        June 2025 – Present                                                                                                                                                           \r\n            Projects: AI Agent Automation with n8n\r\n                Building AI automation agents using n8n for document parsing, data extraction, and workflow automation.\r\n                Collaborating on prompt engineering, LLM integration, and vector search using OpenAI + Pinecone."
  },
  {
    "id": "chunk-3",
    "text": "Excollo\r\n        Backend Developer Intern\r\n        Feb 2025 - May 2025\r\n            CRUDO - \r\n                Contributed to a full-stack order management system (Crudo), integrated with SWIL ERP\r\n                Developed and maintained modules: Order, Customer, Notification, and Store\r\n                Worked with Node.js, Express, MongoDB, JWT, REST APIs, Cron jobs\r\n                Implementing vector database for customer clustering and purchase pattern analysis\r\n\n    Freelance \r\n        Balaji Exports \r\n            Build a business website for Balaji Exports using React MUI, Next.Js , Type.\r\n\n#Projects"
  },
  {
    "id": "chunk-4",
    "text": "ShopEase                                                                                                                                                                                  Jan 2025       \r\n        Developed a full-stack e-commerce platform showcasing secure authentication, role-based access control \r\n        and responsive UI. \r\n        Strengthened security features using Spring Security, with encrypted passwords and user/admin roles for  \r\n        demonstration purposes. \r\n        Built and tested RESTful APIs for product, cart, and order management, ensuring scalability and maintainability. \r\n        Designed core cart and checkout features with complete order placement and history tracking functionality. \r\n        Technologies used: Spring Boot, Spring Security, REST APIs, MySQL, Thymeleaf, HTML, CSS, JavaScript, Git\r\n        Github - https://github.com/Harsh1652/ShopEase"
  },
  {
    "id": "chunk-5",
    "text": "Chattify                                                                                                                                                                                       Dec 2024 \r\n        Developed a real-time chat application with React.js, Node.js, and MongoDB to demonstrate messaging  \r\n        system architecture. \r\n        Implemented real-time communication using Socket.io, showcasing event-driven architecture for instant  \r\n        messaging. \r\n        Designed a fully responsive user interface for seamless use across devices, improving UX design skills. \r\n        Integrated Cloudinary for efficient profile image management and delivery in a scalable environment. \r\n        Technologies used: React.js, Node.js, Express, MongoDB, Socket.io, RESTful APIs, Cloudinary, Git, GitHub. \r\n        Github - https://github.com/Harsh1652/Chattify"
  },
  {
    "id": "chunk-6",
    "text": "SecureNet(Real-Time Intrusion Detection and Vulnerability Scanner)                                                                        Oct 2024  \r\n        Developed a real-time intrusion detection and vulnerability scanning system, integrating tools such as  \r\n        Snort and Nikto. \r\n        Built a security dashboard in Spring Boot for real-time monitoring and event tracking, simulating network  \r\n        security protocols. \r\n        Created RESTful APIs to facilitate security scans and data retrieval from detection tools. \r\n        Implemented log parsing mechanisms to extract actionable security insights for system demonstration purposes. \r\n        Technologies used: Spring Boot, Java, RESTful APIs, HTML, CSS, JavaScript, log monitoring, JSON/XML,  \r\n        and MySQL.\r\n        Github - https://github.com/Harsh1652/SecureNet"
  },
  {
    "id": "chunk-7",
    "text": "Portfolio-Chatbot\r\n        Built a full-stack chatbot using React.js, Node.js/Express, and MongoDB, deployed via Vercel (serverless).\r\n        Integrated OpenAI GPT-3.5 Turbo and Cohere Embedding Model for contextual Q&A using semantic search and vector similarity.\r\n        Designed a responsive UI with real-time chat and intent-based response handling.\r\n        Secured API endpoints and optimized performance for fast, accurate retrieval from vector data.\r\n        Technologies used: React.js, Node.js, MongoDB, OpenAI, Cohere, Vercel, REST APIs, Vector Search.\r\n        Github - https://github.com/Harsh1652/Portfolio_Chat-Bot\r\n\n#Services\r\n    Full-Stack WebApplication Development\r\n    Mobile Application Development\r\n    AI ChatBot Development"
  },
  {
    "id": "chunk-8",
    "text": "#Education\r\n  MCA | UPES | 2023 - 2025\r\n  BCA | St.Xavier's college | 2020 - 2023\r\n\n#skills\r\n    Languages: Java, Kotlin, JavaScript  \r\n    Backend: Node.js, Express, Spring Boot, Jakarta EE, Hibernate  \r\n    Frontend: HTML, CSS, JavaScript, Thymeleaf, MUI  \r\n    Databases: MongoDB, MySQL, Pinecone (Vector DB)  \r\n    AI Tools: OpenAI GPT, Cohere, n8n, Prompt Engineering  \r\n    Tools & Platforms: VS Code, Cursor, Postman, Git, GitHub, Maven, REST APIs, JWT, Socket.io\r\n    Object-Oriented Programming\r\n\n#Contact\r\n    Email - harsh160502@gmail.com\r\n    PhoneNo - +91 9982346893\r\n    Website -  https://tinyurl.com/2ebnnt79\r\n    Linkedin - https://www.linkedin.com/in/harsh-gupta16/\r\n    GitHub - https://github.com/Harsh1652"
  },
  {
    "id": "chunk-9",
    "text": "#Resume \r\n    Link - https://drive.google.com/file/d/1q3fo8tdYrtK6cIDZaKHKuDCsf4jSUtJP/view?usp=sharing"
  }
];

const chunkSchema = new mongoose.Schema({
  content: { type: String, required: true },
  embedding: { type: [Number], required: true }
});

let Chunk = null;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log("Connecting to database...");
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      dbName: "chatbot"
    });

    if (!Chunk) {
      Chunk = mongoose.models.Chunk || mongoose.model('Chunk', chunkSchema);
    }

    console.log("Checking existing chunks...");
    const existingCount = await Chunk.countDocuments();
    console.log("Existing chunks:", existingCount);

    if (existingCount > 0) {
      return res.json({ 
        message: `Database already initialized with ${existingCount} chunks`,
        status: "already_initialized" 
      });
    }

    console.log("Initializing database with portfolio data...");
    
    for (let i = 0; i < portfolioData.length; i++) {
      const item = portfolioData[i];
      console.log(`Processing chunk ${i + 1}/${portfolioData.length}: ${item.id}`);
      
      // Generate embedding
      const embedding = await cohere.embed({
        texts: [item.text],
        model: 'embed-english-v3.0',
        input_type: 'search_document'
      });

      // Save to database
      await Chunk.create({
        content: item.text,
        embedding: embedding.embeddings[0]
      });
    }

    const finalCount = await Chunk.countDocuments();
    console.log("Database initialization complete. Total chunks:", finalCount);

    return res.json({ 
      message: `Database initialized successfully with ${finalCount} chunks`,
      status: "initialized",
      chunks: finalCount
    });

  } catch (error) {
    console.error("Initialization error:", error);
    return res.status(500).json({ 
      error: 'Database initialization failed',
      message: error.message 
    });
  }
} 