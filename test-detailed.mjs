// Detailed test with custom error handling
import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync } from 'fs';
import https from 'https';

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

console.log('Testing Google AI API with detailed error handling...');
console.log(`API Key: ${apiKey?.substring(0, 8)}... (length: ${apiKey?.length})`);

if (!apiKey) {
  console.error('❌ No API key found!');
  process.exit(1);
}

// Test 1: Basic HTTPS connectivity
console.log('\n1. Testing basic HTTPS connectivity to Google API...');
const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`;

const testHttps = () =>
  new Promise((resolve, reject) => {
    const req = https.request(
      testUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        console.log(`Response status: ${res.statusCode}`);
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('✅ HTTPS request successful');
            resolve(data);
          } else {
            console.log(`Response: ${data}`);
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      }
    );

    req.on('error', (error) => {
      console.error('❌ HTTPS error:', error.message);
      reject(error);
    });

    req.write(
      JSON.stringify({
        content: {
          parts: [{ text: 'test' }],
        },
      })
    );
    req.end();
  });

try {
  await testHttps();

  // Test 2: Now try with SDK
  console.log('\n2. Testing with Google AI SDK...');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });

  try {
    const result = await model.embedContent('Hello world');
    if (result.embedding && result.embedding.values) {
      console.log(`✅ Embedding successful! Dimension: ${result.embedding.values.length}`);
    }
  } catch (sdkError) {
    console.error('❌ SDK Error:', sdkError);
    console.error('Error stack:', sdkError.stack);
    if (sdkError.cause) {
      console.error('Caused by:', sdkError.cause);
    }
  }
} catch (error) {
  console.error('\n❌ Connectivity test failed:', error.message);
  console.error('This suggests a network or Node.js configuration issue');
  process.exit(1);
}
