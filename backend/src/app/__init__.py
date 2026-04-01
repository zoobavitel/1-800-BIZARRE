try:
    from .celery import app as celery_app
except ImportError:
    celery_app = None  # celery/redis not installed (dev-only requirements.txt)

__all__ = ("celery_app",)
