# JoJo TTRPG Platform

A comprehensive web platform for playing the JoJo's Bizarre Adventure tabletop RPG, featuring character creation, sheet management, and campaign tools.

## 🎯 Features

- **Character Sheet Management**: Full-featured character creation and editing
- **SRD Integration**: Official rule validation and enforcement
- **Multi-tab Support**: Manage multiple characters simultaneously
- **Real-time Validation**: Comprehensive data integrity checking
- **Export/Import**: JSON-based character data portability
- **Responsive Design**: Works on desktop and mobile devices

## 🏗️ Architecture

This is a full-stack web application with:

- **Frontend**: React 19 with modern hooks and context
- **Backend**: Django 5.2 with Django REST Framework
- **Database**: SQLite (development) / PostgreSQL (production)
- **Validation**: Comprehensive client and server-side validation
- **Testing**: Jest (frontend) + Django Test Framework (backend)

## 📁 Project Structure

```
jojo-ttrpg-platform/
├── frontend/                 # React application
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/          # Route components
│   │   ├── utils/          # Utilities and validation
│   │   ├── api/            # API communication layer
│   │   ├── styles/         # CSS styles
│   │   └── tests/          # Frontend tests
│   └── package.json
├── backend/                 # Django API server
│   ├── src/
│   │   ├── app/            # Django project settings
│   │   ├── characters/     # Character management app
│   │   └── manage.py
│   └── requirements.txt
├── docs/                   # Documentation
└── scripts/               # Development scripts
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd jojo-ttrpg-platform
   ```

2. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   ```

3. **Set up backend environment**
   ```bash
   cd ../backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

4. **Initialize database**
   ```bash
   cd src
   python manage.py migrate
   python manage.py loaddata characters/fixtures/*.json
   ```

### Development

1. **Start the backend server**
   ```bash
   cd backend/src
   source ../venv/bin/activate
   python manage.py runserver
   ```

2. **Start the frontend development server**
   ```bash
   cd frontend
   npm start
   ```

3. **Run tests**
   ```bash
   # Frontend tests
   cd frontend && npm test

   # Backend tests
   cd backend/src && python manage.py test
   ```

## 🧪 Testing

- **Frontend**: 31 comprehensive validation tests with 100% pass rate
- **Backend**: 35 Django tests covering models, views, and API endpoints
- **Integration**: End-to-end data flow validation

## 📚 Documentation

- [Character Creation Guide](docs/character-creation.md)
- [API Documentation](docs/api.md)
- [Development Guide](docs/development.md)
- [Deployment Guide](docs/deployment.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Ensure all tests pass: `npm test` and `python manage.py test`
5. Commit your changes: `git commit -am 'Add feature'`
6. Push to the branch: `git push origin feature-name`
7. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎲 About the JoJo TTRPG

This platform implements the official JoJo's Bizarre Adventure tabletop RPG system, including:
- Character creation with heritage system
- Stand abilities and progression
- Coin-based attribute system
- Experience and advancement mechanics
- SRD-compliant rule validation
