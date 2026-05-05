<p align="center">
  <h1 align="center">✨ ProsePolish</h1>
  <p align="center"><em>Write Naturally. Send Professionally.</em></p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/python-3.10+-blue.svg" alt="Python 3.10+">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License: MIT">
  <img src="https://img.shields.io/badge/status-active-success.svg" alt="Status: Active">
</p>

---

## 📖 Overview

ProsePolish is an **informal-to-professional email drafter** powered by a multi-agent LLM pipeline. Type casually as if texting a friend, select your tone, length, and recipient, and ProsePolish transforms your words into a polished, ready-to-send professional email — complete with a quality score and full transparency into how each agent refined the text.

---

## ✨ Features

- 🔄 **4-agent LLM pipeline** — analysis → draft → polish → quality review
- 🎭 **5 tone options** — Formal, Friendly, Persuasive, Diplomatic, Apologetic
- 📏 **3 length options** — Short, Medium, Long
- 👤 **5 recipient types** — Boss, Client, Colleague, Professor, Stranger
- 📧 **Gmail-inspired side-by-side UI** — casual input on the left, professional output on the right
- ⭐ **Quality score (1–10)** with a color-coded badge (green / yellow / red)
- 📋 **Copy-to-clipboard** with toast notifications for success and error states
- 🔍 **"See how it was made"** toggle revealing each agent's intermediate output
- 📱 **Responsive design** — panels stack vertically on screens narrower than 768px

---

## 🧠 Architecture

```
┌──────────────┐     ┌──────────────┐     ┌───────────────────────────────────┐
│              │     │              │     │  ┌─────────────────────────────┐  │
│   Frontend   │────▶│   FastAPI    │────▶│  │ 1. Context Analyzer         │  │
│  (HTML/CSS)  │     │  (Python)    │     │  │ 2. Draft Generator          │  │
│              │◀────│              │◀────│  │ 3. Polisher                 │  │
│              │     │              │     │  │ 4. QC Checker               │  │
└──────────────┘     └──────────────┘     │  └─────────────────────────────┘  │
                                          │                │                  │
                                          │           LLM (OpenAI)            │
                                          └───────────────────────────────────┘
```

### 🔗 4-Agent Pipeline Flow

| # | Agent | Responsibility |
|---|-------|----------------|
| 1 | 🔎 **Context Analyzer** | Parses the casual input to identify intent, urgency, target tone, and key points. Returns structured JSON. |
| 2 | ✍️ **Draft Generator** | Converts the original text into a full email draft, guided by the context analysis, selected tone, length, and recipient type. |
| 3 | 🪄 **Polisher** | Refines the draft — corrects grammar, replaces informal words, improves sentence flow, and ensures proper email etiquette. |
| 4 | ✅ **QC Checker** | Reviews the final email against 5 quality criteria, assigns a 1–10 score, and conditionally rewrites if the score falls below 7. |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Python 3.10+, FastAPI, OpenRouter API (Gemini, GPT, Claude, etc.), Pydantic |
| **Frontend** | Vanilla HTML / CSS / JavaScript, Google Fonts (Roboto) |

---

## 📁 Project Structure

```
ProsePolish/
├── README.md
├── backend/
│   ├── main.py                  # FastAPI server
│   ├── config.py                # Environment configuration
│   ├── llm.py                   # LLM provider (OpenRouter, with retry logic)
│   ├── requirements.txt
│   ├── .env.example
│   └── agents/
│       ├── pipeline.py          # Orchestrator — chains the 4 agents
│       ├── context_analyzer.py  # Agent 1: Intent & tone analysis
│       ├── draft_generator.py   # Agent 2: Initial email draft
│       ├── polisher.py          # Agent 3: Language refinement
│       └── qc_checker.py        # Agent 4: Quality review & scoring
└── frontend/
    ├── index.html               # Main page — Gmail-inspired layout
    ├── css/
    │   └── style.css            # Styles (CSS custom properties, responsive)
    └── js/
        └── app.js               # UI logic & API integration
```

---

## 🚀 Getting Started

### 📋 Prerequisites

