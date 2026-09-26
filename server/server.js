// ==========================================
// 1. IMPORT PACKAGES
// ==========================================

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PDFParse } = require("pdf-parse");

const app = express();


// ==========================================
// 2. MIDDLEWARE
// ==========================================

app.use(cors());
app.use(express.json());


// ==========================================
// 3. GEMINI INITIALIZATION
// ==========================================

const genAI = new GoogleGenerativeAI(
    process.env.GEMINI_API_KEY
);


// ==========================================
// 4. MONGODB CONNECTION
// ==========================================

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB connected successfully");
    })
    .catch((error) => {
        console.error("MongoDB connection error:", error.message);
    });


// ==========================================
// 5. USER SCHEMA
// ==========================================

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },

    email: {
        type: String,
        required: true,
        unique: true
    },

    password: {
        type: String,
        required: true
    }
});

const User = mongoose.model("User", userSchema);


// ==========================================
// 6. RESUME SCHEMA
// ==========================================

const resumeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    fileName: String,

    extractedText: String,

    uploadedAt: {
        type: Date,
        default: Date.now
    }
});

const Resume = mongoose.model("Resume", resumeSchema);


// ==========================================
// 7. JWT AUTHENTICATION MIDDLEWARE
// ==========================================

function authenticateToken(req, res, next) {

    const authHeader = req.headers["authorization"];

    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            message: "No token provided"
        });
    }

    jwt.verify(
        token,
        process.env.JWT_SECRET,
        (error, user) => {

            if (error) {
                return res.status(403).json({
                    message: "Invalid or expired token"
                });
            }

            req.user = user;

            next();
        }
    );
}
// ==========================================
// 8. GUEST LOGIN ROUTE
// ==========================================

app.post("/guest", (req, res) => {

    try {

        const token = jwt.sign(
            {
                id: "guest",
                email: "guest@resumeats.demo",
                guest: true
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1h"
            }
        );

        res.json({
            message: "Guest access granted",
            token
        });

    } catch (error) {

        console.error("Guest Login Error:", error.message);

        res.status(500).json({
            message: "Guest access failed"
        });
    }
});


// ==========================================
// 8. REGISTER ROUTE
// ==========================================

app.post("/register", async (req, res) => {

    try {

        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Name, email and password are required"
            });
        }

        const existingUser = await User.findOne({
            email: email.toLowerCase()
        });

        if (existingUser) {
            return res.status(409).json({
                message: "Email already registered"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name,
            email: email.toLowerCase(),
            password: hashedPassword
        });

        await newUser.save();

        res.status(201).json({
            message: "Registration successful"
        });

    } catch (error) {

        console.error("Register Error:", error.message);

        res.status(500).json({
            message: "Registration failed"
        });
    }
});


// ==========================================
// 9. LOGIN ROUTE
// ==========================================

app.post("/login", async (req, res) => {

    try {

        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const user = await User.findOne({
            email: email.toLowerCase()
        });

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const isMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!isMatch) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        const token = jwt.sign(
            {
                id: user._id,
                email: user.email
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1d"
            }
        );

        res.json({
            message: "Login successful",
            token
        });

    } catch (error) {

        console.error("Login Error:", error.message);

        res.status(500).json({
            message: "Login failed"
        });
    }
});


// ==========================================
// 10. PROTECTED ROUTE
// ==========================================

app.get(
    "/protected",
    authenticateToken,
    (req, res) => {

        res.json({
            message: "You are authenticated",
            user: req.user
        });
    }
);


// ==========================================
// 11. MULTER PDF UPLOAD CONFIGURATION
// ==========================================

const storage = multer.memoryStorage();

const upload = multer({
    storage,

    limits: {
        fileSize: 5 * 1024 * 1024
    },

    fileFilter: (req, file, cb) => {

        const isPDF =
            file.mimetype === "application/pdf" ||
            file.originalname.toLowerCase().endsWith(".pdf");

        if (isPDF) {
            cb(null, true);
        } else {
            cb(new Error("Only PDF files are allowed"));
        }
    }
});


// ==========================================
// 12. RESUME UPLOAD ROUTE
// ==========================================

