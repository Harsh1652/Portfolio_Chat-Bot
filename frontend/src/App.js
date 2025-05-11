import React, { useState } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);

  const handleSend = async () => {
    if (!question.trim()) return;

    const newMessages = [...messages, { type: "user", text: question }];
    setMessages(newMessages);
    setQuestion("");

    try {
      const apiUrl = process.env.NODE_ENV === 'production' 
        ? '/api/chat'  // Vercel deployment
        : '/api/chat'; // Local development with proxy
      
      console.log("Sending request to:", apiUrl);
      const res = await axios.post(apiUrl, { question });
      console.log("Response received:", res.data);
      setMessages([
        ...newMessages,
        { type: "bot", text: res.data.answer.trim() },
      ]);
    } catch (err) {
      console.error("Error details:", {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message
      });
      setMessages([
        ...newMessages,
        { type: "bot", text: `⚠️ Error: ${err.message || 'Could not get response'}` },
      ]);
    }
  };

  return (
    <div className="App">
      <h1>💬 Harsh's Portfolio Chatbot</h1>
      <div className="chat-box">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.type}`}>
            {msg.text}
          </div>
        ))}
      </div>
      <div className="input-area">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask something..."
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}

export default App;
