// embeddings/split-and-generate.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
import OpenAI from 'openai';

// Load env vars
config();

// Setup __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Load files ===
const filePath = path.join(__dirname, 'knowledge_base.txt');
const text = fs.readFileSync(filePath, 'utf8');

// === Chunking logic ===
function splitIntoChunks(text, maxChunkSize = 800) {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks = [];

  let currentChunk = '';
  for (const para of paragraphs) {
    if ((currentChunk + para).length <= maxChunkSize) {
      currentChunk += para + '\n\n';
    } else {
      if (currentChunk.trim()) chunks.push(currentChunk.trim());
      currentChunk = para + '\n\n';
    }
  }
  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  return chunks;
}

const chunks = splitIntoChunks(text);
const chunkObjects = chunks.map((chunk, i) => ({
  id: `chunk-${i + 1}`,
  text: chunk
}));

// === Save to data.js for frontend or backup ===
const outputPath = path.join(__dirname, 'data.js');
fs.writeFileSync(outputPath, `module.exports = ${JSON.stringify(chunkObjects, null, 2)};`, 'utf8');
console.log(`✅ Successfully created ${chunkObjects.length} chunks and saved to data.js`);

// === Generate embeddings and insert into MongoDB ===
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const mongoClient = new MongoClient(process.env.MONGODB_URI);
await mongoClient.connect();
const db = mongoClient.db("chatbot");
const collection = db.collection("chunks");

await collection.deleteMany(); // optional: clean slate

for (const chunk of chunkObjects) {
  const embeddingResponse = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: chunk.text
  });

  await collection.insertOne({
    id: chunk.id,
    content: chunk.text,
    embedding: embeddingResponse.data[0].embedding
  });

  console.log(`✅ Stored embedding for ${chunk.id}`);
}

await mongoClient.close();
console.log("✅ All embeddings generated and stored in MongoDB");
