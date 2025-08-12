// Express static web server
const express = require('express');
const os = require('os');
const path = require('path');
const app = express();

// Custom headers middleware
app.use((req, res, next) => {
  res.setHeader('X-Powered-By', 'Nhóm 27');
  res.setHeader('X-Server-Timestamp', new Date().toISOString());
  next();
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint
app.get('/api/server-info', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    memory: os.totalmem(),
    uptime: os.uptime()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).send('404 Not Found');
});

// 500 handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('500 Internal Server Error');
});

app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
