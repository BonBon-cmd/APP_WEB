// Script giám sát mạng (tùy chọn)
const http = require('http');
const start = Date.now();

http.get('http://localhost:3000', (res) => {
  const latency = Date.now() - start;
  console.log('Status:', res.statusCode);
  console.log('Latency:', latency, 'ms');
  console.log('Headers:', res.headers);
});
