#!/bin/bash

# Simple HTTP server for the garden app
cd "$(dirname "$0")"
echo "Starting local web server for My Garden app..."
echo "Access at: http://localhost:8000"
echo "Press Ctrl+C to stop"

# Try different Python versions if available
if command -v python3 &> /dev/null; then
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    python -m SimpleHTTPServer 8000
else
    echo "No Python found. Please install Python to run the server."
    echo "Alternatively, open index.html directly in your browser."
fi