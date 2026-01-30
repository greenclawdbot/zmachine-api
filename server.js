/**
 * Z-Machine API Server
 * REST API for playing Z-machine interactive fiction games
 * Uses simplified game engine (placeholder for full Z-machine interpreter)
 */

const fs = require('fs');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');


const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// In-memory game sessions
const sessions = new Map();

// Default game path
const DEFAULT_GAME = process.env.DEFAULT_GAME || path.join(__dirname, 'games', 'zork1.zip');

// Simplified Z-machine text adventure engine
// This is a placeholder - for full Z-machine support, integrate ebozz or zmachine-core
class ZMachineAPI {
  constructor(storyFile) {
    this.storyFile = storyFile;
    this.outputBuffer = '';
    this.inputBuffer = '';
    this.gameStarted = false;
    this.gameEnded = false;
    this.location = 'field';
    this.inventory = [];
    this.openedMailbox = false;
  }

  start() {
    this.gameStarted = true;
    return this.getWelcomeMessage();
  }

  input(command) {
    this.inputBuffer = command;
    return this.run();
  }

  run() {
    if (!this.gameStarted) {
      this.gameStarted = true;
      return this.getWelcomeMessage();
    }

    if (this.inputBuffer) {
      this.outputBuffer = this.processCommand(this.inputBuffer);
      this.inputBuffer = '';
    }

    return this.outputBuffer;
  }

  getWelcomeMessage() {
    return `ZORK I: The Great Underground Empire
Infocom interactive fiction - a fantasy story
Copyright (c) 1981, 1982, 1983, 1984, 1985, 1986 Infocom, Inc. All Rights Reserved.
ZORK is a registered trademark of Infocom, Inc.

Release 119 / Serial number 880429

West of House
You are standing in an open field west of a white house, with a boarded front door.
There is a small mailbox here.

>`;
  }

  processCommand(cmd) {
    const words = cmd.toLowerCase().trim().split(/\s+/);
    if (words.length === 0) return '>';

    const verb = words[0];
    const noun = words.slice(1).join(' ');

    // Navigation
    if (verb === 'look' || verb === 'l') {
      return this.doLook();
    } else if (verb === 'go' || verb === 'walk' || verb === 'move') {
      return this.doGo(noun);
    } else if (['north', 'n', 'south', 's', 'east', 'e', 'west', 'w', 'up', 'u', 'down', 'd'].includes(verb)) {
      return this.doGo(verb);
    }
    // Object interaction
    else if (verb === 'open' || verb === 'unlock') {
      return this.doOpen(noun);
    } else if (verb === 'take' || verb === 'get' || verb === 'grab' || verb === 'pick') {
      return this.doTake(noun);
    } else if (verb === 'drop') {
      return this.doDrop(noun);
    } else if (verb === 'inventory' || verb === 'i' || verb === 'inv') {
      return this.doInventory();
    } else if (verb === 'examine' || verb === 'x' || verb === 'look' && noun) {
      return this.doExamine(noun);
    } else if (verb === 'read') {
      return this.doRead(noun);
    }
    // Meta commands
    else if (verb === 'help') {
      return this.doHelp();
    } else if (verb === 'quit' || verb === 'q') {
      return this.doQuit();
    } else if (verb === 'score') {
      return this.doScore();
    } else if (verb === 'wait') {
      return this.doWait();
    } else if (verb === 'restart') {
      return this.doRestart();
    } else {
      return "I don't understand that command. Type 'help' for a list of commands.\n>";
    }
  }

  doLook() {
    if (this.location === 'field') {
      let msg = `West of House
You are standing in an open field west of a white house, with a boarded front door.
There is a small mailbox here.`;
      if (this.inventory.length > 0) {
        msg += '\n\nYou are carrying:\n  ' + this.inventory.join('\n  ');
      }
      return msg + '\n>';
    } else if (this.location === 'porch') {
      return `Front Porch
You are on the porch of the white house. The front door is to the east.
The windows are boarded up. A path leads west back to the field.

>`;
    }
    return `Unknown location.
>`;
  }

  doGo(direction) {
    const dir = direction.toLowerCase();
    
    if (this.location === 'field') {
      if (dir === 'east' || dir === 'e') {
        this.location = 'porch';
        return `You go around to the front of the house and climb the porch.
>`;
      } else if (dir === 'north' || dir === 'south' || dir === 'west' || dir === 'w') {
        return `You would only find more fields that way.
>`;
      }
    } else if (this.location === 'porch') {
      if (dir === 'west' || dir === 'w' || dir === 'back') {
        this.location = 'field';
        return `You go back to the open field.
>`;
      } else if (dir === 'east' || dir === 'e' || dir === 'enter' || dir === 'in') {
        return `The door is locked. You need to find another way in.
>`;
      }
    }
    return `You can't go that way.
>`;
  }

  doOpen(thing) {
    if (thing === 'mailbox' || thing === 'box') {
      this.openedMailbox = true;
      return `You open the mailbox. Inside, you see a brochure.
>`;
    } else if (thing === 'door') {
      return `It's locked. You need a key or another way in.
>`;
    } else if (thing === 'window') {
      return `The windows are boarded up. You can't open them.
>`;
    }
    return `You can't open that.
>`;
  }

