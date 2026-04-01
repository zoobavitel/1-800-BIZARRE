from pathlib import Path
import os
from corsheaders.defaults import default_headers

# BASE_DIR path setup
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key secret in production!
SECRET_KEY = 'django-insecure-z*vp)!q(k+c-$#(vy8ws-h4=+d$r)q89x)ru(o_3yhr=+8lo3)'

DEBUG = True

ALLOWED_HOSTS = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '.ngrok-free.app',   # ngrok free tier (e.g. xxx.ngrok-free.app)
    '.ngrok-free.dev',   # ngrok free tier (e.g. xxx.ngrok-free.dev)
]

# Application definition
INSTALLED_APPS = [
    'rest_framework.authtoken',
    'characters',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party apps
    'rest_framework',
    'corsheaders',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # must be at top
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'app.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'app.wsgi.application'

# Database setup
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')


# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Django REST Framework config
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'EXCEPTION_HANDLER': 'app.api_exceptions.custom_exception_handler',
}

# Logging for development
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {'format': '[{levelname}] {asctime} {name} - {message}', 'style': '{'},
        'simple': {'format': '[{levelname}] {message}', 'style': '{'},
    },
    'handlers': {
        'console': {'class': 'logging.StreamHandler', 'formatter': 'simple'},
        'file': {
            'level': 'DEBUG',
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'debug.log',
            'formatter': 'verbose',
        },
    },
    'root': {'handlers': ['console', 'file'], 'level': 'DEBUG'},
}

# 🔐 CORS settings
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://192.168.1.251:3000",  # Add your real LAN IP here if needed
    "https://zoobavitel.github.io",  # GitHub Pages frontend
]

CORS_ALLOW_CREDENTIALS = True

CORS_ALLOW_HEADERS = list(default_headers) + [
    'authorization',
    'ngrok-skip-browser-warning',  # required for ngrok free tier API calls
]

# Dev-only: allow all origins (optional fallback, comment out in production)
# CORS_ALLOW_ALL_ORIGINS = True

# Celery (used when worker runs; dev uses eager mode — see CELERY_TASK_ALWAYS_EAGER)
CELERY_BROKER_URL = os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/0")
CELERY_RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", CELERY_BROKER_URL)
CELERY_TASK_ALWAYS_EAGER = os.environ.get("CELERY_TASK_ALWAYS_EAGER", "true").lower() == "true"
CELERY_TASK_EAGER_PROPAGATES = True
