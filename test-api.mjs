// Quick test to verify Google AI API connectivity
import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync } from 'fs';

// Read .env file manually
try {
  const envContent = readFileSync('.env', 'utf8');
  const match = envContent.match(/GOOGLE_GENERATIVE_AI_API_KEY=(.+)/);
  if (match && match[1]) {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = match[1].trim();
  }
} catch (error) {
  console.error('Could not read .env file');
}

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

console.log('Testing Google AI API...');
console.log(`API Key: ${apiKey?.substring(0, 8)}...`);

if (!apiKey) {
  console.error('❌ No API key found!');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

try {
  console.log('\n1. Testing embedding API...');
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.embedContent('Hello world');

  if (result.embedding && result.embedding.values) {
    console.log(`✅ Embedding successful! Dimension: ${result.embedding.values.length}`);
  } else {
    console.error('❌ Invalid response format');
  }

  console.log('\n2. Testing text generation API...');
  const chatModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const response = await chatModel.generateContent('Say "API works!"');
  const text = response.response.text();
  console.log(`✅ Generation successful! Response: ${text.substring(0, 50)}...`);

  console.log('\n✅ All tests passed!');
} catch (error) {
  console.error('\n❌ Error:', error.message);
  if (error.cause) {
    console.error('Cause:', error.cause);
  }
  process.exit(1);
}
