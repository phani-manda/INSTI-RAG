# Document RAG Assistant

Ask questions about PDF and text documents with Groq-powered answers, local vector search, and source citations. FastAPI serves both the web interface and API.

## Features

- Upload and index multiple PDF and TXT files in one session.
- Ask follow-up questions about the indexed documents.
- Receive answers with source file and PDF page references.
- Choose between Groq's GPT OSS 120B and GPT OSS 20B models.
- Export chat history and start a clean session.
- Store document chunks and embeddings in a persistent local Chroma vector database.
- Add files over multiple uploads; indexed documents remain available after restarts.
- Delete all stored documents and embeddings from the interface.

## Run on your laptop

Choose either Docker (the same steps on Windows, macOS, and Linux) or a local Python install. Both approaches need internet access for Groq and for Chroma to download its local embedding model the first time a document is indexed.

### Option A: Docker (same on Windows, macOS, and Linux)

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/macOS) or Docker Engine with the Compose plugin (Linux), then start Docker.
2. Clone this repository and enter its folder:

   ```bash
   git clone https://github.com/ZohaibCodez/document-qa-rag-system.git
   cd document-qa-rag-system
   ```

3. Copy `.env.example` to `.env` and edit `.env`, replacing the placeholder with a key from [Groq Console](https://console.groq.com/keys):

   ```env
   GROQ_API_KEY=gsk_your_real_key_here
   CHROMA_DB_PATH=./chroma_db
   ```

   PowerShell copy command: `Copy-Item .env.example .env`. macOS/Linux: `cp .env.example .env`.
4. Build and start the app:

   ```bash
   docker compose up --build
   ```

5. Open [http://localhost:8000](http://localhost:8000). Keep the terminal open while using the app; press `Ctrl+C` to stop it. Start it again later with `docker compose up`.

Docker Compose stores the vector database in the project’s `chroma_db/` directory, so indexed documents remain available across restarts and container rebuilds. To update the app, run `git pull` and then `docker compose up --build`.

### Option B: Run with Python

Install Python 3.12 or newer, clone the repository as shown above, and run the commands for your operating system from the project folder.

Create and activate a virtual environment:

**Windows PowerShell**

```powershell
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
```

If PowerShell blocks activation, use Command Prompt instead: `.venv\Scripts\activate.bat`.

**macOS / Linux**

```bash
python3.12 -m venv .venv
source .venv/bin/activate
```

Install dependencies, create `.env` from the example, and start the server:

```bash
python -m pip install -r requirements.txt
```

Copy `.env.example` to `.env` (use the platform-specific copy command above) and set `GROQ_API_KEY` to your key. Then run:

```bash
python -m uvicorn app:app --reload
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000). Keep the terminal open while using the app; press `Ctrl+C` to stop it. The first indexing run downloads Chroma's ONNX MiniLM embedding model (about 79 MB); later runs use the local copy.

### Troubleshooting

- **`uv` is not recognized:** `uv` is optional. Use the Python/pip commands above, or install uv using its [official installation guide](https://docs.astral.sh/uv/getting-started/installation/) before using `uv sync` and `uv run uvicorn app:app --reload`.
- **Port 8000 is already in use:** stop the other process or start on another port with `python -m uvicorn app:app --reload --port 8001`, then open `http://127.0.0.1:8001`.
- **Groq key errors:** check that `.env` contains `GROQ_API_KEY=...` with a valid key. The key entered in the app UI is kept only in that browser tab's session storage.
- **Document indexing is slow the first time:** wait for the local embedding model download to finish. Later indexing runs reuse it.
- **PowerShell blocks environment activation:** run `.venv\Scripts\Activate.ps1` from Command Prompt as `.venv\Scripts\activate.bat`, or use Docker instead.

## API

- `GET /api/health` reports app status and available model IDs.
- `POST /api/upload` accepts `session_id` and one or more `files` as multipart form fields.
- `GET /api/documents` lists persistent files and indexed chunk counts.
- `POST /api/chat` accepts `session_id`, `question`, `model`, and optional `api_key` as JSON.
- `POST /api/clear` clears an in-memory session.
- `DELETE /api/database` removes all stored document chunks and embeddings after confirmation.
- `GET /api/export/{session_id}` returns the session's chat history as JSON.
- Interactive OpenAPI docs are available at `/docs`.

Chat history is held in server memory and clears on restart. The Chroma collection persists in `chroma_db/`. For multiple app workers or hosts, point them at a shared Chroma server instead of opening the local database directory from multiple processes.

## Docker

```bash
docker compose up --build
```

Set `GROQ_API_KEY` in `.env` before starting. The app will be available at `http://localhost:8000`.

## Current limits

- PDF and plain text files only; scanned PDFs require OCR.
- Each upload is limited to 100 MB total; upload more files in later batches.
- Chat history is held in memory for the current server process; indexed document embeddings persist in `chroma_db/`.
