---

# db-live-diff

A lightweight, local-first schema introspection and live migration diff engine. It watches your target database (SQLite, PostgreSQL, MySQL, MSSQL, or MongoDB) and generates real-time, git-style visual diffs as schema modifications and migrations occur.

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/AmirHosseinMoloudi/db-live-diff/blob/main/LICENSE)
[![Bun Runtime](https://img.shields.io/badge/Runtime-Bun-black?logo=bun)](https://bun.sh)
[![Hono Framework](https://img.shields.io/badge/Framework-Hono-orange?logo=hono)](https://hono.dev)
[![Prisma Engine](https://img.shields.io/badge/Engine-Prisma-darkblue?logo=prisma)](https://prisma.io)

---

## Why `db-live-diff`?

During local development, verifying database structural changes is often a repetitive and manual task. Developers typically have to:
* **Enable verbose ORM logging**, which floods the console with unformatted, parameterized SQL statements.
* **Repeatedly refresh database GUIs** (such as TablePlus, Drizzle Studio, or pgAdmin) to check if a migration, seed script, or column modification applied as expected.

`db-live-diff` addresses this by acting as a local schema monitoring hub. It leverages Prisma's highly optimized introspection and migration-diff engines under the hood, compiling structural transitions into clean, color-coded, deterministic diff layouts streamed directly to a local web interface via WebSockets.

![db-live-diff Screenshot](screenshot.png)

---

## System Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          LOCAL DEVELOPMENT DIALOG                      │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ (Performs DB schema mutations)
                                     ▼
 ┌───────────────────────┐     ┌───────────┐
 │                       │     │  Active   │
 │   React Dashboard     │◄────┤  Database │
 │   (Port 5173)         │     │ (SQLite,  │
 └───────────▲───────────┘     │  Postgres)│
             │                 └─────▲─────┘
             │ (WebSockets)          │
             ▼                       │
 ┌───────────────────────────────────┴─────┐      ┌──────────────────────┐
 │             Bun/Hono Backend            ├─────►│  Prisma Rust Engine  │
 │             (Port 3001)                 │      │  (pull / migrate)    │
 └─────────────────────────────────────────┘      └──────────────────────┘
```

The application runs as two separate parts in a local monorepo structure:
1. **The Backend (Bun + Hono):** A lightweight server that manages client WebSocket connections, temporarily initializes a Prisma sandbox schema for the specified database, executes the programmatic Prisma CLI calls, and monitors for modifications.
2. **The Frontend (React + Vite + Tailwind CSS):** A responsive, dark-mode developer dashboard that displays the current schema state and streams incoming change logs with Git-style green (additions) and red (deletions) highlighting.

---

## Key Features

* **Multi-Engine Introspection:** Seamlessly supports SQLite, PostgreSQL, MySQL, Microsoft SQL Server, MongoDB, and CockroachDB.
* **Automated Introspection Handling:** Gracefully intercepts and parses database states, including empty database parameters (Prisma Error `P4001`), keeping the polling active with schema placeholders.
* **Programmatic Diffing Engine:** Converts database states to standardized Prisma schemas and runs diff operations via the Prisma CLI, emitting structured SQL script deltas.
* **Sub-second Polling Cycle:** Streams structural updates directly to your browser over native WebSockets in real time.
* **No Database Hooks Required:** Runs purely as an external monitor; does not write triggers, install native database extensions, or inject middleware into your main application code.

---

## Directory Structure

```text
db-live-diff/
├── backend/
│   ├── src/
│   │   ├── index.ts        # Hono server configuration & WebSocket setup
│   │   └── diffEngine.ts   # Subprocess spawning logic for Prisma CLI
│   ├── package.json        # Hono, Prisma, and Bun configuration
│   └── tsconfig.json
└── frontend/
    ├── src/
    │   ├── components/     
    │   ├── App.tsx         # Dashboard UI, diff log renderer & state management
    │   ├── index.css       # Tailwind base directives
    │   └── main.tsx
    ├── index.html
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── vite.config.ts
    └── package.json
```

---

## Installation & Setup

### Option 1: Manual Installation

If you prefer to configure the codebase manually, follow these steps:

#### 1. Clone the repository
```bash
git clone https://github.com/AmirHosseinMoloudi/db-live-diff.git
cd db-live-diff
```

#### 2. Configure the Backend
```bash
cd backend
bun install
```

#### 3. Configure the Frontend
```bash
cd ../frontend
bun install
```

---

## Running the Application

To run the application, you must start both the backend server and the frontend dashboard. 

### 1. Start the Backend (Port 3001)
Open a terminal window and navigate to the backend folder:
```bash
cd backend
bun run dev
```

### 2. Start the Frontend Dashboard (Port 5173)
Open a separate terminal window and navigate to the frontend folder:
```bash
cd frontend
bun run dev
```

Open your browser and navigate to: **`http://localhost:5173`**

---

## Connection URL Configuration Guide

To begin watching a database, input the appropriate connection string into the **Database Connection URL** input field on the dashboard and click **Start Watcher**.

### 1. SQLite File Configuration
Relative paths in Prisma are resolved starting from the directory where the schema file resides (`backend/.temp_diff/`). 

* **SQLite File in Project Root (`db-live-diff/dev.db`):**
  ```text
  file:../../dev.db
  ```
* **Absolute Path on Windows (Note the forward slashes):**
  ```text
  file:C:/path/to/your/database.db
  ```

### 2. PostgreSQL Configuration
```text
postgresql://username:password@localhost:5432/my_database?schema=public
```

### 3. MySQL Configuration
```text
mysql://username:password@localhost:3306/my_database
```

### 4. MongoDB Configuration
```text
mongodb://username:password@localhost:27017/my_database?authSource=admin
```

---

## Simulating Local Schema Mutations

Once you have pointed `db-live-diff` to your database file or instance and clicked **Start Watcher** (Status should indicate `WATCHING`), you can test the real-time diffing functionality.

To simulate schema changes using Bun's built-in SQLite utility, open a terminal in your project root (`D:\db-live-diff`) and run the following tests:

### Test 1: Create a New Table
```bash
bun -e "import { Database } from 'bun:sqlite'; const db = new Database('dev.db'); db.run('CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT, content TEXT)');"
```
*On your dashboard, a new `UPDATE` event will generate showing the complete SQL declaration syntax to create the table.*

### Test 2: Modify the Table (Add Columns)
```bash
bun -e "import { Database } from 'bun:sqlite'; const db = new Database('dev.db'); db.run('ALTER TABLE posts ADD COLUMN author_id INTEGER');"
```
*The diff view will show column addition details.*

### Test 3: Add Database Indexes
```bash
bun -e "import { Database } from 'bun:sqlite'; const db = new Database('dev.db'); db.run('CREATE INDEX idx_posts_author ON posts(author_id)');"
```
*Your UI will render the index additions with highlight markers.*

---

## How it Works (Under the Hood)

1. **Introspection Query:** The backend writes the database provider configurations into a temporary schema sandbox (`.temp_diff/current.prisma`).
2. **CLI Engine Hook:** It spawns the Prisma CLI via `child_process.spawnSync` to query the database and pull its metadata (`prisma db pull`).
3. **Empty DB Error Interception:** If the engine returns error `P4001` (indicative of an empty database with no user-defined tables), the code intercepts this state and serves a structural placeholder, keeping the socket alive.
4. **Calculated Migration Diffs:** When a polling cycle detects a mismatch between the current layout and the previous layout on disk, it writes the old schema state to `old.prisma` and runs:
   ```bash
   prisma migrate diff --from-schema-datamodel old.prisma --to-schema-datamodel current.prisma --script
   ```
5. **UI Updates:** The raw programmatic SQL diff strings generated by the CLI call are dispatched directly over Hono WebSockets to the React frontend. The UI processes the raw SQL string line-by-line, dynamically styling line additions and deletions.

---

## License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/AmirHosseinMoloudi/db-live-diff/blob/main/LICENSE) file for details.
