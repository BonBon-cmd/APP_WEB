// HTTP Client tự xây dựng
const http = require('http');
const https = require('https');

class HttpClient {
  get(url, callback) {
    const lib = url.startsWith('https') ? https : http;
    const options = {
      headers: {
        'User-Agent': 'lab01-nhom27'
      }
    };
    lib.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        callback(null, res, data);
      });
    }).on('error', err => {
      callback(err);
    });
  }

  post(url, body, callback) {
    const lib = url.startsWith('https') ? https : http;
    const data = JSON.stringify(body);
    const { hostname, pathname } = new URL(url);
    const options = {
      hostname,
      path: pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = lib.request(options, (res) => {
      let response = '';
      res.on('data', chunk => response += chunk);
      res.on('end', () => {
        callback(null, res, response);
      });
    });
    req.on('error', err => callback(err));
    req.write(data);
    req.end();
  }
}

// Kiểm thử
const client = new HttpClient();

// GET local
client.get('http://localhost:3000/api/server-info', (err, res, data) => {
  console.log('GET local:', err ? err : data);
});

// GET external
client.get('https://api.github.com', (err, res, data) => {
  console.log('GET external:', err ? err : data);
});

// POST test
client.post('https://jsonplaceholder.typicode.com/posts', { title: 'test', body: 'demo', userId: 1 }, (err, res, data) => {
  console.log('POST test:', err ? err : data);
});

// Lỗi server
client.get('http://localhost:9999', (err, res, data) => {
  console.log('GET lỗi server:', err ? err : data);
});
