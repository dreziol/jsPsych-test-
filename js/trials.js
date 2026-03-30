/**
 * trials.js
 * Logic for sampling items and partitioning them based on chosen rules.
 */

// Simple seedable random generator (Park-Miller)
let _seed = 12345;
function seedableRandom() {
  _seed = (_seed * 16807) % 2147483647;
  return (_seed - 1) / 2147483646;
}

/**
 * Sets the random seed for reproducibility.
 */
function setRandomSeed(s) {
  _seed = s || Math.floor(Math.random() * 2147483647);
}

/**
 * Shuffles an array in place using the seedable random.
 */
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(seedableRandom() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

if (typeof window !== 'undefined') {
  window.shuffle = shuffle;
  window.setRandomSeed = setRandomSeed;
}

/**
 * Partition all 36 items into positives and negatives for a given rule.
 * @param {Rule} rule - The rule object with evaluate function.
 * @param {Array} allItems - All 36 items.
 * @returns {Object} - { positives: [], negatives: [] }
 */
function partitionItems(rule, allItems) {
  const positives = [];
  const negatives = [];
  
  for (const item of allItems) {
    if (rule.evaluate(item)) {
      positives.push(item);
    } else {
      negatives.push(item);
    }
  }
  
  return { positives, negatives };
}

/**
 * Sample items for a single trial.
 * @param {Rule} rule - The chosen rule.
 * @param {Array} allItems - All 36 items.
 * @param {Object} config - Configuration object with bounds.
 * @returns {Object} - Trial data containing training and test sets.
 */
function generateTrialData(rule, allItems, config = { 
  MIN_TRAINING_POS: 2, MAX_TRAINING_POS: 4, 
  MIN_TRAINING_NEG: 2, MAX_TRAINING_NEG: 4,
  MIN_TEST_ITEMS: 6, MAX_TEST_ITEMS: 8 
}) {
  const { positives, negatives } = partitionItems(rule, allItems);
  
  // Validation: Both sets must be non-empty
  if (positives.length === 0 || negatives.length === 0) {
    throw new Error(`Rule ${rule.id} results in empty set(s). Check logic.`);
  }

  // Shuffle copies to prevent mutation issues
  const posCopy = [...positives];
  const negCopy = [...negatives];
  shuffle(posCopy);
  shuffle(negCopy);
  
  // 1. Sample training items
  const numTrainingPos = Math.floor(seedableRandom() * (config.MAX_TRAINING_POS - config.MIN_TRAINING_POS + 1)) + config.MIN_TRAINING_POS;
  const numTrainingNeg = Math.floor(seedableRandom() * (config.MAX_TRAINING_NEG - config.MIN_TRAINING_NEG + 1)) + config.MIN_TRAINING_NEG;
  
  const trainingPos = posCopy.splice(0, Math.min(numTrainingPos, posCopy.length));
  const trainingNeg = negCopy.splice(0, Math.min(numTrainingNeg, negCopy.length));
  
  // 2. Sample test items (from remaining pools)
  const remainingPos = [...posCopy];
  const remainingNeg = [...negCopy];
  shuffle(remainingPos);
  shuffle(remainingNeg);
  
  const numTestItems = Math.floor(seedableRandom() * (config.MAX_TEST_ITEMS - config.MIN_TEST_ITEMS + 1)) + config.MIN_TEST_ITEMS;
  const testItems = [];
  
  // We want a mix of positive and negative test items if possible
  const targetPos = Math.floor(numTestItems / 2);
  const actualPosCount = Math.min(targetPos, remainingPos.length);
  const actualNegCount = Math.min(numTestItems - actualPosCount, remainingNeg.length);
  
  testItems.push(...remainingPos.splice(0, actualPosCount));
  testItems.push(...remainingNeg.splice(0, actualNegCount));
  
  // Shuffle test items final layout
  shuffle(testItems);
  
  return {
    rule,
    trainingPos,
    trainingNeg,
    testItems
  };
}

// Export for modern browser modules
export { generateTrialData, partitionItems, shuffle, setRandomSeed, seedableRandom };
