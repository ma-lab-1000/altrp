#!/bin/sh
set -e

echo "🚀 Starting application..."

# Run migrations if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
  echo "📋 Running database migrations..."
  node scripts/migrate-postgres.mjs || {
    echo "❌ Migration failed!"
    exit 1
  }
  echo "✅ Migrations completed"
else
  echo "⚠️  DATABASE_URL not set, skipping migrations"
fi

# Start the application
echo "🚀 Starting Next.js application..."
exec npm start

