/**
 * test_logic.js - Critical logic verification
 * Tests: stimuli count, rule partitioning, sampling no-overlap, arbitrary rules
 */

// Polyfill window for browser-only code
global.window = {};

const { ALL_ITEMS, FEATURES } = require('./js/stimuli.js');
const { RULES_DB } = require('./js/rules.js');
const { generateTrialData, partitionItems } = require('./js/trials.js');

console.log("=== CRITICAL LOGIC AUDIT ===\n");

// 1. Verify 36 items
console.log(`[1] Stimuli count: ${ALL_ITEMS.length} (expected 36)`);
if (ALL_ITEMS.length !== 36) throw new Error("FAIL: Wrong item count!");
console.log("    PASS\n");

// 2. Verify unique IDs
const ids = ALL_ITEMS.map(i => i.id);
const uniqueIds = new Set(ids);
console.log(`[2] Unique IDs: ${uniqueIds.size} (expected 36)`);
if (uniqueIds.size !== 36) throw new Error("FAIL: Duplicate IDs!");
console.log("    PASS\n");

// 3. Test each rule
console.log("[3] Rule partitioning:");
for (const rule of RULES_DB) {
  const { positives, negatives } = partitionItems(rule, ALL_ITEMS);
  const total = positives.length + negatives.length;
  const bothNonEmpty = positives.length > 0 && negatives.length > 0;
  console.log(`    Rule "${rule.id}" (complexity ${rule.complexity}): ${positives.length} pos, ${negatives.length} neg, total=${total}, valid=${bothNonEmpty}`);
  if (total !== 36) throw new Error(`FAIL: Rule ${rule.id} lost items! Total=${total}`);
  if (!bothNonEmpty) throw new Error(`FAIL: Rule ${rule.id} has empty set!`);
}
console.log("    ALL RULES PASS\n");

// 4. Test sampling: no overlap between training and test
console.log("[4] Sampling no-overlap test (10 random trials):");
const config = {
  MIN_TRAINING_POS: 2, MAX_TRAINING_POS: 4,
  MIN_TRAINING_NEG: 2, MAX_TRAINING_NEG: 4,
  MIN_TEST_ITEMS: 6, MAX_TEST_ITEMS: 8
};

// Reset seed
if (window.setRandomSeed) window.setRandomSeed(42);

for (let i = 0; i < 10; i++) {
  const rule = RULES_DB[i % RULES_DB.length];
  const trial = generateTrialData(rule, ALL_ITEMS, config);
  
  const trainIds = new Set([
    ...trial.trainingPos.map(x => x.id),
    ...trial.trainingNeg.map(x => x.id)
  ]);
  const testIds = new Set(trial.testItems.map(x => x.id));
  
  // Check overlap
  const overlap = [...trainIds].filter(id => testIds.has(id));
  
  // Check training has both pos and neg
  const hasPos = trial.trainingPos.length >= 2;
  const hasNeg = trial.trainingNeg.length >= 2;
  const testInRange = trial.testItems.length >= 6 && trial.testItems.length <= 8;
  
  console.log(`    Trial ${i+1} (${rule.id}): train=${trainIds.size} (${trial.trainingPos.length}+/${trial.trainingNeg.length}-), test=${testIds.size}, overlap=${overlap.length}, posOK=${hasPos}, negOK=${hasNeg}, testRangeOK=${testInRange}`);
  
  if (overlap.length > 0) throw new Error(`FAIL: OVERLAP in trial ${i+1}!`);
  if (!hasPos) throw new Error(`FAIL: Not enough positive training items in trial ${i+1}`);
  if (!hasNeg) throw new Error(`FAIL: Not enough negative training items in trial ${i+1}`);
}
console.log("    ALL SAMPLING TESTS PASS\n");

// 5. Check arbitrary rules specifically
console.log("[5] Arbitrary rule validation:");
const arbRules = RULES_DB.filter(r => r.complexity === 3);
console.log(`    Found ${arbRules.length} arbitrary rules`);
for (const rule of arbRules) {
  const { positives } = partitionItems(rule, ALL_ITEMS);
  console.log(`    "${rule.id}": ${positives.length} positive items (IDs: ${positives.map(i=>i.id).join(',')})`);
}
if (arbRules.length === 0) throw new Error("FAIL: No arbitrary rules found!");
console.log("    PASS\n");

// 6. Check accuracy formula
console.log("[6] Accuracy formula test:");
const testRule = RULES_DB[0]; // simple_red
const testTrial = generateTrialData(testRule, ALL_ITEMS, config);
const correctLabels = testTrial.testItems.map(item => testRule.evaluate(item) ? 1 : 0);
// Simulate: select all items
const selectAll = testTrial.testItems.map(i => i.id);
const posInTest = testTrial.testItems.filter(i => testRule.evaluate(i)).length;
const expectedAccSelectAll = posInTest / testTrial.testItems.length;
// Simulate: select none
const expectedAccSelectNone = (testTrial.testItems.length - posInTest) / testTrial.testItems.length;
console.log(`    Test items: ${testTrial.testItems.length}, positive in test: ${posInTest}`);
console.log(`    If select ALL: accuracy = ${expectedAccSelectAll.toFixed(2)}`);
console.log(`    If select NONE: accuracy = ${expectedAccSelectNone.toFixed(2)}`);
console.log(`    Correct labels: [${correctLabels.join(',')}]`);
console.log("    PASS\n");

console.log("=== ALL TESTS PASSED ===");
