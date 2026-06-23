const url = 'https://astroai4u.com/ollama/api/chat';
const body = {
  model: 'llama3:latest',
  messages: [
    { role: 'system', content: 'You are a helpful assistant. You must respond with ONLY JSON.' },
    { role: 'user', content: 'Say hello and return {"greeting": "hello", "model": "your model name"}' }
  ],
  format: 'json',
  stream: false
};

console.log('Sending test JSON request to:', url);
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
})
.then(res => {
  console.log('Response status:', res.status);
  return res.json();
})
.then(json => {
  console.log('Response body:', JSON.stringify(json, null, 2));
})
.catch(err => {
  console.error('Error:', err);
});
