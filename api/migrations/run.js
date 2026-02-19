/**
 * Database Migration Runner
 * Run database migrations for Nervix
 *
 * @version 1.0.0
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

/**
 * Migration Runner
 */
class MigrationRunner {
  constructor(config = {}) {
    this.pool = new Pool({
      connectionString: config.connectionString || process.env.DATABASE_URL,
    });

    this.migrationsDir = config.migrationsDir || path.join(__dirname, '../migrations');
    this.migrationsTable = config.migrationsTable || 'schema_migrations';
  }

  /**
   * Connect to database
   * @returns {Promise<void>}
   */
  async connect() {
    await this.pool.connect();
    console.log('Connected to database');
  }

  /**
   * Create migrations table if not exists
   * @returns {Promise<void>}
   */
  async createMigrationsTable() {
    const client = await this.pool.connect();

    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${this.migrationsTable} (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          executed_at TIMESTAMP DEFAULT NOW()
        )
      `);
      console.log('Migrations table ready');
    } finally {
      client.release();
    }
  }

  /**
   * Get executed migrations
   * @returns {Promise<Array>} List of migration names
   */
  async getExecutedMigrations() {
    const result = await this.pool.query(
      `SELECT name FROM ${this.migrationsTable} ORDER BY id`
    );
    return result.rows.map(row => row.name);
  }

  /**
   * Get pending migrations
   * @returns {Promise<Array>} List of pending migration files
   */
  async getPendingMigrations() {
    const executed = await this.getExecutedMigrations();

    // Read all migration files
    const files = fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort to ensure correct order

    // Filter out executed migrations
    const pending = files.filter(file => {
      const migrationName = file.replace('.sql', '');
      return !executed.includes(migrationName);
    });

    return pending;
  }

  /**
   * Execute migration
   * @param {string} file - Migration file name
   * @returns {Promise<void>}
   */
  async executeMigration(file) {
    const filePath = path.join(this.migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');
    const migrationName = file.replace('.sql', '');

    console.log(`Executing migration: ${file}`);

    const client = await this.pool.connect();

    try {
      // Start transaction
      await client.query('BEGIN');

      // Execute migration
      await client.query(sql);

      // Record migration
      await client.query(
        `INSERT INTO ${this.migrationsTable} (name) VALUES ($1)`,
        [migrationName]
      );

      // Commit transaction
      await client.query('COMMIT');

      console.log(`Migration completed: ${file}`);
    } catch (error) {
      // Rollback on error
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Run all pending migrations
   * @returns {Promise<void>}
   */
  async migrate() {
    await this.createMigrationsTable();
    const pending = await this.getPendingMigrations();

    if (pending.length === 0) {
      console.log('No pending migrations');
      return;
    }

    console.log(`Running ${pending.length} pending migration(s)...`);

    for (const file of pending) {
      await this.executeMigration(file);
    }

    console.log('All migrations completed successfully');
  }

  /**
   * Rollback last migration
   * @returns {Promise<void>}
   */
  async rollback() {
    const executed = await this.getExecutedMigrations();

    if (executed.length === 0) {
      console.log('No migrations to rollback');
      return;
    }

    const lastMigration = executed[executed.length - 1];
    console.log(`Rolling back migration: ${lastMigration}`);

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      await client.query(
        `DELETE FROM ${this.migrationsTable} WHERE name = $1`,
        [lastMigration]
      );
      await client.query('COMMIT');

      console.log('Rollback completed');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Close database connection
   * @returns {Promise<void>}
   */
  async close() {
    await this.pool.end();
    console.log('Database connection closed');
  }
}

// Run migrations if executed directly
if (require.main === module) {
  const runner = new MigrationRunner();

  const command = process.argv[2];

  (async () => {
    try {
      await runner.connect();

      if (command === 'migrate') {
        await runner.migrate();
      } else if (command === 'rollback') {
        await runner.rollback();
      } else if (command === 'status') {
        const pending = await runner.getPendingMigrations();
        console.log(`Pending migrations: ${pending.length}`);
        console.log(pending);
      } else {
        console.log('Usage: node run.js [migrate|rollback|status]');
      }
    } catch (error) {
      console.error('Migration error:', error);
      process.exit(1);
    } finally {
      await runner.close();
    }
  })();
}

module.exports = MigrationRunner;
