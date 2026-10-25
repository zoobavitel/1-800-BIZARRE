from datetime import timedelta
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
]

# Application definition
INSTALLED_APPS = [
    # Old DRF token table: kept so migrations can empty it. Nothing reads it.
    'rest_framework.authtoken',
    'knox',
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
    'app.private_network.PrivateNetworkAccessMiddleware',
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
        # Concurrent sheet PATCH + apply-level-up must wait, not fail-fast lock.
        'OPTIONS': {
            'timeout': 20,
        },
    }
}

# CI runs the tests on Postgres, the same engine as prod (settings_prod.py),
# so row locks and transaction behaviour are tested for real. Set
# DB_ENGINE=postgresql (plus DB_NAME/DB_USER/DB_PASSWORD/DB_HOST/DB_PORT) to
# do the same locally. Needs psycopg2 (backend/requirements-prod.txt).
if os.environ.get('DB_ENGINE') == 'postgresql':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('DB_NAME', 'bizarre'),
            'USER': os.environ.get('DB_USER', 'postgres'),
            'PASSWORD': os.environ.get('DB_PASSWORD', ''),
            'HOST': os.environ.get('DB_HOST', 'localhost'),
            'PORT': os.environ.get('DB_PORT', '5432'),
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
MEDIA_ROOT = os.environ.get('MEDIA_ROOT', os.path.join(BASE_DIR, 'media'))


# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Django REST Framework config
REST_FRAMEWORK = {
    # Token auth first: a rejected or missing token gets 401 (with a
    # WWW-Authenticate header), so the frontend can send the user to sign in.
    # With session auth first, DRF answers 403 instead.
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'knox.auth.TokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'EXCEPTION_HANDLER': 'app.api_exceptions.custom_exception_handler',
}

# Login tokens (django-rest-knox). One token per sign-in, stored hashed.
# A token lasts 30 days from its last use: each request pushes the expiry out
# again, at most one DB write per minute per token.
REST_KNOX = {
    'TOKEN_TTL': timedelta(days=30),
    'AUTO_REFRESH': True,
    'MIN_REFRESH_INTERVAL': 60,
    'AUTH_HEADER_PREFIX': 'Token',
    'TOKEN_LIMIT_PER_USER': None,
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
    "http://127.0.0.1:3000",
    "http://192.168.1.251:3000",  # Add your real LAN IP here if needed
    "https://zoobavitel.github.io",  # GitHub Pages frontend
]

CORS_ALLOW_CREDENTIALS = True

CORS_ALLOW_HEADERS = list(default_headers) + [
    'authorization',
]

# Dev-only: allow all origins (optional fallback, comment out in production)
# CORS_ALLOW_ALL_ORIGINS = True

# Bound campaign SSE so gthread workers can recycle / drain. EventSource reconnects.
SSE_STREAM_MAX_SECONDS = float(os.environ.get("SSE_STREAM_MAX_SECONDS", "45"))
SSE_HEARTBEAT_SECONDS = float(os.environ.get("SSE_HEARTBEAT_SECONDS", "15"))
SSE_CLIENT_RETRY_MS = int(os.environ.get("SSE_CLIENT_RETRY_MS", "2000"))
# Live SSE streams one user may hold per campaign; older ones end (frees threads).
SSE_MAX_STREAMS_PER_USER = int(os.environ.get("SSE_MAX_STREAMS_PER_USER", "4"))
SSE_SLOT_CHECK_SECONDS = float(os.environ.get("SSE_SLOT_CHECK_SECONDS", "5"))
# Live default. Perf sets perf:bizarre:campaign: so pub/sub cannot hit real campaigns.
REALTIME_CHANNEL_PREFIX = os.environ.get(
    "REALTIME_CHANNEL_PREFIX", "bizarre:campaign:"
)

# Celery (used when worker runs; dev uses eager mode — see CELERY_TASK_ALWAYS_EAGER)
CELERY_BROKER_URL = os.environ.get("REDIS_URL", "redis://127.0.0.1:6379/0")
CELERY_RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", CELERY_BROKER_URL)
# SSE pub/sub. Defaults to the broker so existing env files keep working.
# Point this at Redis when the broker moves off Redis.
REALTIME_REDIS_URL = os.environ.get("REALTIME_REDIS_URL", CELERY_BROKER_URL)
CELERY_TASK_ALWAYS_EAGER = os.environ.get("CELERY_TASK_ALWAYS_EAGER", "true").lower() == "true"
CELERY_TASK_EAGER_PROPAGATES = True
