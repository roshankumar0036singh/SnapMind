const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Manages the PostgreSQL lifecycle with 3 tiers of fallback:
 * 1. Docker (pgvector)
 * 2. Local PostgreSQL Installation
 * 3. EmbeddedPostgres (Zero Dependency)
 */
class PostgresService {
  constructor() {
    this.status = 'stopped'; // 'stopped', 'starting', 'running', 'error'
    this.activeTier = null; // 'docker', 'local', 'embedded'
    this.port = 5432;
    this.dbName = 'snapmind';
  }

  async start() {
    this.status = 'starting';
    
    // Tier 1: Try Docker
    console.log('[DB] Attempting Tier 1: Docker (pgvector)...');
    try {
      if (await this.startDockerPostgres()) {
        this.activeTier = 'docker';
        this.status = 'running';
        return { success: true, tier: 'docker' };
      }
    } catch (e) {
      console.log('[DB] Docker failed or not installed:', e.message);
    }

    // Tier 2: Try Local DB
    console.log('[DB] Attempting Tier 2: Local PostgreSQL Installation...');
    try {
      if (await this.checkLocalPostgres()) {
        this.activeTier = 'local';
        this.status = 'running';
        return { success: true, tier: 'local' };
      }
    } catch (e) {
      console.log('[DB] Local PostgreSQL failed or not installed:', e.message);
    }

    // Tier 3: Try EmbeddedPostgres (Placeholder logic for setup)
    console.log('[DB] Attempting Tier 3: EmbeddedPostgres (Zero Dependency)...');
    try {
      if (await this.startEmbeddedPostgres()) {
        this.activeTier = 'embedded';
        this.status = 'running';
        return { success: true, tier: 'embedded' };
      }
    } catch (e) {
      console.error('[DB] All database tiers failed.', e.message);
      this.status = 'error';
      return { success: false, error: 'All database tiers failed' };
    }
  }

  async startDockerPostgres() {
    return new Promise((resolve) => {
      // Check if container exists
      exec('docker ps -a --filter "name=snapmind-db" --format "{{.Names}}"', (error, stdout) => {
        if (error) {
          resolve(false); // Docker probably not installed
          return;
        }

        const containerExists = stdout.trim() === 'snapmind-db';

        if (containerExists) {
          // Start existing container
          exec('docker start snapmind-db', (err) => {
            if (err) resolve(false);
            else {
              setTimeout(() => resolve(true), 2000); // Give it time to boot
            }
          });
        } else {
          // Run new container
          const cmd = `docker run -d --name snapmind-db -e POSTGRES_PASSWORD=snapmind -e POSTGRES_DB=${this.dbName} -p ${this.port}:5432 pgvector/pgvector:pg17`;
          exec(cmd, (err) => {
            if (err) resolve(false);
            else {
              console.log('[DB] Started new pgvector container.');
              setTimeout(() => resolve(true), 3000);
            }
          });
        }
      });
    });
  }

  async checkLocalPostgres() {
    // In a real app we'd use 'pg' client to test connection on port 5432
    // For now we check if pg_isready is in PATH
    return new Promise((resolve) => {
      exec(`pg_isready -h localhost -p ${this.port}`, (error, stdout) => {
        if (!error && stdout.includes('accepting connections')) {
          console.log('[DB] Found running local PostgreSQL instance.');
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }

  async startEmbeddedPostgres() {
    // Placeholder for embedded postgres extraction and execution
    // You would bundle binaries for win/mac/linux and child_process.spawn them
    console.log('[DB] Embedded Postgres not yet bundled. Please install Docker or Postgres locally for the POC.');
    // resolve(false);
    return false; // Fail for now until bundled
  }

  getStatus() {
    return {
      status: this.status,
      tier: this.activeTier,
      connectionString: `postgresql://postgres:snapmind@localhost:${this.port}/${this.dbName}`
    };
  }
}

module.exports = new PostgresService();
