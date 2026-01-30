const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DIST = path.join(__dirname, 'dist');

console.log('Starting Express server...');
console.log('DIST path:', DIST);

// Serve static files
app.use(express.static(DIST));

// SPA fallback using middleware instead of route
app.use((req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Server running on port ' + PORT);
});
