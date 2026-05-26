const fs = require('fs');
const path = require('path');

const modelsPath = path.join(process.env.USERPROFILE, '.cache', 'opencode', 'models.json');
const data = JSON.parse(fs.readFileSync(modelsPath, 'utf-8'));

console.log('Providers in models.json:');
for (const providerId of Object.keys(data)) {
  const provider = data[providerId];
  const modelCount = provider.models ? Object.keys(provider.models).length : 0;
  console.log(`  ${providerId}: ${modelCount} models`);
}

// Look for opencode-go specifically
if (data['opencode-go']) {
  console.log('\n--- opencode-go models ---');
  const models = data['opencode-go'].models;
  for (const modelId of Object.keys(models)) {
    const model = models[modelId];
    console.log(`  ${modelId}: ${model.name}`);
  }
}

// Also check for any provider with "go" in the name
console.log('\n--- Providers matching "go" ---');
for (const providerId of Object.keys(data)) {
  if (providerId.toLowerCase().includes('go') || (data[providerId].name && data[providerId].name.toLowerCase().includes('go'))) {
    const provider = data[providerId];
    const modelCount = provider.models ? Object.keys(provider.models).length : 0;
    console.log(`  ${providerId} (${provider.name}): ${modelCount} models`);
  }
}
