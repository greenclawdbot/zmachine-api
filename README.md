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
- **CLI** → Simple bash wrapper around curl
- **Mobile app** → React Native, Flutter, etc.

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
