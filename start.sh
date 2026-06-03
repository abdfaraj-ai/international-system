#!/bin/bash
set -e
echo "=== Running migrations ==="
python manage.py migrate --noinput
echo "=== Starting Gunicorn on port ${PORT:-8000} ==="
exec gunicorn core.wsgi:application \
    --bind "0.0.0.0:${PORT:-8000}" \
    --workers 2 \
    --timeout 60 \
    --graceful-timeout 30 \
    --keep-alive 5 \
    --log-level info \
    --access-logfile - \
    --error-logfile -