- **Python 3.10+**
- **OpenRouter API key** ([get one free](https://openrouter.ai/keys)) — gives access to 200+ models

### ⚙️ Setup

```bash
# 1. Clone and enter the project
cd ProsePolish

# 2. Install Python dependencies
cd backend
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env and add your OPENROUTER_API_KEY

# 4. Start the backend server (runs on http://localhost:8000)
python main.py
```

Then open `frontend/index.html` in a browser, or serve it with any static server.

> ⚠️ **Note:** The frontend calls the backend at `http://localhost:8000` by default. If your backend runs elsewhere, update `API_BASE_URL` in `frontend/js/app.js`.

---

## 📡 API Reference

### `POST /api/transform`

Transforms casual text into a professional email.

**Request**

```json
{
  "text": "hey just wanted to check if you got my report, no rush though",
  "tone": "formal",
  "length": "medium",
  "recipient": "boss"
}
```

| Field | Type | Values | Description |
|-------|------|--------|-------------|
| `text` | `string` | 1–5000 chars | Casual / informal input text |
| `tone` | `string` | `formal`, `friendly`, `persuasive`, `diplomatic`, `apologetic` | Desired email tone |
| `length` | `string` | `short`, `medium`, `long` | Desired email length |
| `recipient` | `string` | `boss`, `client`, `colleague`, `professor`, `stranger` | Target recipient relationship |

**Response**

```json
{
  "original": "hey just wanted to check if you got my report, no rush though",
  "final_email": "Dear [Name],\n\nI hope this message finds you well. I wanted to follow up on the report I submitted recently. Could you please confirm whether it has been received?\n\nThere is no urgency — I simply want to ensure it reached you. Please let me know at your earliest convenience.\n\nThank you for your time.\n\nBest regards",
  "score": 8,
  "feedback": "Polite and professional. Language is appropriate for addressing a boss. Clear call to action. Well done.",
  "analysis": {
    "intent": "follow-up",
    "urgency": "low",
    "target_tone": "polite and professional",
    "key_points": ["check report receipt", "no rush", "confirmation requested"]
  },
  "intermediate_steps": [
    { "stage": "context_analysis", "output": { "intent": "follow-up", "urgency": "low" } },
    { "stage": "draft", "output": "Dear ..., \n\nI hope you are well..." },
    { "stage": "polished", "output": "Dear ..., \n\nI hope this message..." },
    { "stage": "qc_review", "output": { "score": 8, "feedback": "...", "final_email": "..." } }
  ],
  "tokens_used": 450,
  "error": null
}
```

### `GET /api/health`

Returns server health status.

```json
{ "status": "ok" }
```

---

## 🎨 Customization

### 🤖 Change the LLM model

OpenRouter gives you access to hundreds of models. Set the `OPENROUTER_MODEL` environment variable in `backend/.env`:

```env
# Default (fast & cheap)
OPENROUTER_MODEL=google/gemini-2.5-flash-lite

# More capable options
# OPENROUTER_MODEL=openai/gpt-4o-mini
# OPENROUTER_MODEL=anthropic/claude-3.5-haiku
# OPENROUTER_MODEL=google/gemini-2.5-pro
```

### 🔌 Custom API endpoint (self-hosted, Ollama, etc.)

Point `OPENROUTER_BASE_URL` to any OpenAI-compatible endpoint:

```env
OPENROUTER_BASE_URL=http://localhost:11434/v1
```

### 🧩 Tune agent prompts

Each agent's system prompt is defined at the top of its file in `backend/agents/`. For example, to make the polisher more aggressive about formality, edit `SYSTEM_PROMPT` in `backend/agents/polisher.py`. The draft generator also contains `TONE_GUIDELINES`, `LENGTH_GUIDELINES`, and `RECIPIENT_GUIDELINES` dictionaries you can customize at the top of `backend/agents/draft_generator.py`.

---

## 💰 Plans & Pricing

Priced in **Ringgit Malaysia (RM)**. Daily limits are calculated from the Gemini 2.5 Flash Lite API cost ($0.10/M input, $0.40/M output), with ~3,700 tokens consumed per email transformation.

| Tier | Price | Emails/day | API Budget | Best for |
|------|-------|-----------|------------|----------|
| **Percuma** | RM 0 | 5 | Free | Testing & occasional use |
| **Pro** | RM 9.90/bln | 50 | ~$1.00 USD | Daily professional use |
| **Premium** | RM 29.90/bln | 150 | ~$3.00 USD | Heavy users & teams |

### Per-email token breakdown

| Stage | Input | Output |
|-------|-------|--------|
| Context Analyzer | ~450 | ~80 |
| Draft Generator | ~950 | ~400 |
| Polisher | ~650 | ~400 |
| QC Checker | ~650 | ~150 |
| **Total** | **~2,700** | **~1,030** |

Cost per email: (2,700 × $0.10 + 1,030 × $0.40) / 1M = **~$0.00068**

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <sub>Built with ❤️ for cleaner communication</sub>
</p>