  doTake(thing) {
    if (this.location !== 'field') {
      return `You don't see that here.
>`;
    }
    
    // Handle knife
    if (thing === 'knife' || thing === 'rusty knife' || thing === 'rusty') {
      if (this.inventory.includes('rusty knife')) {
        return `You already have that.
>`;
      }
      this.inventory.push('rusty knife');
      return `Taken.
>`;
    }
    
    // Handle brochure
    if (thing === 'brochure' || thing === 'paper' || thing === 'mail') {
      if (!this.openedMailbox) {
        return `You don't see that here. Maybe you should open the mailbox first?
>`;
      }
      if (this.inventory.includes('brochure')) {
        return `You already have that.
>`;
      }
      this.inventory.push('brochure');
      return `Taken.
>`;
    }
    
    if (thing === 'mailbox') {
      return `That's fixed in place.
>`;
    }
    return `You don't see that here.
>`;
  }

  doDrop(thing) {
    if (thing === 'knife' || thing === 'rusty knife' || thing === 'rusty') {
      const idx = this.inventory.indexOf('rusty knife');
      if (idx >= 0) {
        this.inventory.splice(idx, 1);
        return `Dropped.
>`;
      }
    }
    return `You don't have that.
>`;
  }

  doInventory() {
    if (this.inventory.length === 0) {
      return `You are not carrying anything.
>`;
    }
    return `You are carrying:\n  ${this.inventory.join('\n  ')}\n>`;
  }

  doExamine(thing) {
    if (thing === 'mailbox' || thing === 'box') {
      return `It's a small US mailbox, painted blue. There's a small slot in it.${this.openedMailbox ? ' It\'s open.' : ''}
>`;
    } else if (thing === 'knife' || thing === 'rusty knife' || thing === 'rusty') {
      return this.inventory.includes('rusty knife') 
        ? `It's a rusty knife. The blade is pitted from years of exposure. You could take it if you want.
>`
        : `A rusty knife is stuck in the ground here. The blade is pitted from years of exposure.
>`;
    } else if (thing === 'door' && this.location === 'porch') {
      return `The front door is locked. It's a heavy wooden door with iron reinforcements.
>`;
    } else if (thing === 'brochure' || thing === 'paper') {
      return `A brochure for the "Great Underground Empire". It mentions something about a thief and treasures...
>`;
    } else if (thing === 'house' && this.location === 'field') {
      return `The house is a three-story Georgian-style house, painted white. The front door is boarded up.
>`;
    }
    return `You see nothing special about that.
>`;
  }

  doRead(thing) {
    if (thing === 'brochure' || thing === 'paper') {
      if (this.inventory.includes('brochure')) {
        return `"WELCOME TO THE GREAT UNDERGROUND EMPIRE!
A world of excitement, adventure, and danger awaits you.
Discover the treasures of Zork!

Note: The Front Door is locked. Try the West of House...
`;
      }
      return `You don't have anything to read.
>`;
    } else if (thing === 'mailbox') {
      return `The mailbox is too dirty to read.
>`;
    }
    return `You can't read that.
>`;
  }

  doScore() {
    const score = this.inventory.length * 10;
    return `Your score is ${score}.
>`;
  }

  doWait() {
    return `Time passes...
>`;
  }

  doRestart() {
    this.location = 'field';
    this.inventory = [];
    this.openedMailbox = false;
    this.gameStarted = false;
    return this.start();
  }

  doHelp() {
    return `Available commands:
  look / l              - Look around
  go [direction]        - Move (north/south/east/west/up/down)
  open [thing]          - Open something
  take [thing]          - Pick something up
  drop [thing]          - Drop something
  inventory / i         - Check what you're carrying
  examine / x [thing]   - Look at something closely
  read [thing]          - Read something
  score                 - Check your score
  wait                  - Wait for a while
  restart               - Start the game over
  help                  - Show this message
  quit / q              - Quit the game
>`;
  }

  doQuit() {
    this.gameEnded = true;
    return `Would you like to quit? (Y)es or (N)o: >`;
  }
}

// Helper functions
function loadGame(gamePath) {
  const fullPath = path.resolve(gamePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Game file not found: ${fullPath}`);
  }
  const storyFile = fs.readFileSync(fullPath);
  return { storyFile, fullPath };
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
    const { storyFile, fullPath } = loadGame(actualPath);
    const zmachine = new ZMachineAPI(storyFile);
    const output = zmachine.start();

    sessions.set(sessionId, {
      zmachine,
      gamePath: fullPath,
      createdAt: new Date().toISOString()
    });

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
    const output = session.zmachine.input(command);
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
    output: session.zmachine.outputBuffer || ''
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
  console.log('');
  console.log('Note: Using simplified game engine. For full Z-machine support,');
  console.log('integrate a proper interpreter like ebozz or zmachine-core.');
});
