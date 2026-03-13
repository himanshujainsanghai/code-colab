# MultiCoder

A VS Code-style collaborative web IDE with:
- React + Vite + Monaco frontend
- Express + MongoDB backend
- Hocuspocus (Yjs) real-time collaboration server
- Judge0-based code execution

## Development Flow (Comprehensive Plan)

### Phase 1: UI Shell (showcase-first)
1. Build core VS Code layout:
   - activity bar
   - file explorer
   - Monaco editor + tabs
   - terminal/output panel
2. Implement route structure:
   - landing
   - auth pages
   - dashboard
   - profile
   - project editor
3. Keep visuals clean and consistent:
   - `#1e1e1e` editor surface
   - minimal contrast accents
   - clear, compact typography

### Phase 2: Backend + Auth
1. Add Mongo collections: users, projects, collaborators, files, sessions
2. Implement JWT auth with refresh cookie rotation
3. Add project/file CRUD and collaborator role routes

### Phase 3: Real-Time Collaboration
1. Use Yjs document per file
2. Sync through Hocuspocus room keyed by `projectId-fileId`
3. Persist Yjs doc back to MongoDB through `onStoreDocument`
4. Render presence via Yjs awareness in Monaco

### Phase 4: Code Execution
1. Backend `POST /api/run`
2. Submit to Judge0 and poll until complete
3. Return output to terminal panel

### Phase 5: Integration + Demo
1. Two users open same file -> shared room
2. CRDT updates converge instantly
3. Run button executes active file and streams final output

## Project Structure

```text
frontend/  -> React UI shell + editor + auth screens
backend/   -> API + auth + persistence + collab + execution
```

## Quick Start

### 1) Frontend
```bash
cd frontend
npm install
npm run dev
```

### 2) Backend
```bash
cd backend
npm install
npm run dev
```

Create `.env` files from each `.env.example` before running.

## Render Deployment Note (Backend)

For Render backend builds, use this exact build command:

```bash
npm install --include=dev && npm run build
```

Do not use only `npm run build` on Render, because TypeScript build tooling is in dev dependencies and must be installed during build.
