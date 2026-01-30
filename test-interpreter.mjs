/**
 * Test script to verify Z-machine game file loading
 * Uses ebozz Z-machine interpreter
 */

import('ebozz').then(ebozz => {
  const fs = require('fs');
  const path = require('path');

  const GAME_FILE = path.join(__dirname, 'games', 'zork1.zip');

  console.log('=== Z-Machine Interpreter Test ===\n');

  try {
    // Load the game file
    console.log(`Loading game file: ${GAME_FILE}`);
    const gameData = fs.readFileSync(GAME_FILE);
    console.log(`File size: ${gameData.length} bytes`);
    
    // Check header
    console.log(`Version: ${gameData[0]}`);
    console.log(`Release: ${gameData.readUInt16LE(2)}`);
    console.log(`Serial: ${gameData.slice(21, 27).toString('ascii')}`);
    
    // Try to create a Z-machine instance
    console.log('\nCreating Z-machine interpreter...');
    const zmachine = new ebozz.ZMachine(gameData);
    
    console.log('Z-machine created successfully!');
    console.log(`Memory size: ${zmachine.memory.length} bytes`);
    
    // Try to run the game
    console.log('\nRunning initial game...');
    const result = zmachine.run();
    
    if (result && result.output) {
      console.log('\n=== Initial Output ===');
      console.log(result.output);
    } else {
      console.log('No output received');
    }
    
    // Try sending a command
    console.log('\n=== Sending "look" command ===');
    zmachine.input('look\n');
    const lookResult = zmachine.run();
    
    if (lookResult && lookResult.output) {
      console.log(lookResult.output);
    } else {
      console.log('No output from look command');
    }
    
    console.log('\n=== Test Complete ===');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
}).catch(err => {
  console.error('Failed to load ebozz:', err);
});
