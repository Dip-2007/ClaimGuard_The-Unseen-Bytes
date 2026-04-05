# 🛡️ ClaimGuard (The Unseen Bytes)

**ClaimGuard** is a premium, AI-powered Electronic Data Interchange (EDI) management platform designed to parse, validate, and remediate healthcare transactions with unprecedented speed and accuracy. Built with a modern tech stack, ClaimGuard leverages the power of Google Gemini AI to not only identify HIPAA 5010 structural errors but actively suggest and apply context-aware fixes.

---

## 🏗️ System Architecture

![ClaimGuard System Architecture](./system_architecture.png)

---

## ✨ Key Features

- **🚀 High-Performance Parsing Engine:** Instantly parse complex, hierarchical X12 EDI files (`837P` Claims, `835` Remit, `834` Enrollment).
- **✅ Strict HIPAA 5010 Validation:** Deep structural validation against loop locations, required segments, element constraints, and precise subset rules (predictive DTP and REF logic).
- **🤖 AI-Driven Remediation:** Integrated with Google Gemini to provide specific, element-level corrections for validation errors.
- **⚡ Batch Processing:** Upload `.zip` archives of EDI files to process, validate, and fix multiple transactions at once without losing interface state.
- **💬 Workspace Chat Assistant:** A built-in AI assistant ("ClaimGuard AI") that understands your current raw EDI context and provides line-by-line feedback, denial mitigation strategies, and structural analysis.
- **🌓 Dynamic UI/UX:** A stunning, ultra-modern Glassmorphism interface featuring full Light/Dark mode support, buttery smooth Framer Motion animations, and data-rich dashboards (Remittance and Enrollment).
- **💾 History & Persistence:** Secure authentication flow storing file uploads to Cloudinary and parsing/fixing history to MongoDB for seamless audit trails.

---

## 🛠️ Technology Stack

### Frontend
- **React 18 + TypeScript**
- **Vite**
- **Tailwind CSS** (for responsive, utility-first styling)
- **Framer Motion** (for buttery smooth micro-animations and page transitions)
- **React Markdown** (for rendering rich AI chatbot responses)

### Backend
- **FastAPI (Python)** (High-performance Async backend API)
- **Pydantic** (Robust data validation and models)
- **Google Gemini API** (`gemini-2.5-flash` for high-context natural language reasoning)
- **MongoDB** (NoSQL database for user history and scalable metrics)
- **Cloudinary** (Secure static file hosting for raw EDI uploads)

---

## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone <repository-url>
cd coepHackathon
```

### 2. Backend Setup (FastAPI)
Navigate to the backend directory and set up the Python environment:
```bash
cd backend
python -m venv venv

# Activate the virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

**Environment Variables:**
Create a `.env` file in the `backend` directory:
```env
GEMINI_API_KEY=your_gemini_key_here
MONGODB_URI=your_mongo_connection_string
CLOUDINARY_URL=your_cloudinary_url
JWT_SECRET=your_jwt_secret
```

**Run the Backend Server:**
```bash
uvicorn main:app --reload
```
*The backend will be running on `http://127.0.0.1:8000`.*

### 3. Frontend Setup (React/Vite)
Navigate to the frontend directory:
```bash
cd ../frontend
npm install
```

**Run the Frontend Development Server:**
```bash
npm run dev
```
*The frontend will be accessible at the localhost port provided in the terminal (usually `http://localhost:5173`).*

---

## 🧠 How the AI Remediation Works

1. **Parser & Validator:** The core EDI engine separates the payload into Segments, Elements, and structural Loops, analyzing each node for non-compliance.
2. **Context Window:** When an error is identified, the backend extracts the specific error rule, the erroneous line, and surrounding ±3 lines to preserve hierarchy.
3. **Disambiguation Engine:** Errors are uniquely keyed by `[ErrorID + LineNumber + SegmentIndex]` to prevent collisions.
4. **LLM Verification:** Google Gemini evaluates the snippet against HIPAA 5010 rules and provides a **Fix Recommendation String** directly to the editor interface.

---

## 🎨 UI Aesthetics & Light Mode

ClaimGuard features a custom design language focused on enterprise premium aesthetics.
Enjoy the clinical and deep **Dark Mode** for intense debugging sessions, or toggle the bright, refreshing, corporate-style **Light Mode** equipped with dark neutrally balanced text and elegant shadows out-of-the-box. 

---

Made with ❤️ by **The Unseen Bytes** for the COEP Hackathon.
