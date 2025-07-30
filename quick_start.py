#!/usr/bin/env python3
"""
Quick start script for the Anomaly Detection App
This script starts the Flask backend in bootstrap mode for easy testing
"""

import os
import sys
import subprocess

# Add the project root to Python path
project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)

# Set minimal environment variables
os.environ['FLASK_APP'] = 'backend.app'
os.environ['FLASK_ENV'] = 'development'
os.environ['FLASK_DEBUG'] = '1'

# Disable OpenAI requirement for bootstrap mode
os.environ['OPENAI_API_KEY'] = 'dummy-key-for-bootstrap'

print("🚀 Starting Anomaly Detection App in Bootstrap Mode...")
print("📊 This mode uses minimal dependencies and sample data")
print("")

# Get the external IP address
import socket
hostname = socket.gethostname()
try:
    external_ip = socket.gethostbyname(hostname)
except:
    external_ip = '0.0.0.0'

print(f"🌐 Access the app at: http://{external_ip}:8200")
print(f"   - Frontend: http://{external_ip}:8200")
print(f"   - API Health: http://{external_ip}:8200/api/health")
print(f"   - Videos API: http://{external_ip}:8200/api/videos")
print("")
print("Press Ctrl+C to stop the server")
print("")

# Import and run the Flask app
from backend.app import app, bootstrap_initialize_app

# Initialize in bootstrap mode
bootstrap_initialize_app()

# Run the app on external IP and port 8200
app.run(host='0.0.0.0', port=8200, debug=True)