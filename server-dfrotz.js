#!/usr/bin/env node

/**
 * Z-Machine API Server
 * REST API for playing Z-machine interactive fiction games
 * Uses dfrotz as the Z-machine interpreter
 */

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// In-memory game sessions
const sessions = new Map();

// Default game path
const DEFAULT_GAME = process.env.DEFAULT_GAME || path.join(__dirname, 'games', 'zork1.zip');

// Z-Machine session using dfrotz subprocess
class DFrotzSession {
  constructor(gamePath) {
    this.gamePath = gamePath;
    this.proc = null;
    this.outputBuffer = '';
    this.inputBuffer = '';
    this.ready = false;
  }

  start() {
    return new Promise((resolve, reject) => {
      // Start dfrotz as a subprocess
      this.proc = spawn('dfrotz', [
        '-p',           // Plain ASCII output only
        '-m',           // Turn off MORE prompts
        '-x',           // Expand abbreviations
        this.gamePath
      ], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let startupOutput = '';

      // Collect initial output
      this.proc.stdout.on('data', (data) => {
        const text = data.toString();
        startupOutput += text;
        
        // Look for the first prompt or game header
        if (startupOutput.includes('>') || startupOutput.includes('ZORK')) {
          this.ready = true;
          this.outputBuffer = startupOutput;
          resolve(this.outputBuffer);
        }
      });

      this.proc.stderr.on('data', (data) => {
        console.error('dfrotz stderr:', data.toString());
      });

      this.proc.on('error', (err) => {
        reject(new Error(`Failed to start dfrotz: ${err.message}`));
      });

      this.proc.on('close', (code) => {
        if (code !== 0 && code !== null) {
          console.log(`dfrotz exited with code ${code}`);
        }
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!this.ready) {
          this.ready = true;
          this.outputBuffer = startupOutput || startupOutput;
          resolve(this.outputBuffer);
        }
      }, 10000);
    });
  }

  sendCommand(command) {
    return new Promise((resolve, reject) => {
      if (!this.proc || this.proc.killed) {
        return reject(new Error('Process not running'));
      }

      const fullCommand = command + '\n';
      
      this.proc.stdin.write(fullCommand);
      
      // Collect output
      let output = '';
      const collectOutput = (data) => {
        output += data.toString();
      };

      this.proc.stdout.on('data', collectOutput);

      // Wait a bit for output, then resolve
      setTimeout(() => {
        this.proc.stdout.removeListener('data', collectOutput);
        
        // Clean up the output
        output = output.replace(/^[^\n]*\n/, ''); // Remove echo of command
        
        this.outputBuffer = output;
        resolve(output);
      }, 100);
    });
  }

  cleanup() {
    if (this.proc) {
      this.proc.stdin.end();
      this.proc.kill();
      this.proc = null;
    }
  }
}

// Helper functions
function loadGame(gamePath) {
  const fullPath = path.resolve(gamePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Game file not found: ${fullPath}`);
  }
  return { fullPath };
}

// API Endpoints

// List available games
app.get('/api/games', (req, res) => {
  const gamesDir = path.join(__dirname, 'games');
  const games = [];

  if (fs.existsSync(gamesDir)) {
    const files = fs.readdirSync(gamesDir);
    for (const file of files) {
      if (file.endsWith('.z1') || file.endsWith('.z2') || file.endsWith('.z3') ||
          file.endsWith('.z4') || file.endsWith('.z5') || file.endsWith('.z6') ||
          file.endsWith('.z7') || file.endsWith('.z8') || file.endsWith('.zip')) {
        games.push({
          name: file,
          path: `/games/${file}`
        });
      }
    }
  }

  res.json({ games });
});

// Start a new game session
app.post('/api/sessions', async (req, res) => {
  const { gamePath } = req.body || {};
  const sessionId = crypto.randomUUID();

  try {
    const actualPath = gamePath || DEFAULT_GAME;
    const { fullPath } = loadGame(actualPath);
    
    const session = {
      gamePath: fullPath,
      createdAt: new Date().toISOString()
    };

    // Start the dfrotz session
    const frotzSession = new DFrotzSession(fullPath);
    const output = await frotzSession.start();
    
    session.frotz = frotzSession;
    sessions.set(sessionId, session);

    res.json({
      sessionId,
      output: output,
      gamePath: fullPath
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Send input to a game session
app.post('/api/sessions/:sessionId/input', async (req, res) => {
  const { sessionId } = req.params;
  const { command } = req.body || {};

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    const output = await session.frotz.sendCommand(command);
    res.json({
      sessionId,
      command,
      output
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get session info
app.get('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json({
    sessionId,
    gamePath: session.gamePath,
    createdAt: session.createdAt
  });
});

// Get current output
app.get('/api/sessions/:sessionId/output', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json({
    sessionId,
    output: session.frotz.outputBuffer || ''
  });
});

// Delete a session
app.delete('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  if (sessions.has(sessionId)) {
    const session = sessions.get(sessionId);
    if (session.frotz) {
      session.frotz.cleanup();
    }
    sessions.delete(sessionId);
    res.json({ success: true, message: 'Session deleted' });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Z-Machine API server running on port ${PORT}`);
  console.log(`Game files: ${path.join(__dirname, 'games')}`);
  console.log(`Default: ${DEFAULT_GAME}`);
  console.log('');
  console.log('Using dfrotz for Z-machine interpretation.');
  console.log('Sessions are isolated subprocesses.');
});
