# Z-Machine API Server

A REST API for playing Z-machine interactive fiction games (like Zork, Hitchhiker's Guide, etc.). Uses the **ebozz** Z-machine interpreter to run actual game bytecode.

## Installation

```bash
cd ~/GitHub/zmachine-api
npm install
```

## Usage

### Start the server

```bash
npm start
```

The server runs on port 3000 by default. Set `PORT` environment variable to change.

### Add game files

Place `.z1` through `.z8` or `.zip` files in the `games/` directory.

## API Endpoints

### List available games

```
GET /api/games
```

**Response:**
```json
{
  "games": [
    { "name": "zork1.zip", "path": "/games/zork1.zip" }
  ]
}
```

### Start a new game session

```
POST /api/sessions
Content-Type: application/json

{
  "gamePath": "/games/zork1.zip"  // optional, defaults to default game
}
```

**Response:**
```json
{
  "sessionId": "abc123-...",
  "output": "ZORK I: The Great Underground Empire...",
  "gamePath": "/path/to/game.z5"
}
```

### Send input to a game

```
POST /api/sessions/:sessionId/input
Content-Type: application/json

{
  "command": "look"
}
```

**Response:**
```json
{
  "sessionId": "abc123-...",
  "command": "look",
  "output": "West of House\nYou are standing..."
}
```

### Get session info

```
GET /api/sessions/:sessionId
```

### Get current output (polling)

```
GET /api/sessions/:sessionId/output
```

### Delete a session

```
DELETE /api/sessions/:sessionId
```

## Example: Play via cURL

```bash
# Start a game
SESSION=$(curl -s -X POST http://localhost:3000/api/sessions | jq -r .sessionId)
echo "Session: $SESSION"

# Look around
curl -s -X POST http://localhost:3000/api/sessions/$SESSION/input \
  -H "Content-Type: application/json" \
  -d '{"command": "look"}'

# Open the mailbox
curl -s -X POST http://localhost:3000/api/sessions/$SESSION/input \
  -H "Content-Type: application/json" \
  -d '{"command": "open mailbox"}'

# Clean up when done
curl -s -X DELETE http://localhost:3000/api/sessions/$SESSION
```

## Frontend Integration

This API is designed to be frontend-agnostic. You can build:

- **Discord bot** → POST commands to the API, display output in chat
- **Web interface** → Use WebSockets for real-time play
- **CLI** → Interactive command-line client (see below)
- **Mobile app** → React Native, Flutter, etc.

## CLI Client

A command-line client is included for easy testing and interactive play.

### Usage

```bash
# Start the CLI (requires server running)
node cli-client.js

# Specify custom server
node cli-client.js --server http://localhost:8080

# Specify game file
node cli-client.js --game /games/zork1.zip
```

### CLI Commands

Once running, you can type commands directly:

- `look` or `l` - Look around
- `go north` or `n` - Move north
- `open mailbox` - Open objects
- `take brochure` - Pick up items
- `inventory` or `i` - Check inventory
- `help` or `?` - Show CLI help
- `quit` or `exit` - Exit the CLI

### Features

- **Interactive mode** with `>` prompt
- **Command history** (use arrow keys)
- **Auto-session management** (creates and cleans up sessions)
- **Error handling** with reconnection
- **Clean output** formatting

### Environment Variables

- `ZMACHINE_SERVER` - Default server URL
- `ZMACHINE_GAME` - Default game path

### Example Session

```bash
$ node cli-client.js

ZORK I: The Great Underground Empire
Infocom interactive fiction - a fantasy story
Copyright (c) 1981, 1982, 1983, 1984, 1985, 1986 Infocom, Inc. All Rights Reserved.

Release 119 / Serial number 880429

West of House
You are standing in an open field west of a white house, with a boarded front door.
There is a small mailbox here.

Type "help" for commands or "quit" to exit.
> open mailbox
You open the mailbox. Inside, you see a brochure.
> take brochure
Taken.
> inventory
You are carrying:
  brochure
> quit
```

## Status

- ✅ Loads and parses Z-machine game files (V1-V6)
- ✅ Runs actual Z-code bytecode
- ✅ Session management
- ⚠️ Input handling needs debugging

## Notes

- The Z-machine interpreter (ebozz) is still in alpha
- Some games may have compatibility issues
- Input handling is being refined

## License

MIT
