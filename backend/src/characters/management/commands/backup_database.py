import os
import subprocess
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = 'Create a timestamped database backup (SQLite or PostgreSQL per DJANGO_SETTINGS_MODULE).'

    def handle(self, *args, **options):
        repo_root = Path(__file__).resolve().parents[5]
        script = repo_root / 'scripts' / 'backup-database.sh'
        if not script.is_file():
            raise CommandError(f'Backup script not found: {script}')

        env = os.environ.copy()
        proc = subprocess.run(
            ['/usr/bin/env', 'bash', str(script)],
            cwd=str(repo_root),
            env=env,
        )
        if proc.returncode != 0:
            raise CommandError('Database backup failed.')
