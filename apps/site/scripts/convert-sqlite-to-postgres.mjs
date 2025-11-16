#!/usr/bin/env node

/**
 * Converts SQLite SQL syntax to PostgreSQL syntax
 * Used for converting migration files on-the-fly
 */

export function convertSqliteToPostgres(sql) {
  let converted = sql;

  // Convert table names from backticks to double quotes (PostgreSQL style)
  converted = converted.replace(/`([^`]+)`/g, '"$1"');

  // Convert INTEGER PRIMARY KEY to SERIAL PRIMARY KEY or BIGSERIAL
  // But only for auto-increment primary keys
  converted = converted.replace(
    /(\w+)\s+integer\s+PRIMARY\s+KEY\s+(?:NOT\s+NULL\s+)?AUTOINCREMENT/gi,
    '$1 BIGSERIAL PRIMARY KEY'
  );

  // Convert INTEGER PRIMARY KEY NOT NULL to BIGSERIAL PRIMARY KEY
  converted = converted.replace(
    /(\w+)\s+integer\s+PRIMARY\s+KEY\s+NOT\s+NULL/gi,
    '$1 BIGSERIAL PRIMARY KEY'
  );

  // Convert INTEGER PRIMARY KEY to BIGINT PRIMARY KEY (for non-auto-increment)
  converted = converted.replace(
    /(\w+)\s+integer\s+PRIMARY\s+KEY(?!\s+(?:NOT\s+NULL\s+)?AUTOINCREMENT)/gi,
    '$1 BIGINT PRIMARY KEY'
  );

  // Convert INTEGER to BIGINT (for foreign keys and regular integers)
  converted = converted.replace(/\binteger\b/gi, 'BIGINT');

  // Convert TEXT to TEXT (same in PostgreSQL, but ensure it's explicit)
  // TEXT is already compatible

  // Convert NUMERIC to NUMERIC (same, but PostgreSQL uses DECIMAL/NUMERIC)
  // Keep as NUMERIC

  // Convert strftime to PostgreSQL NOW()
  converted = converted.replace(
    /strftime\('%Y-%m-%dT%H:%M:%fZ',\s*'now'\)/gi,
    "NOW()"
  );

  // Convert DEFAULT (strftime(...)) to DEFAULT NOW()
  converted = converted.replace(
    /DEFAULT\s*\(strftime\([^)]+\)\)/gi,
    'DEFAULT NOW()'
  );

  // Convert integer DEFAULT true/false to boolean DEFAULT true/false
  converted = converted.replace(
    /(\w+)\s+integer\s+DEFAULT\s+(true|false)/gi,
    '$1 BOOLEAN DEFAULT $2'
  );

  // Convert integer DEFAULT 0/1 to boolean for is_* columns
  converted = converted.replace(
    /(is_\w+)\s+integer\s+DEFAULT\s+([01])/gi,
    (match, column, value) => {
      return `${column} BOOLEAN DEFAULT ${value === '1' ? 'true' : 'false'}`;
    }
  );

  // Convert integer DEFAULT true/false (without space) to boolean
  converted = converted.replace(
    /(\w+)\s+integer\s+DEFAULT\s+(true|false)(\s|,|\))/gi,
    '$1 BOOLEAN DEFAULT $2$3'
  );

  // Convert integer columns that are clearly boolean (is_*, has_*, can_*, etc.) to boolean
  converted = converted.replace(
    /(is_\w+|has_\w+|can_\w+)\s+integer(\s+(?:NOT\s+NULL\s+)?DEFAULT\s+(?:true|false|0|1))?/gi,
    (match, column, defaultValue) => {
      if (defaultValue) {
        const boolValue = defaultValue.includes('true') || defaultValue.includes('1') ? 'true' : 'false';
        return `${column} BOOLEAN${defaultValue.replace(/integer/i, '').replace(/0|1/g, boolValue)}`;
      }
      return `${column} BOOLEAN`;
    }
  );

  // Convert CREATE TABLE IF NOT EXISTS (PostgreSQL supports this)
  // Keep as is

  // Convert AUTOINCREMENT (already handled above)
  
  // Convert CREATE INDEX syntax (PostgreSQL uses same syntax but with quotes)
  // Already handled by backtick conversion

  // Convert UNIQUE INDEX to CREATE UNIQUE INDEX (PostgreSQL syntax)
  // Already compatible

  // Convert ALTER TABLE syntax
  // PostgreSQL uses similar syntax

  // Convert DROP COLUMN syntax
  // PostgreSQL uses same syntax

  // Convert ADD COLUMN syntax  
  // PostgreSQL uses same syntax but may need type conversion
  converted = converted.replace(
    /ALTER\s+TABLE\s+"?(\w+)"?\s+ADD\s+"?(\w+)"?\s+integer\s+DEFAULT\s+(true|false)/gi,
    'ALTER TABLE "$1" ADD "$2" BOOLEAN DEFAULT $3'
  );

  // Handle numeric types - keep as NUMERIC in PostgreSQL
  // NUMERIC is compatible

  // Remove SQLite-specific syntax
  // Most common SQLite features are handled above

  return converted;
}

// If run directly, convert stdin to stdout
if (import.meta.url === `file://${process.argv[1]}`) {
  const fs = await import('fs');
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    // Read from stdin
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      input += chunk;
    });
    process.stdin.on('end', () => {
      const converted = convertSqliteToPostgres(input);
      process.stdout.write(converted);
    });
  } else {
    // Read from file
    const filePath = args[0];
    const sql = fs.readFileSync(filePath, 'utf8');
    const converted = convertSqliteToPostgres(sql);
    
    if (args[1]) {
      // Write to output file
      fs.writeFileSync(args[1], converted, 'utf8');
    } else {
      // Write to stdout
      process.stdout.write(converted);
    }
  }
}

