const { GameMemoryStore } = require('./index.js');
const fs = require('fs');
const path = require('path');

async function runTest() {
  const dbPath = path.resolve(__dirname, 'test.db');
  
  // Make sure to touch the file so SQLite can open it if it requires it to exist or we use CREATE IF NOT EXISTS
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
  fs.writeFileSync(dbPath, '');

  console.log(`Creating memory store at sqlite://${dbPath}...`);
  const store = await GameMemoryStore.create(`sqlite://${dbPath}`);

  console.log('Adding entry...');
  const id = 'test-id-123';
  const content = 'Hello from Rust FFI!';
  const createdAt = Date.now();
  const metadata = JSON.stringify({ author: 'Trae', tags: ['test', 'ffi'] });

  await store.addEntry(id, content, createdAt, metadata);
  console.log('Entry added successfully.');

  console.log('Getting entry...');
  const entryStr = await store.getEntry(id);
  const entry = JSON.parse(entryStr);
  console.log('Retrieved entry:', entry);

  console.log('Listing entries...');
  const entriesStr = await store.listEntries();
  const entries = JSON.parse(entriesStr);
  console.log(`Found ${entries.length} entries.`);

  console.log('Deleting entry...');
  await store.deleteEntry(id);
  console.log('Entry deleted.');

  const finalEntriesStr = await store.listEntries();
  const finalEntries = JSON.parse(finalEntriesStr);
  console.log(`Remaining entries: ${finalEntries.length}`);

  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
}

runTest().catch(console.error);
