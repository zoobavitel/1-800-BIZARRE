# Production deployment script
#!/bin/bash

echo "🚀 Starting production deployment..."

# Check if environment variables are set
if [ -z "$SECRET_KEY" ]; then
    echo "❌ SECRET_KEY environment variable is not set"
    exit 1
fi

if [ -z "$DB_PASSWORD" ]; then
    echo "❌ DB_PASSWORD environment variable is not set"
    exit 1
fi

echo "✅ Environment variables validated"

# Set production settings
export DJANGO_SETTINGS_MODULE=app.settings_prod

# Install dependencies
echo "📦 Installing Python dependencies..."
cd backend
pip install -r requirements-prod.txt

# Database operations
echo "🗄️ Running database migrations..."
cd src
python manage.py migrate

# Collect static files
echo "📁 Collecting static files..."
python manage.py collectstatic --noinput

# Create superuser if it doesn't exist
echo "👤 Creating superuser..."
python manage.py shell -c "
from django.contrib.auth.models import User
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', 'admin@example.com', 'admin_password_change_me')
    print('Superuser created')
else:
    print('Superuser already exists')
"

# Run tests
echo "🧪 Running tests..."
python manage.py test

# Start production server
echo "🌐 Starting production server..."
# Use gunicorn for production
gunicorn app.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 120

echo "✅ Deployment complete!"
