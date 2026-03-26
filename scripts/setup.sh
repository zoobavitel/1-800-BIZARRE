#!/bin/bash
# Development setup script. See docs/codebase/scripts.md#setupsh.

set -e

echo "🎲 Setting up JoJo TTRPG Platform..."

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "❌ Python 3 is required but not installed. Aborting." >&2; exit 1; }
command -v git >/dev/null 2>&1 || { echo "❌ Git is required but not installed. Aborting." >&2; exit 1; }

echo "✅ Prerequisites check passed"

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Setup backend virtual environment
echo "🐍 Setting up Python virtual environment..."
cd backend
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Setup database
echo "🗄️  Setting up database..."
cd src
python manage.py migrate
python manage.py loaddata characters/fixtures/*.json

echo "✅ Database setup complete"

cd ../..

# Create environment files
if [ ! -f backend/.env ]; then
    echo "📝 Creating backend environment file..."
    cp backend/.env.example backend/.env
    echo "⚠️  Please edit backend/.env with your configuration"
fi

echo "🎉 Setup complete!"
echo ""
echo "To start development:"
echo "  npm run dev"
echo ""
echo "To run tests:"
echo "  npm test"
echo ""
echo "Happy coding! 🚀"
