import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [apiStatus, setApiStatus] = useState(null);

  // Check API health on load
  useEffect(() => {
    const checkApiHealth = async () => {
      try {
        const healthUrl = process.env.NODE_ENV === 'development' 
          ? 'http://localhost:3002/api/health'
          : '/api/health';
        
        console.log("Checking API health at:", healthUrl);
        const response = await axios.get(healthUrl);
        console.log("API health response:", response.data);
        setApiStatus("connected");
      } catch (err) {
        console.error("API health check failed:", err);
        setApiStatus("error");
      }
    };

    checkApiHealth();
  }, []);

  const handleSend = async () => {
    if (!question.trim()) return;

    const newMessages = [...messages, { type: "user", text: question }];
    setMessages(newMessages);
    setQuestion("");

    try {
      // Use environment-aware API URL
      const apiUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3002/api/chat'
        : '/api/chat';
      
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

      let errorMessage = 'Could not get response';
      
      if (err.response?.status === 401) {
        errorMessage = 'Authentication error: Please check API configuration';
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }

      setMessages([
        ...newMessages,
        { type: "bot", text: `⚠️ Error: ${errorMessage}` },
      ]);
    }
  };

  return (
    <div className="App">
      <h1>💬 Harsh's Portfolio Chatbot</h1>
      {apiStatus === "error" && (
        <div className="api-status error">
          ⚠️ API Connection Error - Please check the server
        </div>
      )}
      <div className="chat-box">
        {messages.length === 0 && (
          <div className="welcome-message">
            👋 Hi there! I'm Harsh's portfolio chatbot. Ask me anything about Harsh's projects, skills, or experience!
          </div>
        )}
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

