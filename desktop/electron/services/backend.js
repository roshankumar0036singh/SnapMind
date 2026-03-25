const { spawn } = require('child_process');
const path = require('path');

/**
 * Manages the embedded FastAPI backend spawned by Electron
 */
class BackendService {
  constructor() {
    this.status = 'stopped';
    this.process = null;
    this.port = 8000;
  }

  async start(postgresStatus) {
    this.status = 'starting';
    console.log('[BACKEND] Starting embedded FastAPI service...');

    // Determine the path to the python backend
    const backendDir = path.join(__dirname, '..', '..', '..', 'backend');
    
    // We launch via python using uvicorn
    // For a real production build, this would use a PyInstaller bundled executable
    
    return new Promise((resolve) => {
      // Inherit the env but override what we need for Local Mode
      const env = { 
        ...process.env,
        DATABASE_URL: postgresStatus.connectionString || 'postgresql://postgres:snapmind@localhost:5432/snapmind',
        LLM_PROVIDER: 'hybrid' // Tells backend to use Ollama for generation, Gemini for embeddings
      };

      try {
        // Run main:app using the venv python if available, or globally
        // For POC, assuming python is in PATH and packages are installed
        // In realistic desktop deployment, we would use `.venv/Scripts/python` or similar
        const pythonExecutable = 'python';

        this.process = spawn(pythonExecutable, ['-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', this.port.toString()], {
          cwd: backendDir,
          env: env
        });

        this.process.stdout.on('data', (data) => {
          const out = data.toString();
          console.log(`[BACKEND] ${out}`);
          if (out.includes('Application startup complete')) {
            this.status = 'running';
            resolve({ success: true, port: this.port });
          }
        });

        this.process.stderr.on('data', (data) => {
          console.error(`[BACKEND ERR] ${data.toString()}`);
        });

        this.process.on('close', (code) => {
          console.log(`[BACKEND] Process exited with code ${code}`);
          this.status = 'stopped';
        });
        
        // Safety timeout in case we don't catch the "startup complete" string
        setTimeout(() => {
          if (this.status === 'starting') {
            console.log('[BACKEND] Startup timeout hit, assuming running.');
            this.status = 'running';
            resolve({ success: true, port: this.port });
          }
        }, 8000);

      } catch (err) {
        console.error('[BACKEND] Failed to spawn:', err);
        this.status = 'error';
        resolve({ success: false, error: err.message });
      }
    });
  }

  stop() {
    if (this.process) {
      this.process.kill();
      this.status = 'stopped';
    }
  }

  getStatus() {
    return {
      status: this.status,
      port: this.port
    };
  }
}

module.exports = new BackendService();
