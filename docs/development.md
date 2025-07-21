# Development Guide

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- Git

### Development Environment Setup

1. **Clone and install dependencies**
   ```bash
   git clone <repo-url>
   cd 1-800-BIZARRE
   npm run install:all
   ```

2. **Backend setup**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   # OR venv\Scripts\activate  # Windows
   pip install -r requirements.txt
   cd src && python manage.py migrate
   python manage.py loaddata characters/fixtures/*.json
   ```

3. **Start development servers**
   ```bash
   # From root directory
   npm run dev
   ```

## Project Architecture

### Frontend (React)
```
frontend/src/
├── components/          # Reusable UI components
│   ├── character/      # Character-specific components
│   └── shared/         # Shared UI components
├── pages/              # Route components
├── utils/              # Utility functions
├── api/                # API communication
├── styles/             # CSS styles
└── tests/              # Jest tests
```

### Backend (Django)
```
backend/src/
├── app/                # Django project configuration
├── characters/         # Character management app
│   ├── models.py      # Data models
│   ├── views.py       # API views
│   ├── serializers.py # Data serialization
│   ├── tests.py       # Django tests
│   └── fixtures/      # Test data
└── manage.py          # Django management
```

## Development Workflow

### Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow existing code style
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   npm test  # Runs both frontend and backend tests
   ```

4. **Commit and push**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   git push origin feature/your-feature-name
   ```

### Code Style Guidelines

- **JavaScript/React**: Use ESLint configuration
- **Python/Django**: Follow PEP 8
- **File naming**: Use camelCase for JS, snake_case for Python
- **Component naming**: PascalCase for React components

### Testing

- **Frontend**: Jest with React Testing Library
- **Backend**: Django TestCase
- **Integration**: API endpoint testing

## Common Development Tasks

### Adding a New Component

1. Create component file in appropriate directory
2. Add corresponding test file
3. Export from index files if using barrel exports
4. Document component props and usage

### Adding API Endpoints

1. Define model in `models.py`
2. Create serializer in `serializers.py`
3. Add view in `views.py`
4. Register URL in `urls.py`
5. Add tests in `tests.py`

### Database Changes

1. Modify models in `models.py`
2. Create migration: `python manage.py makemigrations`
3. Apply migration: `python manage.py migrate`
4. Update fixtures if needed

## Debugging

### Frontend
- Use React Developer Tools
- Check browser console for errors
- Use debugger statements or `console.log`

### Backend
- Check Django debug output
- Use `pdb` for Python debugging
- Review `debug.log` for application logs

### Common Issues

- **CORS errors**: Check `django-cors-headers` configuration
- **404 on refresh**: Configure React Router properly
- **Database locked**: Close other database connections

## Performance Considerations

- Use React.memo for expensive components
- Implement proper key props for lists
- Debounce user input
- Use Django select_related/prefetch_related
- Monitor bundle size with `npm run build`
