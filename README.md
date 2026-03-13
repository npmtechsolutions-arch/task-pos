# ProjectFlow - POS & Project Management System

## Getting Started

You can run this project using Docker (recommended) or locally.

### 1. Quick Start with Docker

This is the easiest way to get everything running (Frontend, Backend, Database, Redis, etc.).

1.  Open a terminal in this directory.
2.  Run the following command:

    ```bash
    docker-compose up -d
    ```

3.  Access the application:
    *   **Frontend**: [http://localhost:3000](http://localhost:3000)
    *   **Backend API**: [http://localhost:8000](http://localhost:8000)
    *   **API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

### 2. Local Development

If you prefer to run services individually:

#### Frontend

1.  Navigate to the app directory:
    ```bash
    cd app
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```
4.  Open [http://localhost:5173](http://localhost:5173) (or the port shown in terminal).

#### Backend

Prerequisites: Python 3.11+, Poetry, PostgreSQL.

1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Install dependencies using Poetry:
    ```bash
    pip install poetry
    poetry install
    ```
3.  Configure environment:
    ```bash
    cp .env.example .env
    # Update .env with your database credentials
    ```
4.  Run the server:
    ```bash
    poetry run uvicorn app.main:app --reload
    ```
5.  Open [http://localhost:8000/docs](http://localhost:8000/docs).

## Documentation

For more details, checking the following files:
*   [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) - Status and features.
*   [TECH_STACK.md](./TECH_STACK.md) - Technology details.
