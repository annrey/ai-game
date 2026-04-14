const { CoreGameEngine } = require('./index.js');

async function runTest() {
  console.log('Initializing Rust Game Engine...');
  // Initialize with a dummy ollama URL or real one if running
  const engine = CoreGameEngine.create('http://localhost:11434');

  console.log('Subscribing to EventBus...');
  // Pass a callback function that will be executed whenever Rust publishes an event
  engine.subscribe((eventJson) => {
    const event = JSON.parse(eventJson);
    console.log(`\n[TS Callback] Received Event from Rust: ${event.event_type}`);
    console.log(`Payload: ${JSON.stringify(event.payload)}`);
  });

  console.log('Starting Engine Main Loop in background...');
  engine.start();

  console.log('Fetching Initial State...');
  let stateStr = await engine.getState();
  console.log('State:', JSON.parse(stateStr));

  console.log('\nDispatching player_move event...');
  engine.dispatchEvent('player_move', JSON.stringify({ direction: 'North' }));

  // Wait a bit to let the background async rule engine process the event
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('\nFetching State after movement...');
  stateStr = await engine.getState();
  console.log('State:', JSON.parse(stateStr));

  console.log('\nDispatching player_input event (Triggers Narrator Agent)...');
  console.log('(Make sure Ollama is running locally for a real LLM response, otherwise it might just error out or timeout)');
  
  engine.dispatchEvent('player_input', JSON.stringify("I look around the room."));

  // Wait to see if Narrator emits a narrative_generated event
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('\nTest completed.');
  process.exit(0);
}

runTest().catch(console.error);
