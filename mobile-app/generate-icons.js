const sharp = require('sharp');
const fs = require('fs');

const svgBuffer = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect x="96" y="96" width="320" height="320" rx="80" fill="#5B4B8A" stroke="#9d8ccf" stroke-width="32"/>
  <circle cx="256" cy="256" r="64" fill="#9d8ccf"/>
</svg>
`);

// App icon (1024x1024)
sharp(svgBuffer)
  .resize(1024, 1024)
  .png()
  .toFile('assets/icon.png')
  .then(() => console.log('Created icon.png'));

// Adaptive icon (1024x1024)  
sharp(svgBuffer)
  .resize(1024, 1024)
  .png()
  .toFile('assets/adaptive-icon.png')
  .then(() => console.log('Created adaptive-icon.png'));

// Splash icon
const splashSvg = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0d1117"/>
  <rect x="156" y="156" width="200" height="200" rx="50" fill="#5B4B8A" stroke="#9d8ccf" stroke-width="20"/>
  <circle cx="256" cy="256" r="40" fill="#9d8ccf"/>
</svg>
`);

sharp(splashSvg)
  .resize(1284, 2778)
  .extend({
    top: 0, bottom: 0, left: 0, right: 0,
    background: '#0d1117'
  })
  .png()
  .toFile('assets/splash-icon.png')
  .then(() => console.log('Created splash-icon.png'));

// Favicon
sharp(svgBuffer)
  .resize(48, 48)
  .png()
  .toFile('assets/favicon.png')
  .then(() => console.log('Created favicon.png'));
