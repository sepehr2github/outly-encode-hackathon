#!/bin/bash

echo "🌙 Starting outly Bedtime Stories..."
echo ""

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "⚠️  Node.js version is $NODE_VERSION. Version 18+ is recommended."
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env with your API keys before continuing."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ] || [ ! -d "client/node_modules" ] || [ ! -d "server/node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm run install:all
    echo ""
fi

echo "✅ Dependencies installed"
echo "✅ Environment configured"
echo ""
echo "🚀 Starting servers..."
echo "   - Server: http://localhost:3000"
echo "   - Client: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start the app
npm run dev

