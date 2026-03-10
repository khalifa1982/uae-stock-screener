#!/bin/sh
set -e

echo "Running database migrations..."
npx drizzle-kit push --force 2>&1 || echo "Migration warning (may be first run)"

echo "Starting application..."
exec node dist/index.js
