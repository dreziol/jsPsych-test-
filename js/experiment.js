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
const STUDY_ID = getUrlParam('study_id') || "NONE";
const SESSION_ID = getUrlParam('session_id') || "NONE";

/**
 * Main Study Flow
 */
async function runExperiment() {
  // Initialize jsPsych
  const jsPsych = initJsPsych({
    show_progress_bar: true,
    on_finish: function () {
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
        if (activeRulesPool.length === 0) activeRulesPool = [...RULES_DB]; // Failsafe
      }
    }
  } catch (e) {
    console.warn("Cloud config unreachable. Defaulting to all rules.");
  }

  setRandomSeed(Math.floor(Math.random() * 2147483647));
  shuffle(activeRulesPool);



  const timeline = [];
  timeline.push({ type: jsPsychPreload, images: ALL_ITEMS.map(item => `stimuli/${item.id}.svg`) });

  // 0. INSTRUCTIONS SCREEN (Placeholder)
  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <div class="instructions-text" style="max-width: 800px; margin: 0 auto; text-align: left; line-height: 1.6;">
        <h1 style="text-align: center;">Study Instructions</h1>
        <p>This is where your instructions go. You can explain how categories work and how to select items.</p>
        <div style="background: #fff9c4; padding: 15px; border-radius: 8px; border-left: 5px solid #fbc02d;">
            <strong>Reminder:</strong> Please pay close attention to the examples provided in each trial.
        </div>
        <p>Click the button below when you are ready to begin.</p>
      </div>
    `,
    choices: ['Begin Task'],
    on_finish: function(data) {
      window.instructions_rt = (window.instructions_rt || 0) + data.rt;
    }
  });

  timeline.push({
    type: jsPsychHtmlButtonResponse,
    stimulus: `
      <div class="instructions-text">
        <h1>Welcome to the Research Study</h1>
        <p>In this experiment, you will learn to categorize objects into a specific group based on their visual features.</p>
        <p><strong>Your Goal:</strong> Infer the logic/rule that determines whether an object "BELONGS" to the group.</p>
      </div>
    `,
    choices: ['Start Experiment'],
    on_finish: function(data) {
      window.instructions_rt = (window.instructions_rt || 0) + data.rt;
    }
  });

  let lastLearningRT = 0;

  // Generate Blocks (Shuffle-queue: guarantees diverse rules before repeating)
  let ruleQueue = [];
  for (let i = 0; i < CONFIG.NUM_TRIALS; i++) {
    if (ruleQueue.length === 0) {
      ruleQueue = [...activeRulesPool];
      shuffle(ruleQueue);
    }
    const selectedRule = ruleQueue.pop();
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
      on_finish: (data) => {
        lastLearningRT = data.rt; // jsPsych native timing
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
        window.selectedIds = [];
        // Disable submit button by default
        const btn = document.getElementById('jspsych-html-button-response-button-0');
        if (btn) {
          btn.disabled = true;
          btn.style.opacity = "0.4";
          btn.style.pointerEvents = "none";
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
        const testRT = data.rt; // jsPsych native timing
        const selections = window.selectedIds || [];
        const correctLabels = trialSamples.testItems.map(item => selectedRule.evaluate(item));
        const totalTargets = correctLabels.filter(l => l === true).length;

        let hits = 0;
        let falseAlarms = 0;
        let misses = 0;
        let correctRejections = 0;

        trialSamples.testItems.forEach((item, idx) => {
          const selected = selections.includes(item.id);
          const isTarget = correctLabels[idx];

          if (isTarget && selected) hits++;
          else if (!isTarget && selected) falseAlarms++;
          else if (isTarget && !selected) misses++;
          else if (!isTarget && !selected) correctRejections++;
        });

        // Accuracy = (Hits - FalseAlarms) / TotalTargets (capped at 0-1)
        const trialAccuracy = totalTargets === 0 ? 0 : Math.max(0, (hits - falseAlarms) / totalTargets);

        const correctIds = trialSamples.testItems.filter((_, i) => correctLabels[i]).map(item => item.id);
        const exampleIds = trialSamples.trainingPos.map(i => i.id).concat(trialSamples.trainingNeg.map(i => i.id));

        // ENSURE DATA PERSISTS IN RAW JSPSYCH POOL
        data.rule_id = selectedRule.id;
        data.accuracy = trialAccuracy;
        data.participant_responses = selections.join('|');
        data.correct_responses = correctIds.join('|');
        data.example_items = exampleIds.join('|');
        data.hits = hits;
        data.false_alarms = falseAlarms;
        data.misses = misses;
        data.correct_rejections = correctRejections;
        data.correct_count = hits;

        // ACCUMULATE IN MASTER ARRAY
        masterTrialData.push({
          rule_id: selectedRule.id,
          rule_name: selectedRule.name,
          accuracy: trialAccuracy,
          correct_count: hits,
          total_items: trialSamples.testItems.length,
          test_rt: testRT,
          learning_rt: lastLearningRT,
          example_items: data.example_items,
          test_items_list: trialSamples.testItems.map(i => i.id).join('|'),
          participant_responses: data.participant_responses,
          correct_responses: data.correct_responses,
          hits: hits,
          false_alarms: falseAlarms,
          misses: misses,
          correct_rejections: correctRejections
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
      const avgAcc = masterTrialData.length > 0 ? (masterTrialData.reduce((acc, val) => acc + val.accuracy, 0) / masterTrialData.length) : 0;
      const totalTestRT = masterTrialData.reduce((acc, val) => acc + (val.test_rt || 0), 0);

      const cleanedPackage = {
        participant_id: PARTICIPANT_ID,
        study_id: STUDY_ID,
        session_id: SESSION_ID,
        timestamp: new Date().toISOString(),
        device: navigator.userAgent,
        resolution: `${window.innerWidth}x${window.innerHeight}`,
        total_duration_sec: parseFloat((jsPsych.getTotalTime() / 1000).toFixed(2)),
        instructions_duration_ms: parseInt((window.instructions_rt || 0).toFixed(0)),
        overall_accuracy: parseFloat(avgAcc.toFixed(4)),
        overall_rt: totalTestRT,
        raw_jspsych_data: jsPsych.data.get().json(),
        trials: masterTrialData
      };

      console.log("Attempting to sync payload:", cleanedPackage);

      try {
        await addDoc(collection(db, "results"), cleanedPackage);
        console.log("✓ Cloud Sync Successful!");
        jsPsych.finishTrial();
      } catch (e) {
        console.error("CRITICAL: Cloud sync failed.", e);
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
