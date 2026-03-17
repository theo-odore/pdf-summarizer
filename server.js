require('dotenv').config();
const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer for memory storage (max 50MB)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed.'), false);
        }
    }
});

// Calculate approximate word count
const getWordCount = (text) => text.split(/\s+/).filter(word => word.length > 0).length;

// Route: Upload & Extract Text
app.post('/api/upload', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No PDF file uploaded.' });
        }

        const data = await pdfParse(req.file.buffer);
        const text = data.text;
        const wordCount = getWordCount(text);

        res.json({
            text: text,
            wordCount: wordCount,
            pageCount: data.numpages
        });

    } catch (error) {
        console.error('Error parsing PDF:', error.message);
        res.status(500).json({ error: 'Failed to extract text from PDF.' });
    }
});

// Helper definition constraints for Gemini API
const SYSTEM_PROMPT = `You are a professional AI summarization assistant.
You must always generate a structured summary from the provided text in the exact format outlined below.
Do not include markdown headers like # or ##. Do not generate conversational intro or outro text.
Output MUST be an exact JSON object containing exactly these keys: "title", "overview", "keyConcepts", "importantPoints", "detailedSummary", "conclusion".

Structure Specifications for JSON fields:
- "title": Title of the Document
- "overview": A short explanation of what the document is about (3-4 sentences).
- "keyConcepts": An array of objects where each object has "concept" and "explanation".
- "importantPoints": An array of strings representing bullet points of the most important insights.
- "detailedSummary": A longer explanation describing the complete idea of the document in simple language.
- "conclusion": Final takeaway of the document in 2-3 sentences.`;

// Chunk text function (approx 10,000 words per chunk to fit within limits comfortably)
const chunkText = (text, maxWords = 10000) => {
    const words = text.split(/\s+/);
    const chunks = [];
    for (let i = 0; i < words.length; i += maxWords) {
        chunks.push(words.slice(i, i + maxWords).join(' '));
    }
    return chunks;
};

// Route: Summarize Text
app.post('/api/summarize', async (req, res) => {
    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'No text provided for summarization.' });
        }

        const chunks = chunkText(text);
        let finalSummaryText = '';

        if (chunks.length === 1) {
            // Single request
            finalSummaryText = await callQwenAPI(chunks[0]);
        } else {
            // Multiple chunks: summarize chunks independently then combine
            const chunkSummaries = await Promise.all(
                chunks.map((chunk, index) => callQwenAPI(chunk, `Part ${index + 1}`))
            );

            // Final synthesis pass
            const combinedText = chunkSummaries.map(r => JSON.stringify(r)).join('\\n\\n');
            finalSummaryText = await callQwenAPI(`Synthesize the following partial summaries into one final summary adhering strictly to the required JSON structure:\\n\\n${combinedText}`);
        }

        res.json(finalSummaryText);

    } catch (error) {
        console.error('Error generating summary:', error?.response?.data || error.message);
        res.status(500).json({ error: 'Failed to generate summary.' });
    }
});

// Call Qwen API
async function callQwenAPI(inputText, partContext = "") {
    if (!NVIDIA_API_KEY) {
        throw new Error("NVIDIA_API_KEY is not set in environment variables.");
    }

    const endpoint = "https://integrate.api.nvidia.com/v1/chat/completions";

    const contextStr = partContext ? `This is ${partContext} of a larger document. ` : '';
    const fullPrompt = `${SYSTEM_PROMPT}\n\n${contextStr}Analyze the following text and return the structured JSON strictly:\n\n${inputText}`;

    const payload = {
        model: "qwen/qwen3.5-122b-a10b",
        messages: [{"role": "user", "content": fullPrompt}],
        max_tokens: 8192,
        temperature: 0.3,
        top_p: 0.95,
        stream: false
    };

    const response = await axios.post(endpoint, payload, {
        headers: { 
            'Authorization': `Bearer ${NVIDIA_API_KEY}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    });

    const outputText = response.data?.choices?.[0]?.message?.content;

    if (!outputText) {
        throw new Error('Invalid response structure from Qwen API');
    }

    try {
        let cleanText = outputText.trim();
        if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/^```[a-z]*\n/, '').replace(/\n```$/, '').trim();
        }
        return JSON.parse(cleanText);
    } catch (e) {
        console.error("Failed to parse Qwen output as JSON", outputText);
        throw new Error("Qwen API did not return valid JSON");
    }
}

// Global error handler for JSON & Multer
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File size exceeds 50 MB limit.' });
        }
    } else if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
});


app.listen(PORT, () => {
    console.log(`SmartPDF Summary Server running on http://localhost:${PORT}`);
});
