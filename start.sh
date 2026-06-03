#!/bin/bash
set -e
echo "=== Running migrations ==="
python manage.py migrate --noinput
echo "=== Starting Gunicorn on port ${PORT:-8000} ==="
exec gunicorn core.wsgi:application \
    --bind "0.0.0.0:${PORT:-8000}" \
    --workers 2 \
    --timeout 120 \
    --log-level debug \
    --access-logfile - \
    --error-logfile -
