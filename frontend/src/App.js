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
      // Force use of /api/chat path in all environments
      const apiUrl = '/api/chat';
      
      console.log("Sending request to:", apiUrl);
      const response = await axios.post(apiUrl, { question: question });
      console.log("Response received:", response.data);
      setMessages([
        ...newMessages,
        { type: "bot", text: response.data.answer.trim() },
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

