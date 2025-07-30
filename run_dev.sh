#!/bin/bash

# Development server runner script

echo "🚀 Starting Anomaly Detection App Development Server..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Creating one..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies if needed
if ! python -c "import flask" 2>/dev/null; then
    echo "📦 Installing dependencies..."
    pip install -r requirements.txt
fi

# Set environment variables
export FLASK_APP=backend/app.py
export FLASK_ENV=development
export FLASK_DEBUG=1

# Check if Redis is available (optional)
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        echo "✅ Redis is running"
    else
        echo "⚠️  Redis is not running. Caching will fall back to simple mode."
    fi
else
    echo "⚠️  Redis not installed. Caching will fall back to simple mode."
fi

# Get external IP
EXTERNAL_IP=$(hostname -I | awk '{print $1}')
if [ -z "$EXTERNAL_IP" ]; then
    EXTERNAL_IP="0.0.0.0"
fi

echo "📊 Starting Flask backend on http://$EXTERNAL_IP:8200"
echo "🌐 Frontend will be served from http://$EXTERNAL_IP:8200"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Run the Flask app (uses port 8200 from config)
python backend/app.py