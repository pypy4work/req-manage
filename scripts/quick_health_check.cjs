
const fetch = require('node-fetch');
fetch('http://localhost:4000/health')
  .then(r => r.text())
  .then(t => console.log('Response:', t))
  .catch(e => console.error('Error:', e.message));
