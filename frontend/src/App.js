import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState(null);

  // Check API health on load
  useEffect(() => {
    const checkApiHealth = async () => {
      try {
        const response = await axios.get('/api/health');
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
    setIsLoading(true);

    try {
      console.log("Sending request to API");
      const response = await axios.post('/api/chat', { question });
      console.log("Response received:", response.data);
      
      setMessages([
        ...newMessages,
        { type: "bot", text: response.data.answer }
      ]);
    } catch (err) {
      console.error("Error details:", err);

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
    } finally {
      setIsLoading(false);
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
        
        {isLoading && (
          <div className="message bot loading">
            <div className="loading-dots">
              <span>.</span><span>.</span><span>.</span>
            </div>
          </div>
        )}
      </div>
      
      <div className="input-area">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask something..."
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          disabled={isLoading}
        />
        <button onClick={handleSend} disabled={isLoading}>
          {isLoading ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}

export default App;

