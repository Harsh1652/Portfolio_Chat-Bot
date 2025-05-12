# Portfolio Chatbot

An intelligent AI-powered chatbot that provides information about Harsh's portfolio, experience, projects, and skills. The chatbot uses advanced NLP techniques and vector embeddings to deliver accurate and contextual responses.

## 🌟 Features

- **Intelligent Response Generation**: Uses OpenAI's GPT-3.5-turbo for natural language understanding and response generation
- **Semantic Search**: Implements Cohere's embedding model for accurate semantic matching
- **Context-Aware**: Maintains conversation context and provides relevant information
- **Real-time Processing**: Fast response times with efficient vector similarity calculations
- **MongoDB Integration**: Stores and retrieves embeddings for efficient querying
- **Modern UI**: Clean and responsive user interface built with React

## 🛠️ Tech Stack

- **Frontend**: React.js
- **Backend**: Node.js, Express.js
- **Database**: MongoDB
- **AI/ML**: 
  - OpenAI GPT-3.5-turbo
  - Cohere Embedding Model
- **APIs**: RESTful API architecture
- **Deployment**: Vercel

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB database
- OpenAI API key
- Cohere API key

## 🔧 Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
MONGODB_URI=your_mongodb_connection_string
OPENAI_API_KEY=your_openai_api_key
COHERE_API_KEY=your_cohere_api_key
PORT=3002
```

## 🚀 Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/portfolio-chatbot.git
   cd portfolio-chatbot
   ```

2. **Install dependencies**
   ```bash
   # Install backend dependencies
   cd backend
   npm install

   # Install frontend dependencies
   cd ../frontend
   npm install
   ```

3. **Set up the database**
   - Ensure MongoDB is running
   - Run the embedding generation script:
   ```bash
   cd backend
   node embeddings/split-and-generate.js
   ```

4. **Start the development servers**
   ```bash
   # Start backend server (from backend directory)
   npm start

   # Start frontend server (from frontend directory)
   npm start
   ```

## 📁 Project Structure

```
portfolio-chatbot/
├── backend/
│   ├── embeddings/
│   │   ├── data.js
│   │   ├── embed.js
│   │   ├── knowledge_base.txt
│   │   └── split-and-generate.js
│   ├── models/
│   │   └── chunk.js
│   ├── routes/
│   │   └── chat.js
│   └── server.js
├── frontend/
│   ├── src/
│   │   ├── App.js
│   │   └── App.css
│   └── package.json
├── api/
│   ├── chat.js
│   └── health.js
└── vercel.json
```

## 🔄 API Endpoints

- `POST /api/chat`: Main endpoint for chat interactions
- `GET /health`: Health check endpoint

## 🤖 How It Works

1. User sends a question through the frontend interface
2. Backend processes the question using Cohere's embedding model
3. System finds relevant content chunks using vector similarity
4. OpenAI generates a contextual response based on the matched content
5. Response is sent back to the user

## 🚀 Deployment

The application is configured for deployment on Vercel. The `vercel.json` file contains the necessary configuration for serverless deployment.

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Contact

For any queries or suggestions, please reach out to harsh160502@gmail.com 