/**
 * rules.js
 * Implements the rule system for categorizing stimuli.
 * Support for simple, complex, and arbitrary rules.
 */

class Rule {
  constructor(id, name, complexity, evaluateFn) {
    this.id = id;
    this.name = name;
    this.complexity = complexity; // 1: Simple, 2: Complex, 3: Arbitrary
    this.evaluate = evaluateFn;
  }
}

const RULES_DB = [
  // SIMPLE RULES (One feature)
  new Rule('simple_red', 'Color is Red', 1, (obj) => obj.color === 'red'),
  new Rule('simple_circle', 'Shape is Circle', 1, (obj) => obj.shape === 'circle'),
  new Rule('simple_big', 'Size is Big', 1, (obj) => obj.size === 'big'),
  new Rule('simple_striped', 'Texture is Striped', 1, (obj) => obj.texture === 'striped'),
  
  // COMPLEX RULES (Multiple features)
  new Rule('complex_red_big', 'Red AND Big', 2, (obj) => obj.color === 'red' && obj.size === 'big'),
  new Rule('complex_blue_circle', 'Blue OR Circle', 2, (obj) => obj.color === 'blue' || obj.shape === 'circle'),
  new Rule('complex_green_solid', 'Green AND Solid', 2, (obj) => obj.color === 'green' && obj.texture === 'solid'),
  
  // COMPLEX LOGICAL RULES
  new Rule('complex_not_red_small', 'NOT (Red or Small)', 2, (obj) => !(obj.color === 'red' || obj.size === 'small')),
  new Rule('complex_rgb_pattern', '(Red & Big) OR (Blue & Small)', 2, (obj) => 
    (obj.color === 'red' && obj.size === 'big') || (obj.color === 'blue' && obj.size === 'small')
  ),
  
  // ARBITRARY RULES (Set-based, as per PDF: positiveSet.has(obj.id))
  new Rule('arbitrary_set_1', 'Arbitrary Set A', 3, (() => {
    const positiveSet = new Set([0, 3, 7, 11, 15, 20, 24, 29, 33]);
    return (obj) => positiveSet.has(obj.id);
  })()),
  new Rule('arbitrary_set_2', 'Arbitrary Set B', 3, (() => {
    const positiveSet = new Set([2, 5, 8, 14, 18, 22, 26, 30, 34]);
    return (obj) => positiveSet.has(obj.id);
  })())
];

/**
 * Gets a random rule from the database by complexity level.
 */
function getRandomRule(complexity = null) {
  let filtered = RULES_DB;
  if (complexity) {
    filtered = RULES_DB.filter(r => r.complexity === complexity);
  }
  return filtered[Math.floor(Math.random() * filtered.length)];
}

// Export for modern browser modules
export { Rule, RULES_DB, getRandomRule };
