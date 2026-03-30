/**
 * stimuli.js
 * Responsible for generating the 36 unique objects and providing SVG rendering functionality.
 */

const FEATURES = {
  color: ['red', 'green', 'blue'],
  size: ['big', 'small'],
  shape: ['circle', 'square', 'diamond'],
  texture: ['striped', 'solid']
};

const COLOR_MAP = {
  red: '#ff4d4d',
  green: '#2ecc71',
  blue: '#3498db'
};

const SIZE_MAP = {
  big: 100,
  small: 50
};

/**
 * Generates all 36 unique items based on feature combinations.
 */
function generateAllItems() {
  const items = [];
  let id = 0;
  
  for (const color of FEATURES.color) {
    for (const size of FEATURES.size) {
      for (const shape of FEATURES.shape) {
        for (const texture of FEATURES.texture) {
          items.push({
            id: id++,
            color,
            size,
            shape,
            texture
          });
        }
      }
    }
  }
  return items;
}

const ALL_ITEMS = generateAllItems();

/**
 * Renders an item as an image string referencing the preloaded SVGs.
 * @param {Object} item - The item object with features.
 * @returns {string} - Image HTML string.
 */
function renderItemSVG(item) {
  return `<img src="stimuli/${item.id}.svg" alt="shape" style="width: 120px; height: 120px;" class="stimulus-image">`;
}

// Export for modern browser modules
export { ALL_ITEMS, renderItemSVG, FEATURES };
