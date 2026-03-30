const fs = require('fs');
const path = require('path');
const { ALL_ITEMS, FEATURES } = require('./js/stimuli.js');

const COLOR_MAP = {
  red: '#ff4d4d',
  green: '#2ecc71',
  blue: '#3498db'
};

const SIZE_MAP = {
  big: 100,
  small: 50
};

function generateSVG(item) {
  const size = SIZE_MAP[item.size];
  const color = COLOR_MAP[item.color];
  const totalSize = 120;
  const center = totalSize / 2;
  
  let patternDef = '';
  let fill = color;
  
  if (item.texture === 'striped') {
    const patternId = `pattern-${item.id}`;
    patternDef = `
      <defs>
        <pattern id="${patternId}" patternUnits="userSpaceOnUse" width="12" height="12" patternTransform="rotate(45)">
          <rect width="12" height="12" fill="${color}" />
          <rect width="6" height="12" fill="white" fill-opacity="0.4" />
        </pattern>
      </defs>
    `;
    fill = `url(#${patternId})`;
  }
  
  let shapeMarkup = '';
  switch (item.shape) {
    case 'circle':
      shapeMarkup = `<circle cx="${center}" cy="${center}" r="${size / 2}" fill="${fill}" stroke="#333" stroke-width="2" />`;
      break;
    case 'square':
      shapeMarkup = `<rect x="${center - size / 2}" y="${center - size / 2}" width="${size}" height="${size}" fill="${fill}" stroke="#333" stroke-width="2" />`;
      break;
    case 'diamond':
      const half = size / 2;
      const points = `${center},${center - half} ${center + half},${center} ${center},${center + half} ${center - half},${center}`;
      shapeMarkup = `<polygon points="${points}" fill="${fill}" stroke="#333" stroke-width="2" />`;
      break;
  }
  
  return `<svg width="${totalSize}" height="${totalSize}" viewBox="0 0 ${totalSize} ${totalSize}" xmlns="http://www.w3.org/2000/svg">${patternDef}${shapeMarkup}</svg>`;
}

const stimuliDir = path.join(__dirname, 'stimuli');
if (!fs.existsSync(stimuliDir)) {
  fs.mkdirSync(stimuliDir);
}

ALL_ITEMS.forEach(item => {
  const svgStr = generateSVG(item);
  fs.writeFileSync(path.join(stimuliDir, `${item.id}.svg`), svgStr);
});

console.log('Successfully wrote 36 SVG files to stimuli folder.');
