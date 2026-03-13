# MultiCoder Build Blueprint

## 1) System Lens

```mermaid
flowchart LR
  U[User Browser] --> F[Frontend React + Monaco]
  F <--> C[Collab Server Hocuspocus/Yjs]
  F --> A[API Server Express]
  A --> M[(MongoDB)]
  A --> J[Judge0]
  C --> M
```

## 2) Layer Responsibilities

- **UI shell:** VS Code-like ergonomics (explorer, tabs, editor, output panel).
- **Real-time sync:** file-level Yjs docs over WebSocket rooms.
- **Execution:** backend-mediated Judge0 sandbox run flow.
- **Persistence:** MongoDB for users/projects/files/sessions/collaborators.

## 3) Build Sequence (Recommended)

```mermaid
graph TD
  A[Phase 1: UI shell] --> B[Phase 2: Auth + API models]
  B --> C[Phase 3: Yjs collab wiring]
  C --> D[Phase 4: Judge0 execution]
  D --> E[Phase 5: demo hardening]
```

## 4) Folder Strategy

```text
frontend/
  src/
    components/
    pages/
    lib/
backend/
  src/
    config/
    models/
    controllers/
    routes/
    middleware/
    services/
    collab/
```

## 5) Demo Checklist

- Open same project/file in two tabs or two machines.
- Verify shared edits and cursor presence.
- Click Run and show terminal output.
- Show dashboard, project cards, and polished editor shell.
