#!/bin/bash
set -e
echo "=== Running migrations ==="
python manage.py migrate --noinput
echo "=== Ensuring admin user ==="
python manage.py ensure_admin || true
echo "=== Starting Daphne on port ${PORT:-8000} ==="
exec daphne -b 0.0.0.0 -p ${PORT:-8000} core.asgi:application
