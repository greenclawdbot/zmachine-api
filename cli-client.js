#!/usr/bin/env node

/**
 * Z-Machine CLI Client
 * Interactive command-line client for testing the Z-Machine API
 */

const readline = require('readline');
const http = require('http');
const { URL } = require('url');

class ZMachineCLI {
  constructor(serverUrl = 'http://localhost:3000') {
    this.serverUrl = serverUrl;
    this.sessionId = null;
    this.rl = null;
    this.commandHistory = [];
    this.historyIndex = -1;
  }

  makeRequest(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.serverUrl);
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? require('https') : http;
      
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };

      const req = lib.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(json);
            } else {
              reject(new Error(json.error || `HTTP ${res.statusCode}: ${res.statusMessage}`));
            }
          } catch (e) {
            reject(new Error(`Invalid JSON response: ${body}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(new Error(`Connection error: ${err.message}`));
      });

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  async startSession(gamePath = null) {
    try {
      const response = await this.makeRequest('/api/sessions', 'POST', { gamePath });
      this.sessionId = response.sessionId;
      
      // Clean up the initial output
      let output = response.output;
      if (output.endsWith('>')) {
        output = output.slice(0, -1).trim();
      }
      
      console.log(output);
      return true;
    } catch (error) {
      console.error('Failed to start session:', error.message);
      return false;
    }
  }

  async sendCommand(command) {
    if (!this.sessionId) {
      const started = await this.startSession();
      if (!started) return false;
    }

    try {
      const response = await this.makeRequest(`/api/sessions/${this.sessionId}/input`, 'POST', { command });
      
      // Clean up the output
      let output = response.output;
      if (output.endsWith('>')) {
        output = output.slice(0, -1).trim();
      }
      
      console.log(output);
      return true;
    } catch (error) {
      if (error.message.includes('Session not found') || error.message.includes('404')) {
        this.sessionId = null;
        const started = await this.startSession();
        if (started) {
          return await this.sendCommand(command);
        }
        return false;
      } else {
        console.error('Error sending command:', error.message);
        return false;
      }
    }
  }

  async cleanup() {
    if (this.sessionId) {
      try {
        await this.makeRequest(`/api/sessions/${this.sessionId}`, 'DELETE');
        console.log('\nSession cleaned up.');
      } catch (error) {
        // Silently ignore cleanup errors
      }
    }
    
    if (this.rl) {
      this.rl.close();
    }
  }

  showHelp() {
    console.log(`
Z-Machine CLI Commands:
  Any text          - Send command to the game
  look              - Look around current location
  inventory, inv    - Show inventory
  help, ?           - Show this help
  quit, exit        - Exit the CLI
  
Navigation:
  go north, n       - Move north
  go south, s       - Move south
  go east, e        - Move east
  go west, w        - Move west
  
Object interaction:
  take [item]       - Pick up an item
  drop [item]       - Drop an item
  open [object]     - Open something
  examine [object]  - Look at something closely
  read [item]       - Read something
  
Controls:
  Arrow up/down     - Navigate command history
  Ctrl+C           - Exit and clean up
    `);
  }

  startInteractive() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> ',
      history: this.commandHistory,
      historySize: 50
    });

    // Handle command history
    this.rl.on('line', (line) => {
      const command = line.trim();
      
      if (!command) {
        this.rl.prompt();
        return;
      }

      // Add to history
      this.commandHistory.push(command);
      this.historyIndex = this.commandHistory.length;

      // Handle special commands
      const lowerCmd = command.toLowerCase();
      if (lowerCmd === 'quit' || lowerCmd === 'exit') {
        this.cleanup();
        process.exit(0);
        return;
      } else if (lowerCmd === 'help' || lowerCmd === '?') {
        this.showHelp();
        this.rl.prompt();
      } else {
        // Send command to game
        this.sendCommand(command).then(() => {
          this.rl.prompt();
        });
      }
    });

    // Handle arrow key navigation
    this.rl.on('history', () => {
      // readline handles this automatically
    });

    // Handle Ctrl+C
    this.rl.on('SIGINT', () => {
      this.cleanup();
      process.exit(0);
    });

    // Handle process termination
    process.on('SIGTERM', () => {
      this.cleanup();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      this.cleanup();
      process.exit(0);
    });

    // Start with a new session
    this.startSession().then((success) => {
      if (success) {
        console.log('\nType "help" for commands or "quit" to exit.');
        this.rl.prompt();
      } else {
        console.error('Failed to connect to server at', this.serverUrl);
        console.log('Make sure the Z-Machine API server is running.');
        process.exit(1);
      }
    }).catch((error) => {
      console.error('Failed to connect to server at', this.serverUrl);
      console.log('Make sure the Z-Machine API server is running.');
      console.error('Error:', error.message);
      process.exit(1);
    });
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    server: 'http://localhost:3000',
    game: null,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--server' && i + 1 < args.length) {
      options.server = args[i + 1];
      i++;
    } else if (arg === '--game' && i + 1 < args.length) {
      options.game = args[i + 1];
      i++;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }

  return options;
}

function showUsage() {
  console.log(`
Z-Machine CLI Client

Usage:
  node cli-client.js [options]

Options:
  --server <url>    Server URL (default: http://localhost:3000)
  --game <path>     Game file path (optional)
  --help, -h        Show this help

Examples:
  node cli-client.js
  node cli-client.js --server http://localhost:8080
  node cli-client.js --game /games/zork1.zip

Environment Variables:
  ZMACHINE_SERVER   Default server URL
  ZMACHINE_GAME     Default game path
  `);
}

// Main execution
async function main() {
  const options = parseArgs();
  
  // Override with environment variables
  if (process.env.ZMACHINE_SERVER) {
    options.server = process.env.ZMACHINE_SERVER;
  }
  if (process.env.ZMACHINE_GAME) {
    options.game = process.env.ZMACHINE_GAME;
  }

  if (options.help) {
    showUsage();
    process.exit(0);
  }

  const cli = new ZMachineCLI(options.server);
  
  // Set game path if provided
  if (options.game) {
    cli.gamePath = options.game;
  }

  console.log(`Z-Machine CLI Client`);
  console.log(`Server: ${options.server}`);
  if (options.game) {
    console.log(`Game: ${options.game}`);
  }
  console.log('');

  cli.startInteractive();
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Unexpected error:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the CLI
if (require.main === module) {
  main();
}

module.exports = ZMachineCLI;