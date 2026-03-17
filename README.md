# SmartPDF Summary 🧠📄
An elegant, completely offline, and fully automated AI PDF Summarizer. 

Built with Node.js, Express, and modern glassmorphism frontend patterns, **SmartPDF Summary** allows you to upload large academic/professional PDF documents and transform them into beautifully structured study cards instantly. 

Powered by the immense reasoning capabilities of **Nvidia's Qwen 3.5 122B API**, logically processing massive documents to extract precisely what matters.

![SmartPDF Summary Interface](assets/landing_page.png)

## ✨ Features
- **Modern Minimalist UI**: Sleek dark-mode default, card-based layout, and smooth animations.
- **Deep Reasoning Processing**: Uses Nvidia's API for the massive Qwen 3.5 (122B) model.
- **Memory-Safe Extraction**: Parses PDFs cleanly using `pdf-parse` without saving unneeded files to your disk.
- **Smart Chunking**: Automatically breaks large documents down into contextually aware chunks so that the LLM limit is never overwhelmed.
- **Semantic Academic Structure**: Tightly prompt-engineered to always output JSON containing:
  - Global Overview
  - Key Concepts (Terms & Definitions)
  - Important Bullet Points
  - Detailed Synthesis
  - Final Conclusion
- **Quick Exports**: Instantly copy to clipboard, save as `.txt`, or generate formatted PDFs from your summaries directly via `jsPDF`.
- **Dynamic Word Counts**: Instantly compare original document length vs the condensed summary length.

---

## 🚀 Quickstart

### Prerequisites:
1. Ensure [Node.js](https://nodejs.org/) (v16+) is installed.
2. Get an API Key from Nvidia's API catalog (for Qwen 3.5).

### Setup:
1. Clone the repository:
```bash
git clone https://github.com/theo-odore/pdf-summarizer.git
cd pdf-summarizer
```

2. Install dependencies:
```bash
npm install
```

3. Configure Environment:
Create a `.env` file in the root directory and add your Nvidia API Key.
```env
NVIDIA_API_KEY=your_actual_api_key_here
PORT=3000
```

4. Start the Application:
```bash
npm start
```
*Your frontend will be served securely on `http://localhost:3000`*.

---

## 🛠️ Tech Stack
- **Frontend**: Vanilla HTML5, Advanced CSS3 (Vars, Glassmorphism, Responsive), Vanilla JS (`app.js`).
- **Backend API**: Node.js, Express.js.
- **Dependencies**: 
    - `pdf-parse` (v1.1.1) for reliable, clean text extraction.
    - `multer` for memory buffering file uploads.
    - `axios` for connecting the server logically to the Nvidia API.
- **LLM Pipeline**: Nvidia API integrating `qwen/qwen3.5-122b-a10b`.

---

## 🛡️ License
Licensed under the [MIT License](LICENSE).

Feel free to fork, expand the prompts, create PRs, or modify the themes to match your specific productivity workspace.
