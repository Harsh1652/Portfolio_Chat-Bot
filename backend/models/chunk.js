// backend/models/chunk.js
import mongoose from "mongoose";

const chunkSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true,
  },
  embedding: {
    type: [Number], // array of numbers (vector)
    required: true,
  },
});

const Chunk = mongoose.model("Chunk", chunkSchema);

export default Chunk;
