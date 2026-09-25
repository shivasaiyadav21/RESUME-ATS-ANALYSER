import { useState } from "react";
import API from "./api";
import "./App.css";

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [file, setFile] = useState(null);
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  const [message, setMessage] = useState("");
  const [analysis, setAnalysis] = useState(null);

  // LOGIN
  const handleLogin = async () => {
    if (!email || !password) {
      setMessage("Please enter email and password");
      return;
    }

    try {
      const response = await API.post("/login", {
        email,
        password
      });

      localStorage.setItem("token", response.data.token);
      setMessage("Login successful!");
    } catch (error) {
      setMessage(
        error.response?.data?.message || "Login failed"
      );
    }
  };

  // UPLOAD RESUME
  const handleUpload = async () => {
    if (!file) {
      setMessage("Please select a PDF resume");
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      setMessage("Please login first");
      return;
    }

    const formData = new FormData();
    formData.append("resume", file);

    try {
      const response = await API.post(
        "/resume/upload",
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setMessage(response.data.message);
      setResumeText(response.data.extractedText);
      setAnalysis(null);

    } catch (error) {
      setMessage(
        error.response?.data?.message || "Upload failed"
      );
    }
  };

  // ANALYZE RESUME
  const handleAnalyze = async () => {
    if (!resumeText) {
      setMessage("Please upload your resume first");
      return;
    }

    if (!jobDescription) {
      setMessage("Please enter a job description");
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      setMessage("Please login first");
      return;
    }

    try {
      setMessage("Analyzing resume...");

      const response = await API.post(
        "/ats/analyze",
        {
          resumeText: resumeText,
          jobDescription: jobDescription
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setAnalysis(response.data);

      setMessage(
        "ATS analysis completed successfully!"
      );

    } catch (error) {
      console.log(error);

      setMessage(
        error.response?.data?.message ||
        "ATS analysis failed"
      );
    }
  };

  return (
    <div className="app">

      {/* HEADER */}
      <header className="header">
        <h1>Resume ATS Analyzer</h1>
        <p>
          Analyze your resume against a job description
        </p>
      </header>

      {/* LOGIN CARD */}
      <section className="card">
        <h2>🔐 Login</h2>

        <input
          type="email"
          placeholder="Enter email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button onClick={handleLogin}>
          Login
        </button>
      </section>

      {/* UPLOAD CARD */}
      <section className="card">
        <h2>📄 Upload Resume</h2>

        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files[0])}
        />

        <button onClick={handleUpload}>
          Upload Resume
        </button>
      </section>

      {/* MESSAGE */}
      {message && (
        <div className="message">
          {message}
        </div>
      )}

      {/* RESUME TEXT */}
      {resumeText && (
        <section className="card">
          <h2>📋 Extracted Resume Text</h2>

          <textarea
            value={resumeText}
            readOnly
            rows="12"
          />
        </section>
      )}

      {/* JOB DESCRIPTION */}
      {resumeText && (
        <section className="card">
          <h2>💼 Job Description</h2>

          <textarea
            placeholder="Paste the job description here..."
            value={jobDescription}
            onChange={(e) =>
              setJobDescription(e.target.value)
            }
            rows="10"
          />

          <button onClick={handleAnalyze}>
            Analyze Resume
          </button>
        </section>
      )}

      {/* ATS REPORT */}
      {analysis && (
        <section className="report">

          <h2>📊 ATS Analysis Report</h2>

          {/* SCORE */}
          <div className="score-card">
  <h3>ATS Score</h3>

  <div
    className="score-circle"
    style={{
      "--score": `${analysis.score * 3.6}deg`
    }}
  >
    <div className="score">
      {analysis.score}%
    </div>
  </div>

  <p>
    Resume compatibility score
  </p>
</div>

          {/* MATCHED SKILLS */}
          <div className="result-card">
            <h3>✅ Matched Skills</h3>

<div className="skills-container">
  {analysis.matchedSkills?.map(
    (skill, index) => (
      <span className="skill matched" key={index}>
        {skill}
      </span>
    )
  )}
</div>
          </div>

          {/* MISSING SKILLS */}
          <div className="result-card">
            <h3>❌ Missing Skills</h3>

            <ul>
              {analysis.missingSkills?.map(
                (skill, index) => (
                  <li key={index}>{skill}</li>
                )
              )}
            </ul>
          </div>

          {/* SUGGESTIONS */}
          <div className="result-card">
            <h3>💡 Suggestions</h3>

<div className="suggestions-container">
  {analysis.suggestions?.map(
    (suggestion, index) => (
      <div className="suggestion" key={index}>
        <span className="suggestion-number">
          {index + 1}
        </span>

        <span>{suggestion}</span>
      </div>
    )
  )}
</div>
          </div>
          

        </section>
      )}

    </div>
  );
}

export default App;