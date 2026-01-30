/**
 * Z-Machine API Server
 * REST API for playing Z-machine interactive fiction games
 * Uses ebozz Z-machine interpreter
 */

import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Game from 'ebozz/dist/ebozz.js';
import Log from 'ebozz/dist/log.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// In-memory game sessions
const sessions = new Map();

// Default game path
const DEFAULT_GAME = process.env.DEFAULT_GAME || path.join(__dirname, 'games', 'zork1.zip');

// Simple screen implementation that captures output
class APIScreen extends (await import('ebozz/dist/Screen.js').then(m => m.ScreenBase || m.default || m)) {
  constructor(log) {
    super(log, 'APIScreen');
    this.output = '';
  }

  print(_game, str) {
    this.output += str;
  }

  getInputFromUser(game, input_state) {
    // Store the input state for later use
    this.pendingInputState = input_state;
    this.gameInstance = game;
    
    // Check if we have queued input
    if (this.inputQueue && this.inputQueue.length > 0) {
      const input = this.inputQueue.shift();
      this.log.debug(`API: Processing queued input: "${input}"`);
      game.continueAfterUserInput(input_state, input);
      return input;
    }
    
    // No input yet - will be provided via setPendingInput
    this.log.debug('API: Waiting for input...');
    return '';
  }

  setPendingInput(input) {
    if (this.pendingInputState && this.gameInstance) {
      this.log.debug(`API: Processing pending input: "${input}"`);
      this.gameInstance.continueAfterUserInput(this.pendingInputState, input);
      this.pendingInputState = null;
    } else {
      // Queue it for when input_state is available
      if (!this.inputQueue) this.inputQueue = [];
      this.inputQueue.push(input);
    }
  }
}

class ZMachineSession {
  constructor(gameData, gamePath) {
    this.gamePath = gamePath;
    this.log = new Log(false);
    this.screen = new APIScreen(this.log);
    this.game = new Game(gameData, this.log, this.screen, null);
    this.createdAt = new Date().toISOString();
    this.started = false;
    this.executing = false;
  }

  start() {
    if (this.started) return this.screen.output;
    
    this.started = true;
    this.executing = true;
    
    try {
      this.game.execute();
    } catch (e) {
      if (e.constructor.name !== 'SuspendForUserInput') {
        this.log.error(`Game execution error: ${e.message}`);
      }
    }
    this.executing = false;
    
    return this.screen.output;
  }

  sendCommand(command) {
    this.screen.output = '';
    this.screen.setPendingInput(command);
    
    if (!this.executing) {
      this.executing = true;
      try {
        this.game.executeLoop();
      } catch (e) {
        if (e.constructor.name !== 'SuspendForUserInput') {
          this.log.error(`Game execution error: ${e.message}`);
        }
      }
      this.executing = false;
    }
    
    return this.screen.output;
  }

  getInfo() {
    return {
      gamePath: this.gamePath,
      createdAt: this.createdAt
    };
  }
}

function loadGame(gamePath) {
  const fullPath = path.resolve(gamePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Game file not found: ${fullPath}`);
  }
  const gameData = fs.readFileSync(fullPath);
  return { gameData, fullPath };
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
app.post('/api/sessions', (req, res) => {
  const { gamePath } = req.body || {};
  const sessionId = crypto.randomUUID();

  try {
    const actualPath = gamePath || DEFAULT_GAME;
    const { gameData, fullPath } = loadGame(actualPath);
    const session = new ZMachineSession(gameData, fullPath);
    const output = session.start();

    sessions.set(sessionId, session);

    res.json({
      sessionId,
      output: output,
      gamePath: fullPath
    });
  } catch (error) {
    res.status(400).json({ error: error.message, stack: error.stack });
  }
});

// Send input to a game session
app.post('/api/sessions/:sessionId/input', (req, res) => {
  const { sessionId } = req.params;
  const { command } = req.body || {};

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    const output = session.sendCommand(command);
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
    ...session.getInfo()
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
    output: session.screen.output || ''
  });
});

// Delete a session
app.delete('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;

  if (sessions.has(sessionId)) {
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
});