app.post(
    "/resume/upload",
    authenticateToken,
    upload.single("resume"),
    async (req, res) => {

        let parser;

        try {

            if (!req.file) {
                return res.status(400).json({
                    message: "Please upload a PDF resume"
                });
            }

            // Extract text from PDF
            parser = new PDFParse({
                data: req.file.buffer
            });

            const result = await parser.getText();

            const extractedText = result.text;

            if (!extractedText || !extractedText.trim()) {
                return res.status(400).json({
                    message: "No readable text found in PDF"
                });
            }

            // Save resume in MongoDB
            let resumeId = null;

if (!req.user.guest) {
    const resume = new Resume({
        userId: req.user.id,
        fileName: req.file.originalname,
        extractedText
    });

    await resume.save();

    resumeId = resume._id;
}

res.json({
    message: "Resume uploaded successfully",
    resumeId,
    fileName: req.file.originalname,
    extractedText
});

        } catch (error) {

            console.error("Resume Upload Error:", error);

            res.status(500).json({
                message: "Resume upload failed",
                error: error.message
            });

        } finally {

            if (parser) {
                await parser.destroy().catch(() => {});
            }
        }
    }
);


// ==========================================
// 13. ATS ANALYSIS ROUTE
// ==========================================

app.post(
    "/ats/analyze",
    authenticateToken,
    async (req, res) => {

        try {

            const { resumeText, jobDescription } = req.body;

            // Validate input
            if (!resumeText || !jobDescription) {
                return res.status(400).json({
                    message: "Resume text and job description are required"
                });
            }

            if (!process.env.GEMINI_API_KEY) {
                return res.status(500).json({
                    message: "Gemini API key is missing from server .env"
                });
            }

            // Get Gemini model
            const model = genAI.getGenerativeModel({
            model: "gemini-3.6-flash"
            });
            console.log("ATS is using gemini-3.6-flash");

            // Prompt for ATS analysis
            const prompt = `
You are an Applicant Tracking System (ATS) resume analyzer.

Analyze the resume against the job description.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Evaluate:
1. Resume match score from 0 to 100.
2. Skills that match the job description.
3. Skills missing from the resume.
4. Suggestions to improve the resume for this job.

Return ONLY valid JSON in this exact format:

{
  "score": 75,
  "matchedSkills": ["Python", "Machine Learning"],
  "missingSkills": ["SQL", "Power BI"],
  "suggestions": [
    "Add measurable achievements to project descriptions",
    "Include relevant keywords from the job description"
  ]
}

Rules:
- Score must be a number between 0 and 100.
- matchedSkills must be an array of strings.
- missingSkills must be an array of strings.
- suggestions must be an array of strings.
- Do not include Markdown.
- Do not invent skills or experience.
`;

            // Send prompt to Gemini
            const result = await model.generateContent(prompt);

            const response = result.response;

            const text = response.text();

            // Remove possible Markdown code fences
            const cleanedText = text
                .replace(/```json/gi, "")
                .replace(/```/g, "")
                .trim();

            // Convert Gemini response to JSON
            const analysis = JSON.parse(cleanedText);

            // Validate response structure
            if (
                typeof analysis.score !== "number" ||
                !Array.isArray(analysis.matchedSkills) ||
                !Array.isArray(analysis.missingSkills) ||
                !Array.isArray(analysis.suggestions)
            ) {
                throw new Error("Gemini returned an invalid ATS response");
            }

            // Send result to frontend
            res.json({
                message: "ATS analysis successful",
                score: Math.max(0, Math.min(100, analysis.score)),
                matchedSkills: analysis.matchedSkills,
                missingSkills: analysis.missingSkills,
                suggestions: analysis.suggestions
            });

        } catch (error) {

            console.error("ATS Analysis Error:", error);

            res.status(500).json({
                message: "ATS analysis failed",
                error: error.message
            });
        }
    }
);


// ==========================================
// 14. HOME ROUTE
// ==========================================

app.get("/", (req, res) => {

    res.send("Resume ATS Backend is running!");
});


// ==========================================
// 15. GLOBAL ERROR HANDLER
// ==========================================

app.use((error, req, res, next) => {

    console.error("Server Error:", error.message);

    res.status(500).json({
        message: error.message || "Internal server error"
    });
});


// ==========================================
// 16. START SERVER
// ==========================================

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {

    console.log(`Server running on port ${PORT}`);
});