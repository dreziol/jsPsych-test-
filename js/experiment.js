/**
 * experiment.js (Module)
 * Professional Cloud-Synced Research Engine.
 * Features: Rules management, Prolific ID tracking, Page-level timing, and Clean Data Export.
 */

import { db, doc, getDoc, addDoc, collection } from './firebase-config.js';
import { ALL_ITEMS, renderItemSVG } from './stimuli.js';
import { RULES_DB } from './rules.js';
import { generateTrialData, shuffle, setRandomSeed, seedableRandom } from './trials.js';

// CONFIGURATION - Researcher-managed via Admin Panel (admin.html)
const CONFIG = {
  NUM_TRIALS: 5,
  DATA_PIPE_ID: "CLOUDSYNC", // Set to "CLOUDSYNC" to enable Firestore
  PROLIFIC_COMPLETION_CODE: "SUCCESS2024"
};

// Extractor for PID
function getUrlParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

const PARTICIPANT_ID = getUrlParam('prolific_pid') || getUrlParam('participantId') || "ANON_" + Math.floor(Math.random() * 999999);

/**
 * Main Study Flow
 */
async function runExperiment() {
  // Initialize jsPsych
  const jsPsych = initJsPsych({
    show_progress_bar: true,
    on_finish: function() {
       if (CONFIG.DATA_PIPE_ID !== "CLOUDSYNC") {
          jsPsych.data.get().localSave('csv', `backup_${PARTICIPANT_ID}.csv`);
       }
    }
  });

  // PRIVATE STORAGE FOR RESEARCH DATA (ENSURES 100% RELIABILITY)
  const masterTrialData = [];

  // 1. FETCH SETTINGS FROM CLOUD (Rule Subsets)
  let activeRulesPool = [...RULES_DB];
  try {
    const configDoc = await getDoc(doc(db, "settings", "experiment_config"));
    if (configDoc.exists()) {
      const activeIDs = configDoc.data().active_rules;
      if (activeIDs && activeIDs.length > 0) {
        activeRulesPool = RULES_DB.filter(r => activeIDs.includes(r.id));
      }
    }
  } catch (e) {
    console.warn("Cloud config unreachable.");
  }

  setRandomSeed(Math.floor(Math.random() * 2147483647));
  shuffle(activeRulesPool);

  const timeline = [];
  timeline.push({ type: jsPsychPreload, images: ALL_ITEMS.map(item => `stimuli/${item.id}.svg`) });

  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <div class="instructions-text">
        <h1>Welcome to the Research Study</h1>
        <p>In this experiment, you will learn to categorize objects into a specific group based on their visual features.</p>
        <p><strong>Your Goal:</strong> Infer the logic/rule that determines whether an object "BELONGS" to the group.</p>
      </div>
    `,
    choices: ['Start Experiment']
  });

  let lastLearningRT = 0;
  let pageStartTime = 0;

  // Generate Blocks
  for (let i = 0; i < CONFIG.NUM_TRIALS; i++) {
    const selectedRule = activeRulesPool[Math.floor(seedableRandom() * activeRulesPool.length)];
    const trialSamples = generateTrialData(selectedRule, ALL_ITEMS);

    // 1. LEARNING PHASE
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: () => {
        const posHTML = trialSamples.trainingPos.map(item => `<div class="stimulus-container">${renderItemSVG(item)}<span class="label positive">BELONGS</span></div>`).join('');
        const negHTML = trialSamples.trainingNeg.map(item => `<div class="stimulus-container">${renderItemSVG(item)}<span class="label negative">NO</span></div>`).join('');
        return `
          <div class="trial-header"><h2>Trial ${i + 1} of ${CONFIG.NUM_TRIALS}: Learning</h2></div>
          <p>Examine these examples and try to find the category rule.</p>
          <div class="example-grid">
            <div class="grid-section"><h3>Positive Examples</h3><div class="stimuli-row">${posHTML}</div></div>
            <div class="grid-section"><h3>Negative Examples</h3><div class="stimuli-row">${negHTML}</div></div>
          </div>
        `;
      },
      choices: ['Continue to Test'],
      on_load: () => { pageStartTime = performance.now(); },
      on_finish: (data) => {
        lastLearningRT = performance.now() - pageStartTime;
      }
    });

    // 2. TEST PHASE
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: () => {
        const testHTML = trialSamples.testItems.map(item => `<div class="stimulus-container selectable" data-id="${item.id}" onclick="toggleSelection(this)">${renderItemSVG(item)}</div>`).join('');
        return `
          <div class="trial-header"><h2>Knowledge Test</h2></div>
          <p>Select ALL objects that you believe <strong>BELONG</strong> to the category.</p>
          <div class="test-grid">${testHTML}</div>
          <input type="hidden" id="participant-selections" value="[]">
        `;
      },
      choices: ['Submit Answers'],
      on_load: () => {
        pageStartTime = performance.now();
        window.selectedIds = [];
        // Disable submit button by default
        const btn = document.getElementById('jspsych-html-button-response-button-0');
        if (btn) {
          btn.disabled = true;
          btn.style.opacity = "0.4";
        }

        window.toggleSelection = (el) => {
          const id = parseInt(el.getAttribute('data-id'));
          if (!window.selectedIds) window.selectedIds = [];
          
          const idx = window.selectedIds.indexOf(id);
          if (idx === -1) {
            window.selectedIds.push(id);
            el.classList.add('selected');
          } else {
            window.selectedIds.splice(idx, 1);
            el.classList.remove('selected');
          }

          // Enable/Disable button based on selection
          const submitBtn = document.getElementById('jspsych-html-button-response-button-0');
          if (submitBtn) {
            submitBtn.disabled = window.selectedIds.length === 0;
            submitBtn.style.opacity = submitBtn.disabled ? "0.4" : "1";
            submitBtn.style.pointerEvents = submitBtn.disabled ? "none" : "auto";
          }
        };
      },
      on_finish: (data) => {
        const testRT = performance.now() - pageStartTime;
        const selections = window.selectedIds || [];
        const correctLabels = trialSamples.testItems.map(item => selectedRule.evaluate(item));
        const totalTargets = correctLabels.filter(l => l === true).length;
        
        let hits = 0;
        let falseAlarms = 0;

        trialSamples.testItems.forEach((item, idx) => {
          const selected = selections.includes(item.id);
          const isTarget = correctLabels[idx];

          if (isTarget && selected) hits++;
          if (!isTarget && selected) falseAlarms++;
        });

        // Accuracy = (Hits - FalseAlarms) / TotalTargets (capped at 0-1)
        // Safety check to prevent NaN if no targets are in the set
        const trialAccuracy = totalTargets === 0 ? 0 : Math.max(0, (hits - falseAlarms) / totalTargets);

        // ACCUMULATE IN MASTER ARRAY
        masterTrialData.push({
          rule_id: selectedRule.id,
          rule_name: selectedRule.name,
          accuracy: trialAccuracy,
          correct_count: hits,
          total_items: trialSamples.testItems.length,
          test_rt: testRT,
          learning_rt: lastLearningRT,
          example_items: trialSamples.trainingPos.map(i => i.id).concat(trialSamples.trainingNeg.map(i => i.id)).join('|'),
          test_items_list: trialSamples.testItems.map(i => i.id).join('|'),
          participant_responses: selections.join('|')
        });

        lastLearningRT = 0;
      }
    });
  }

    // 4. CLOUD SYNC PHASE
  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: "<h1>Saving Data...</h1><p>Please wait...</p>",
    choices: [],
    on_load: async () => {
      const cleanedPackage = {
        participant_id: PARTICIPANT_ID,
        timestamp: new Date().toISOString(),
        device: navigator.userAgent,
        overall_accuracy: masterTrialData.reduce((acc, val) => acc + val.accuracy, 0) / masterTrialData.length,
        overall_rt: masterTrialData.reduce((acc, val) => acc + val.test_rt, 0),
        trials: masterTrialData
      };

      try {
        await addDoc(collection(db, "results"), cleanedPackage);
        jsPsych.finishTrial();
      } catch (e) {
        console.error("Cloud failure.", e);
        jsPsych.finishTrial();
      }
    }
  });

  // Final Summary Screen
  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: () => {
      const finalAcc = (masterTrialData.reduce((acc, val) => acc + val.accuracy, 0) / masterTrialData.length * 100).toFixed(1);
      return `
        <div class="completion-screen" style="padding: 40px; text-align: center;">
          <h1 style="color: #2c3e50;">Research Participation Complete</h1>
          
          <div style="background: #e3f2fd; border: 2px solid #2196f3; padding: 20px; border-radius: 12px; margin: 30px auto; max-width: 400px;">
            <h2 style="margin: 0; color: #1976d2;">Your Accuracy: ${finalAcc}%</h2>
          </div>

          <div class="prolific-code-box" style="margin: 30px 0; padding: 25px; background: #fffaf0; border: 2px dashed #ffcc80; border-radius: 12px;">
            <p style="margin: 0 0 10px 0; font-size: 0.9rem; color: #666; font-weight: bold; text-transform: uppercase;">Your Prolific Completion Code:</p>
            <h2 class="code" style="font-family: monospace; font-size: 2.5rem; color: #d35400; margin: 0;">${CONFIG.PROLIFIC_COMPLETION_CODE}</h2>
          </div>
          
          <p style="color: #666;">You may now safely close this window. Thank you!</p>
        </div>
      `;
    },
    choices: ['Exit Experiment']
  });

  jsPsych.run(timeline);
}

runExperiment();
