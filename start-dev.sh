#!/bin/bash

# Start development environment
# Run this script to start both backend and frontend in separate tmux panes

echo "🚀 Starting SAK WhatsApp API Development Environment"

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo "❌ tmux is not installed. Installing separate terminals..."
    
    # Start backend
    echo "Starting backend on port 5000..."
    gnome-terminal -- bash -c "cd $(pwd) && npm run dev; exec bash" 2>/dev/null || \
    xterm -e "cd $(pwd) && npm run dev" 2>/dev/null || \
    osascript -e 'tell app "Terminal" to do script "cd $(pwd) && npm run dev"' 2>/dev/null || \
    (echo "Starting backend..." && npm run dev &)
    
    # Wait a bit
    sleep 2
    
    # Start frontend
    echo "Starting frontend on port 3000..."
    gnome-terminal -- bash -c "cd $(pwd)/frontend && npm run dev; exec bash" 2>/dev/null || \
    xterm -e "cd $(pwd)/frontend && npm run dev" 2>/dev/null || \
    osascript -e 'tell app "Terminal" to do script "cd $(pwd)/frontend && npm run dev"' 2>/dev/null || \
    (cd frontend && npm run dev &)
    
    echo "✅ Services started!"
    echo "📱 Frontend: http://localhost:3000"
    echo "🔌 Backend: http://localhost:5000"
    exit 0
fi

# Create new tmux session
SESSION_NAME="sak-whatsapp-api"

# Kill existing session if it exists
tmux kill-session -t $SESSION_NAME 2>/dev/null

# Create new session with backend
tmux new-session -d -s $SESSION_NAME -n backend

# Start backend in first pane
tmux send-keys -t $SESSION_NAME:backend "npm run dev" C-m

# Create new window for frontend
tmux new-window -t $SESSION_NAME -n frontend

# Start frontend in second window
tmux send-keys -t $SESSION_NAME:frontend "cd frontend && npm run dev" C-m

# Split window for logs
tmux split-window -t $SESSION_NAME:backend -h
tmux send-keys -t $SESSION_NAME:backend.right "tail -f logs/combined.log" C-m

# Attach to session
echo "✅ Development environment started!"
echo "📱 Frontend: http://localhost:3000"
echo "🔌 Backend: http://localhost:5000"
echo ""
echo "💡 Tmux commands:"
echo "   Ctrl+B then D - Detach from session"
echo "   Ctrl+B then [ - Scroll mode (Q to exit)"
echo "   Ctrl+B then C - Create new window"
echo "   tmux attach -t $SESSION_NAME - Reattach"
echo ""
sleep 2
tmux attach -t $SESSION_NAME
