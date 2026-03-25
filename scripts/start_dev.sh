#!/bin/bash

# Get the absolute path of the project root directory
PROJECT_ROOT=$(git rev-parse --show-toplevel)

echo "Starting the development environment..."

# Activate virtual environment
echo "Activating Python virtual environment..."
source ~/.virtualenvs/jojo/bin/activate

# Start backend server in the background
echo "Starting Django backend server..."
cd "$PROJECT_ROOT/backend/src"
python manage.py runserver &
BACKEND_PID=$!
echo "Backend server started with PID: $BACKEND_PID"

# Start frontend server in the background
echo "Starting React frontend server..."
cd "$PROJECT_ROOT/frontend"
npm run start &
FRONTEND_PID=$!
echo "Frontend server started with PID: $FRONTEND_PID"

echo ""
echo "----------------------------------------"
echo "Development servers are starting up."
echo "Backend (Django) on: http://127.0.0.1:8000"
echo "Frontend (React) on: http://localhost:3000"
echo "----------------------------------------"

# Store the PIDs in a file to make them easy to kill later
echo $BACKEND_PID > "$PROJECT_ROOT/.dev_pids"
echo $FRONTEND_PID >> "$PROJECT_ROOT/.dev_pids"
echo "To stop both servers, run: kill $(cat $PROJECT_ROOT/.dev_pids)"
