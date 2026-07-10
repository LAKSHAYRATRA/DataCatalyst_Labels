# VocLara Audio Timestamp Editor

A MERN-stack web application for editing word-level audio timestamps — replacing the Audacity label workflow for VocLara's conversation data pipeline.

## Features

- **Audio upload** — WAV, MP3, OGG, FLAC, M4A
- **Visual waveform canvas** — Audacity-style audio track with playhead
- **Zoom & scroll** — Expand timeline (e.g. 20 min → 1 min visible) with horizontal scrolling
- **Playback controls** — Play, pause, stop, click-to-seek on waveform
- **Paragraph transcription** — Upload and edit plain-text transcription alongside audio
- **Word-level labels** — Upload Audacity labels (.txt) or JSON timestamps
- **Drag boundaries** — Adjust label start/end by dragging edges on the label track
- **Per-word playback** — Click any label to hear that word segment
- **Export** — Download corrected labels as Audacity .txt or JSON

## Project Structure

```
voclara_audacity/
├── backend/          # Express + MongoDB API
│   ├── server.js
│   ├── routes/
│   ├── models/
│   ├── middleware/
│   └── uploads/      # Stored audio files
└── frontend/         # React + Vite UI
    └── src/
        ├── components/
        └── api/
```

## Prerequisites

- Node.js 18+
- MongoDB (optional — app falls back to in-memory storage if MongoDB is unavailable)

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

API runs at `http://localhost:5000`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173`

## Label File Formats

### Audacity labels (.txt)

```
0.500000	1.200000	hello
1.200000	1.800000	world
```

### JSON

```json
{
  "words": [
    { "start": 0.5, "end": 1.2, "text": "hello" },
    { "start": 1.2, "end": 1.8, "text": "world" }
  ]
}
```

## Usage Workflow

1. Upload your audio file
2. Upload paragraph transcription (optional) — edit in the Transcription tab
3. Upload word-level labels — segments appear on the label track
4. Zoom in to focus on a section (use slider or +/- buttons)
5. Play individual words by clicking label regions
6. Drag label edges to fix timestamp leakage or misalignment
7. Export corrected labels when done

## Tech Stack

- **M**ongoDB + Mongoose
- **E**xpress.js
- **R**eact (Vite)
- **N**ode.js
- WaveSurfer.js for waveform rendering
