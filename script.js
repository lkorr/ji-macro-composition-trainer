// Game state
let gameActive = false;
let gameMode = 'adaptive'; // 'adaptive' or 'adaptive-chord'
let currentInterval = null;
let currentChord = null;
let questionCount = 0;
let totalTime = 0;
let startTime = null;
let timerInterval = null;
let questionStartTime = null;
let currentComposition = []; // Array of {num, denom} fractions
let chordProgress = []; // For chord mode: array of entered intervals
let repeatSlowThreshold = 5; // seconds

// Adaptive mode state (for intervals)
let intervalStats = {}; // { 'num/denom': { attempts: 0, totalTime: 0, recentTimes: [], mastered: false, lastSeenQuestion: -1 } }
let activeIntervals = []; // Currently unlocked intervals
let allIntervalsSorted = []; // All intervals sorted by complexity
let masteryThreshold = 3.5; // seconds
let minAttemptsForMastery = 5;
let newIntervalWeight = 3;
let rollingAverageWindow = 3; // number of recent attempts to average for mastery check
let nonMasteredRate = 60; // percentage of questions that should be non-mastered intervals
let displayMode = 'all'; // 'all', 'fraction', 'cents', 'name', 'rotate-fraction-cents', 'rotate-fraction-name', 'rotate-cents-name', 'rotate-all'
let currentRotationIndex = 0; // Track current rotation state for cycling display modes
let adaptiveLevel = 1; // Current level (starts at 1, increments when new intervals added)
let lastInterval = null; // Track last interval to prevent immediate repeats
let globalQuestionCounter = 0; // Track total questions asked in current session for guaranteed appearance
let tutorialSequence = ['2/1', '3/2', '5/4', '7/4', '11/8']; // First 5 questions in order - the initial ascending intervals
let tutorialIndex = 0; // Current position in tutorial sequence
let tutorialActive = true; // Whether tutorial is active

// Adaptive chord mode state
let chordStats = {}; // { 'chordKey': { attempts: 0, totalTime: 0, recentTimes: [], mastered: false, lastSeenQuestion: -1 } }
let activeChords = []; // Currently unlocked chords
let allChordsSorted = []; // All chords sorted by complexity
let adaptiveChordLevel = 1; // Current chord level
let lastChord = null; // Track last chord to prevent immediate repeats
let globalChordQuestionCounter = 0; // Track total chord questions asked
let chordTutorialSequence = ['4:5:6']; // Start with just major chord
let chordTutorialIndex = 0;
let chordTutorialActive = true;
let newChordDrillCount = 0; // Track how many times the new chord has been drilled
let newChordDrillTarget = 5; // Number of times to drill new chord before adding to mix
let currentNewChord = null; // The chord currently being drilled
let includeInversions = true; // When true, include chord inversions in the chord pool
let randomStartingNote = false; // When true, start building chords from random positions
let currentChordStartingPosition = 0; // Which note in the chord is the reference point (0 = root)
let currentExpectedIntervals = []; // The transformed intervals for the current chord (accounts for starting position)
let disabledChords = new Set(); // Chord keys disabled by user (won't appear in questions)
let collapsedChordGroups = new Set(); // Collapsed chord groups in adaptive chord mode UI
let collapsedCGChordGroups = new Set(); // Collapsed chord groups in chord-grid mode UI

// Sound settings
let synthType = 'sawtooth'; // 'sawtooth', 'sine', 'square', 'triangle'
let releaseTime = 2; // seconds
let varyPitch = true; // vary starting pitch
let enableSound = true; // enable/disable sound
let earTrainingMode = false; // hide target interval for ear training

// Submit key
let submitKey = '`'; // default submit key

// Note: DEFAULT_PRIME_MAPPINGS and DEFAULT_RECIPROCAL_MAPPINGS now defined in data/keyMappings.js

// Current mappings (can be customized)
let primeMappings = { ...DEFAULT_PRIME_MAPPINGS };
let reciprocalMappings = { ...DEFAULT_RECIPROCAL_MAPPINGS };

// All mappings combined
let allMappings = {};

// Note: INTERVAL_NAMES is now defined in data/intervalNames.js

// Get interval name
function getIntervalName(num, denom) {
    const key = `${num}/${denom}`;
    const ratio = num / denom;

    // Check if it's a descending interval (below 1/1)
    if (ratio < 1) {
        // Find the ascending equivalent (reciprocal)
        const reciprocalKey = `${denom}/${num}`;
        const baseName = INTERVAL_NAMES[reciprocalKey] || INTERVAL_NAMES[key] || '';

        if (baseName) {
            return `DOWN a ${baseName}`;
        }
    }

    return INTERVAL_NAMES[key] || '';
}

// Format interval display based on display mode
function formatIntervalDisplay(num, denom) {
    const cents = (1200 * Math.log2(num / denom)).toFixed(2);
    const intervalName = getIntervalName(num, denom);

    // Determine what to display based on mode
    let displayContent = '';

    if (displayMode === 'all') {
        // Show all: cents, fraction, and name
        displayContent = `
            <div class="cents-display">${cents}¢</div>
            <span class="fraction"><span class="numerator">${num}</span><span class="denominator">${denom}</span></span>
            ${intervalName ? `<div class="interval-name">${intervalName}</div>` : ''}
        `;
    } else if (displayMode === 'fraction') {
        // Fraction only
        displayContent = `
            <span class="fraction"><span class="numerator">${num}</span><span class="denominator">${denom}</span></span>
        `;
    } else if (displayMode === 'cents') {
        // Cents only
        displayContent = `
            <div class="cents-display large">${cents}¢</div>
        `;
    } else if (displayMode === 'name') {
        // Name only (or fraction if no name)
        if (intervalName) {
            displayContent = `
                <div class="interval-name large">${intervalName}</div>
            `;
        } else {
            displayContent = `
                <span class="fraction"><span class="numerator">${num}</span><span class="denominator">${denom}</span></span>
                <div class="interval-name">(no name available)</div>
            `;
        }
    } else if (displayMode.startsWith('rotate-')) {
        // Rotation modes
        const rotationOptions = [];

        if (displayMode === 'rotate-fraction-cents') {
            rotationOptions.push(
                `<span class="fraction"><span class="numerator">${num}</span><span class="denominator">${denom}</span></span>`,
                `<div class="cents-display large">${cents}¢</div>`
            );
        } else if (displayMode === 'rotate-fraction-name') {
            rotationOptions.push(
                `<span class="fraction"><span class="numerator">${num}</span><span class="denominator">${denom}</span></span>`,
                intervalName ? `<div class="interval-name large">${intervalName}</div>` : `<div class="interval-name large">(no name available)</div>`
            );
        } else if (displayMode === 'rotate-cents-name') {
            rotationOptions.push(
                `<div class="cents-display large">${cents}¢</div>`,
                intervalName ? `<div class="interval-name large">${intervalName}</div>` : `<div class="interval-name large">(no name available)</div>`
            );
        } else if (displayMode === 'rotate-all') {
            rotationOptions.push(
                `<span class="fraction"><span class="numerator">${num}</span><span class="denominator">${denom}</span></span>`,
                `<div class="cents-display large">${cents}¢</div>`,
                intervalName ? `<div class="interval-name large">${intervalName}</div>` : `<div class="interval-name large">(no name available)</div>`
            );
        }

        // Use current rotation index
        displayContent = rotationOptions[currentRotationIndex % rotationOptions.length];
    }

    return displayContent;
}

// Note: BASE_CHORD_TYPES, CHORD_NAMES, CHORD_TYPES, generateInversion, getInversionName,
// getChordComplexity, and initializeChordsSorted are now defined in data/chordTypes.js

// DOM elements
const mappingPanel = document.getElementById('mapping-panel');
const gamePanel = document.getElementById('game-panel');
const mappingConfigBtn = document.getElementById('mapping-config-btn');
const backToAdaptiveBtn = document.getElementById('back-to-adaptive-btn');
const resetMappingsBtn = document.getElementById('reset-mappings-btn');
const saveMappingsBtn = document.getElementById('save-mappings-btn');
const targetIntervalEl = document.getElementById('target-interval');
const currentCompositionEl = document.getElementById('current-composition');
const feedbackEl = document.getElementById('feedback');
const questionCountEl = document.getElementById('question-count');
const avgTimeEl = document.getElementById('avg-time');
const timerEl = document.getElementById('timer');
const skipBtn = document.getElementById('skip-btn');
const endBtn = document.getElementById('end-btn');
const keyboardLegendGrid = document.getElementById('keyboard-legend-grid');

// Audio context
let audioContext = null;

// Initialize audio context on first user interaction
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

// Navigation functions
const ALL_PANEL_IDS = [
    'main-menu-panel', 'adaptive-mode-panel', 'adaptive-chord-mode-panel',
    'grid-mode-panel', 'chord-grid-mode-panel', 'chord-grid-game-panel',
    'mapping-panel', 'game-panel'
];

function showPanel(panelId) {
    for (const id of ALL_PANEL_IDS) {
        const el = document.getElementById(id);
        if (el) el.style.display = id === panelId ? 'block' : 'none';
    }
}

function showMainMenu() {
    showPanel('main-menu-panel');
}

function showAdaptiveMode() {
    showPanel('adaptive-mode-panel');
    updateAdaptiveStats();
}

function showAdaptiveChordMode() {
    showPanel('adaptive-chord-mode-panel');
    updateAdaptiveChordStats();
}

function showMappingConfig() {
    showPanel('mapping-panel');
    renderMappingConfig();
}

function showGridMode() {
    showPanel('grid-mode-panel');
}

function showGame() {
    showPanel('game-panel');
}

function showChordGridMode() {
    showPanel('chord-grid-mode-panel');
    updateCGStats();
}

function showChordGridGame() {
    showPanel('chord-grid-game-panel');
}

// Event listeners
mappingConfigBtn.addEventListener('click', () => {
    // Stop the game if active
    if (gameActive) {
        gameActive = false;
        if (timerInterval) clearInterval(timerInterval);
    }
    showMappingConfig();
});
backToAdaptiveBtn.addEventListener('click', showAdaptiveMode);
resetMappingsBtn.addEventListener('click', resetMappings);
saveMappingsBtn.addEventListener('click', () => {
    updateMappingsFromInputs();
    showAdaptiveMode();
});

// Settings button in game panel
const settingsBtn = document.getElementById('settings-btn');
if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
        // Stop the game
        gameActive = false;
        if (timerInterval) clearInterval(timerInterval);

        // Show adaptive mode panel
        showAdaptiveMode();
    });
}

// Configure Mappings button in game panel
const mappingConfigBtnGame = document.getElementById('mapping-config-btn-game');
if (mappingConfigBtnGame) {
    mappingConfigBtnGame.addEventListener('click', () => {
        // Stop the game
        gameActive = false;
        if (timerInterval) clearInterval(timerInterval);

        // Show mapping config panel
        showMappingConfig();
    });
}

// Main menu buttons
const selectIntervalModeBtn = document.getElementById('select-interval-mode-btn');
if (selectIntervalModeBtn) {
    selectIntervalModeBtn.addEventListener('click', showAdaptiveMode);
}

const selectChordModeBtn = document.getElementById('select-chord-mode-btn');
if (selectChordModeBtn) {
    selectChordModeBtn.addEventListener('click', showAdaptiveChordMode);
}

const selectGridModeBtn = document.getElementById('select-grid-mode-btn');
if (selectGridModeBtn) {
    selectGridModeBtn.addEventListener('click', showGridMode);
}

const selectChordGridModeBtn = document.getElementById('select-chord-grid-mode-btn');
if (selectChordGridModeBtn) {
    selectChordGridModeBtn.addEventListener('click', showChordGridMode);
}

// Back to main menu buttons
const backToMainFromIntervalBtn = document.getElementById('back-to-main-from-interval-btn');
if (backToMainFromIntervalBtn) {
    backToMainFromIntervalBtn.addEventListener('click', showMainMenu);
}

const backToMainFromChordBtn = document.getElementById('back-to-main-from-chord-btn');
if (backToMainFromChordBtn) {
    backToMainFromChordBtn.addEventListener('click', showMainMenu);
}

// Start adaptive chord game
const startAdaptiveChordBtn = document.getElementById('start-adaptive-chord-btn');
if (startAdaptiveChordBtn) {
    startAdaptiveChordBtn.addEventListener('click', () => {
        initAudio();
        startAdaptiveChordGame();
    });
}

// Reset adaptive chord progress
const resetAdaptiveChordBtn = document.getElementById('reset-adaptive-chord-btn');
if (resetAdaptiveChordBtn) {
    resetAdaptiveChordBtn.addEventListener('click', resetAdaptiveChordProgress);
}

// Resume from specific chord level
const chordResumeLevelBtn = document.getElementById('chord-resume-level-btn');
if (chordResumeLevelBtn) {
    chordResumeLevelBtn.addEventListener('click', () => {
        const chordResumeLevelInput = document.getElementById('chord-resume-level-input');
        if (chordResumeLevelInput) {
            const targetLevel = parseInt(chordResumeLevelInput.value);
            if (targetLevel >= 1) {
                resumeFromChordLevel(targetLevel);
            } else {
                alert('Please enter a valid level number (1 or higher)');
            }
        }
    });
}

// Click handlers for level detail panels (Chord mode)
const adaptiveChordLevelDisplay = document.getElementById('adaptive-chord-level-display');
if (adaptiveChordLevelDisplay) {
    adaptiveChordLevelDisplay.addEventListener('click', () => {
        const detail = document.getElementById('adaptive-chord-level-detail');
        const arrow = document.getElementById('adaptive-chord-level-arrow');
        if (detail) toggleLevelDetail(adaptiveChordLevelDisplay, detail, arrow, activeChords);
    });
}

const adaptiveLevelIndicator = document.getElementById('adaptive-level-indicator');
if (adaptiveLevelIndicator) {
    adaptiveLevelIndicator.addEventListener('click', () => {
        const detail = document.getElementById('game-level-detail');
        const arrow = document.getElementById('game-level-arrow');
        if (detail) toggleLevelDetail(adaptiveLevelIndicator, detail, arrow, activeChords);
    });
}

const startAdaptiveBtn = document.getElementById('start-adaptive-btn');
if (startAdaptiveBtn) {
    startAdaptiveBtn.addEventListener('click', () => {
        initAudio();
        startAdaptiveGame();
    });
}

const resetAdaptiveBtn = document.getElementById('reset-adaptive-btn');
if (resetAdaptiveBtn) {
    resetAdaptiveBtn.addEventListener('click', resetAdaptiveProgress);
}

const resumeLevelBtn = document.getElementById('resume-level-btn');
if (resumeLevelBtn) {
    resumeLevelBtn.addEventListener('click', () => {
        const resumeLevelInput = document.getElementById('resume-level-input');
        if (resumeLevelInput) {
            const targetLevel = parseInt(resumeLevelInput.value);
            if (targetLevel >= 1) {
                resumeFromLevel(targetLevel);
            } else {
                alert('Please enter a valid level number (1 or higher)');
            }
        }
    });
}


// Help modal
const helpBtn = document.getElementById('help-btn');
const helpBtnGame = document.getElementById('help-btn-game');
const helpModal = document.getElementById('help-modal');
const closeHelpBtn = document.getElementById('close-help-btn');

helpBtn.addEventListener('click', () => {
    helpModal.style.display = 'flex';
});

helpBtnGame.addEventListener('click', () => {
    helpModal.style.display = 'flex';
});

closeHelpBtn.addEventListener('click', () => {
    helpModal.style.display = 'none';
});

helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) {
        helpModal.style.display = 'none';
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && helpModal.style.display === 'flex') {
        helpModal.style.display = 'none';
    }
});

// Mapping configuration
function renderMappingConfig() {
    const primeMappingsEl = document.getElementById('prime-mappings');
    const reciprocalMappingsEl = document.getElementById('reciprocal-mappings');

    primeMappingsEl.innerHTML = '';
    reciprocalMappingsEl.innerHTML = '';

    // Define the fixed prime ratios in order
    const primeRatios = [
        { num: 2, denom: 1 },
        { num: 3, denom: 2 },
        { num: 5, denom: 4 },
        { num: 7, denom: 4 },
        { num: 11, denom: 8 },
        { num: 13, denom: 8 },
        { num: 17, denom: 16 },
        { num: 19, denom: 16 },
        { num: 23, denom: 16 },
        { num: 29, denom: 16 }
    ];

    // Define the fixed reciprocal ratios in order
    const reciprocalRatios = [
        { num: 1, denom: 2 },
        { num: 2, denom: 3 },
        { num: 4, denom: 5 },
        { num: 4, denom: 7 },
        { num: 8, denom: 11 },
        { num: 8, denom: 13 },
        { num: 16, denom: 17 },
        { num: 16, denom: 19 },
        { num: 16, denom: 23 },
        { num: 16, denom: 29 }
    ];

    // Find which key maps to each prime ratio
    function findKeyForRatio(ratio, mappings) {
        for (const [key, r] of Object.entries(mappings)) {
            if (r.num === ratio.num && r.denom === ratio.denom) {
                return key;
            }
        }
        return '';
    }

    // Render prime mappings (inverted: ratio → key)
    for (const ratio of primeRatios) {
        const currentKey = findKeyForRatio(ratio, primeMappings);
        const div = document.createElement('div');
        div.className = 'mapping-item';
        div.innerHTML = `
            <label>
                <span class="key-display">${ratio.num}/${ratio.denom}</span> →
                <input type="text" class="ratio-input key-input" data-num="${ratio.num}" data-denom="${ratio.denom}" data-type="prime" value="${currentKey}" maxlength="1" placeholder="key">
            </label>
        `;
        primeMappingsEl.appendChild(div);
    }

    // Render reciprocal mappings (inverted: ratio → key)
    for (const ratio of reciprocalRatios) {
        const currentKey = findKeyForRatio(ratio, reciprocalMappings);
        const div = document.createElement('div');
        div.className = 'mapping-item';
        div.innerHTML = `
            <label>
                <span class="key-display">${ratio.num}/${ratio.denom}</span> →
                <input type="text" class="ratio-input key-input" data-num="${ratio.num}" data-denom="${ratio.denom}" data-type="reciprocal" value="${currentKey}" maxlength="1" placeholder="key">
            </label>
        `;
        reciprocalMappingsEl.appendChild(div);
    }
}

function updateMappingsFromInputs() {
    const inputs = document.querySelectorAll('.ratio-input');

    // Clear existing mappings
    primeMappings = {};
    reciprocalMappings = {};

    inputs.forEach(input => {
        const num = parseInt(input.dataset.num);
        const denom = parseInt(input.dataset.denom);
        const type = input.dataset.type;
        const key = input.value.trim().toLowerCase();

        // Only add mapping if a key was provided
        if (key.length === 1) {
            if (type === 'prime') {
                primeMappings[key] = { num, denom };
            } else {
                reciprocalMappings[key] = { num, denom };
            }
        }
    });

    // Update combined mappings
    updateAllMappings();
}

function resetMappings() {
    primeMappings = { ...DEFAULT_PRIME_MAPPINGS };
    reciprocalMappings = { ...DEFAULT_RECIPROCAL_MAPPINGS };
    updateAllMappings();
    renderMappingConfig();
}

function updateAllMappings() {
    allMappings = { ...primeMappings, ...reciprocalMappings };
}

// Initialize mappings
updateAllMappings();

// Settings persistence functions
function saveSettings() {
    // Read current values from inputs to ensure we save the latest
    const masteryInput = document.getElementById('mastery-threshold-input');
    const minAttemptsInput = document.getElementById('min-attempts-input');
    const weightInput = document.getElementById('new-interval-weight-input');
    const rollingWindowInput = document.getElementById('rolling-average-window-input');
    const nonMasteredRateInput = document.getElementById('non-mastered-rate-input');
    const displayModeSelect = document.getElementById('display-mode-select');
    const displayModeSelectAdaptive = document.getElementById('display-mode-select-adaptive');
    const repeatSlowInput = document.getElementById('repeat-slow-input');
    const repeatSlowCheckbox = document.getElementById('repeat-slow-checkbox');

    // Sound settings
    const synthTypeSelect = document.getElementById('synth-type-select');
    const releaseTimeInput = document.getElementById('release-time-input');
    const varyPitchCheckbox = document.getElementById('vary-pitch-checkbox');
    const enableSoundCheckbox = document.getElementById('enable-sound-checkbox');
    const earTrainingCheckbox = document.getElementById('ear-training-checkbox');

    // Submit key input
    const submitKeyInput = document.getElementById('submit-key-input');

    // Chord mode settings
    const randomStartingNoteCheckbox = document.getElementById('random-starting-note-checkbox');
    const includeInversionsCheckbox = document.getElementById('include-inversions-checkbox');

    // Chord-Grid mode settings
    const cgRandomStartCheckbox = document.getElementById('chord-grid-random-start-checkbox');
    const cgInversionsCheckbox = document.getElementById('chord-grid-include-inversions-checkbox');

    // Update variables from inputs
    if (masteryInput) masteryThreshold = parseFloat(masteryInput.value);
    if (minAttemptsInput) minAttemptsForMastery = parseInt(minAttemptsInput.value);
    if (weightInput) newIntervalWeight = parseInt(weightInput.value);
    if (rollingWindowInput) rollingAverageWindow = parseInt(rollingWindowInput.value);
    if (nonMasteredRateInput) nonMasteredRate = parseInt(nonMasteredRateInput.value);
    if (displayModeSelectAdaptive) displayMode = displayModeSelectAdaptive.value;
    else if (displayModeSelect) displayMode = displayModeSelect.value;
    if (repeatSlowInput) repeatSlowThreshold = parseFloat(repeatSlowInput.value);

    if (synthTypeSelect) synthType = synthTypeSelect.value;
    if (releaseTimeInput) releaseTime = parseFloat(releaseTimeInput.value);
    if (varyPitchCheckbox !== null) varyPitch = varyPitchCheckbox.checked;
    if (enableSoundCheckbox !== null) enableSound = enableSoundCheckbox.checked;
    if (earTrainingCheckbox !== null) earTrainingMode = earTrainingCheckbox.checked;
    if (submitKeyInput) submitKey = submitKeyInput.value || '`';
    if (randomStartingNoteCheckbox !== null) randomStartingNote = randomStartingNoteCheckbox.checked;
    if (includeInversionsCheckbox !== null) includeInversions = includeInversionsCheckbox.checked;
    if (cgRandomStartCheckbox !== null) chordGridRandomStart = cgRandomStartCheckbox.checked;
    if (cgInversionsCheckbox !== null) chordGridIncludeInversions = cgInversionsCheckbox.checked;

    const settings = {
        // Adaptive mode settings
        masteryThreshold: masteryThreshold,
        minAttemptsForMastery: minAttemptsForMastery,
        newIntervalWeight: newIntervalWeight,
        rollingAverageWindow: rollingAverageWindow,
        nonMasteredRate: nonMasteredRate,
        displayMode: displayMode,

        // General settings
        repeatSlowThreshold: repeatSlowThreshold,
        repeatSlowEnabled: repeatSlowCheckbox?.checked ?? true,
        submitKey: submitKey,

        // Chord mode settings
        randomStartingNote: randomStartingNote,
        includeInversions: includeInversions,

        // Chord-Grid settings
        chordGridRandomStart: chordGridRandomStart,
        chordGridIncludeInversions: chordGridIncludeInversions,
        cgMasteryThreshold: document.getElementById('cg-mastery-threshold-input')?.value ?? 10,
        cgMinAttempts: document.getElementById('cg-min-attempts-input')?.value ?? 5,
        cgRollingWindow: document.getElementById('cg-rolling-average-window-input')?.value ?? 3,
        cgNonMasteredRate: document.getElementById('cg-non-mastered-rate-input')?.value ?? 80,

        // Sound settings
        synthType: synthType,
        releaseTime: releaseTime,
        varyPitch: varyPitch,
        enableSound: enableSound,
        earTrainingMode: earTrainingMode
    };

    localStorage.setItem('ji_trainer_settings', JSON.stringify(settings));
}

function loadSettings() {
    const saved = localStorage.getItem('ji_trainer_settings');
    if (saved) {
        try {
            const settings = JSON.parse(saved);

            // Restore variables
            if (settings.masteryThreshold !== undefined) masteryThreshold = settings.masteryThreshold;
            if (settings.minAttemptsForMastery !== undefined) minAttemptsForMastery = settings.minAttemptsForMastery;
            if (settings.newIntervalWeight !== undefined) newIntervalWeight = settings.newIntervalWeight;
            if (settings.rollingAverageWindow !== undefined) rollingAverageWindow = settings.rollingAverageWindow;
            if (settings.nonMasteredRate !== undefined) nonMasteredRate = settings.nonMasteredRate;
            if (settings.displayMode !== undefined) displayMode = settings.displayMode;
            if (settings.repeatSlowThreshold !== undefined) repeatSlowThreshold = settings.repeatSlowThreshold;

            if (settings.synthType !== undefined) synthType = settings.synthType;
            if (settings.releaseTime !== undefined) releaseTime = settings.releaseTime;
            if (settings.varyPitch !== undefined) varyPitch = settings.varyPitch;
            if (settings.enableSound !== undefined) enableSound = settings.enableSound;
            if (settings.earTrainingMode !== undefined) earTrainingMode = settings.earTrainingMode;
            if (settings.submitKey !== undefined) submitKey = settings.submitKey;
            if (settings.randomStartingNote !== undefined) randomStartingNote = settings.randomStartingNote;
            if (settings.includeInversions !== undefined) includeInversions = settings.includeInversions;
            if (settings.chordGridRandomStart !== undefined) chordGridRandomStart = settings.chordGridRandomStart;
            if (settings.chordGridIncludeInversions !== undefined) chordGridIncludeInversions = settings.chordGridIncludeInversions;

            // Restore UI elements
            const masteryInput = document.getElementById('mastery-threshold-input');
            const minAttemptsInput = document.getElementById('min-attempts-input');
            const weightInput = document.getElementById('new-interval-weight-input');
            const rollingWindowInput = document.getElementById('rolling-average-window-input');
            const nonMasteredRateInput = document.getElementById('non-mastered-rate-input');
            const displayModeSelect = document.getElementById('display-mode-select');
            const displayModeSelectAdaptive = document.getElementById('display-mode-select-adaptive');
            const repeatSlowInput = document.getElementById('repeat-slow-input');
            const repeatSlowCheckbox = document.getElementById('repeat-slow-checkbox');

            const synthTypeSelect = document.getElementById('synth-type-select');
            const releaseTimeInput = document.getElementById('release-time-input');
            const varyPitchCheckbox = document.getElementById('vary-pitch-checkbox');
            const enableSoundCheckbox = document.getElementById('enable-sound-checkbox');
            const earTrainingCheckbox = document.getElementById('ear-training-checkbox');
            const submitKeyInput = document.getElementById('submit-key-input');
            const randomStartingNoteCheckbox = document.getElementById('random-starting-note-checkbox');
            const includeInversionsCheckbox = document.getElementById('include-inversions-checkbox');

            if (masteryInput) masteryInput.value = settings.masteryThreshold ?? 2;
            if (minAttemptsInput) minAttemptsInput.value = settings.minAttemptsForMastery ?? 5;
            if (weightInput) weightInput.value = settings.newIntervalWeight ?? 3;
            if (rollingWindowInput) rollingWindowInput.value = settings.rollingAverageWindow ?? 10;
            if (nonMasteredRateInput) nonMasteredRateInput.value = settings.nonMasteredRate ?? 60;
            if (displayModeSelect) displayModeSelect.value = settings.displayMode ?? 'all';
            if (displayModeSelectAdaptive) displayModeSelectAdaptive.value = settings.displayMode ?? 'all';
            if (repeatSlowInput) repeatSlowInput.value = settings.repeatSlowThreshold ?? 5;
            if (repeatSlowCheckbox) repeatSlowCheckbox.checked = settings.repeatSlowEnabled ?? true;

            if (synthTypeSelect) synthTypeSelect.value = settings.synthType ?? 'sawtooth';
            if (releaseTimeInput) releaseTimeInput.value = settings.releaseTime ?? 2;
            if (varyPitchCheckbox) varyPitchCheckbox.checked = settings.varyPitch ?? true;
            if (enableSoundCheckbox) enableSoundCheckbox.checked = settings.enableSound ?? true;
            if (earTrainingCheckbox) earTrainingCheckbox.checked = settings.earTrainingMode ?? false;
            if (submitKeyInput) submitKeyInput.value = settings.submitKey ?? '`';
            if (randomStartingNoteCheckbox) randomStartingNoteCheckbox.checked = settings.randomStartingNote ?? false;
            if (includeInversionsCheckbox) includeInversionsCheckbox.checked = settings.includeInversions ?? true;

            // Restore chord-specific UI elements
            const chordMasteryInput = document.getElementById('chord-mastery-threshold-input');
            const chordMinAttemptsInput = document.getElementById('chord-min-attempts-input');
            const chordRollingWindowInput = document.getElementById('chord-rolling-average-window-input');
            const chordNonMasteredRateInput = document.getElementById('chord-non-mastered-rate-input');

            if (chordMasteryInput) chordMasteryInput.value = settings.masteryThreshold ?? 5;
            if (chordMinAttemptsInput) chordMinAttemptsInput.value = settings.minAttemptsForMastery ?? 5;
            if (chordRollingWindowInput) chordRollingWindowInput.value = settings.rollingAverageWindow ?? 3;
            if (chordNonMasteredRateInput) chordNonMasteredRateInput.value = settings.nonMasteredRate ?? 80;

            // Restore chord-grid specific UI elements
            const cgRandomStartCheckbox = document.getElementById('chord-grid-random-start-checkbox');
            const cgInversionsCheckbox = document.getElementById('chord-grid-include-inversions-checkbox');
            const cgMasteryInput = document.getElementById('cg-mastery-threshold-input');
            const cgMinAttemptsInput = document.getElementById('cg-min-attempts-input');
            const cgRollingWindowInput = document.getElementById('cg-rolling-average-window-input');
            const cgNonMasteredRateInput = document.getElementById('cg-non-mastered-rate-input');

            if (cgRandomStartCheckbox) cgRandomStartCheckbox.checked = settings.chordGridRandomStart ?? false;
            if (cgInversionsCheckbox) cgInversionsCheckbox.checked = settings.chordGridIncludeInversions ?? true;
            if (cgMasteryInput) cgMasteryInput.value = settings.cgMasteryThreshold ?? 10;
            if (cgMinAttemptsInput) cgMinAttemptsInput.value = settings.cgMinAttempts ?? 5;
            if (cgRollingWindowInput) cgRollingWindowInput.value = settings.cgRollingWindow ?? 3;
            if (cgNonMasteredRateInput) cgNonMasteredRateInput.value = settings.cgNonMasteredRate ?? 80;

            return true;
        } catch (e) {
            console.error('Failed to load settings:', e);
            return false;
        }
    }
    return false;
}

// Helper functions to get current settings values
function getCurrentMasteryThreshold() {
    const input = document.getElementById('chord-mastery-threshold-input');
    return input ? parseFloat(input.value) : masteryThreshold;
}

function getCurrentMinAttemptsForMastery() {
    const input = document.getElementById('chord-min-attempts-input');
    return input ? parseInt(input.value) : minAttemptsForMastery;
}

function getCurrentRollingAverageWindow() {
    const input = document.getElementById('chord-rolling-average-window-input');
    return input ? parseInt(input.value) : rollingAverageWindow;
}

function getCurrentNonMasteredRate() {
    const input = document.getElementById('chord-non-mastered-rate-input');
    return input ? parseInt(input.value) : nonMasteredRate;
}

// Load settings on page load
loadSettings();

// Add event listeners to save settings when changed
document.addEventListener('DOMContentLoaded', () => {
    const settingsInputs = [
        'mastery-threshold-input',
        'min-attempts-input',
        'new-interval-weight-input',
        'rolling-average-window-input',
        'non-mastered-rate-input',
        'display-mode-select',
        'display-mode-select-adaptive',
        'repeat-slow-input',
        'repeat-slow-checkbox',
        'synth-type-select',
        'release-time-input',
        'vary-pitch-checkbox',
        'enable-sound-checkbox',
        'ear-training-checkbox',
        'submit-key-input',
        // Chord-specific settings
        'random-starting-note-checkbox',
        'include-inversions-checkbox',
        'chord-mastery-threshold-input',
        'chord-min-attempts-input',
        'chord-rolling-average-window-input',
        'chord-non-mastered-rate-input',
        // Chord-Grid specific settings
        'chord-grid-random-start-checkbox',
        'chord-grid-include-inversions-checkbox',
        'cg-mastery-threshold-input',
        'cg-min-attempts-input',
        'cg-rolling-average-window-input',
        'cg-non-mastered-rate-input'
    ];

    settingsInputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            const eventType = element.type === 'checkbox' ? 'change' : 'input';
            element.addEventListener(eventType, saveSettings);
        }
    });

    // Load adaptive progress and display stats on page load
    if (!loadAdaptiveProgress()) {
        initializeAdaptiveMode();
    }
    updateAdaptiveStats();

    // Load adaptive chord progress and display stats on page load
    if (!loadAdaptiveChordProgress()) {
        initializeAdaptiveChordMode();
    }
    updateAdaptiveChordStats();

    // Load chord-grid adaptive progress and display stats on page load
    if (!loadCGAdaptiveProgress()) {
        initializeCGAdaptiveMode();
    }
    updateCGStats();
});


// Note: gcd() and reduceFraction() are defined in data/chordTypes.js

// Octave reduce a fraction to [1/2, 2] range (includes reciprocals below 1/1)
function octaveReduce(num, denom) {
    let n = num;
    let d = denom;

    // Reduce to [1/2, 2] - inclusive of 2/1
    while (n / d > 2) {
        d *= 2;
    }
    while (n / d < 0.5) {
        n *= 2;
    }

    return reduceFraction(n, d);
}

// Get prime factorization of a number
function primeFactorization(n) {
    const factors = {};
    let num = n;

    // Handle 2
    while (num % 2 === 0) {
        factors[2] = (factors[2] || 0) + 1;
        num /= 2;
    }

    // Handle odd primes
    for (let i = 3; i <= Math.sqrt(num); i += 2) {
        while (num % i === 0) {
            factors[i] = (factors[i] || 0) + 1;
            num /= i;
        }
    }

    if (num > 2) {
        factors[num] = (factors[num] || 0) + 1;
    }

    return factors;
}

// Get prime factorization of a fraction
function fractionFactorization(num, denom) {
    const numFactors = primeFactorization(num);
    const denomFactors = primeFactorization(denom);

    // Combine: numerator primes are positive, denominator primes are negative
    const combined = {};

    for (const [prime, count] of Object.entries(numFactors)) {
        combined[prime] = count;
    }

    for (const [prime, count] of Object.entries(denomFactors)) {
        combined[prime] = (combined[prime] || 0) - count;
    }

    return combined;
}

// Generate all intervals for a level
function generateIntervals(complexityMin, complexityMax) {
    const intervals = [];
    const limit = 30;

    for (let num = 1; num <= limit; num++) {
        for (let denom = 1; denom <= limit; denom++) {
            if (gcd(num, denom) !== 1) continue; // Only reduced fractions

            // Octave reduce first
            const reduced = octaveReduce(num, denom);

            // Skip unison only
            if (reduced.num === 1 && reduced.denom === 1) continue;

            // Calculate complexity AFTER octave reduction
            const complexity = reduced.num * reduced.denom;
            if (complexity <= complexityMin || complexity > complexityMax) continue;

            // Get prime factorization
            const factorization = fractionFactorization(reduced.num, reduced.denom);

            intervals.push({
                num: reduced.num,
                denom: reduced.denom,
                complexity: complexity,
                factorization: factorization,
                display: `${reduced.num}/${reduced.denom}`
            });
        }
    }

    // Remove duplicates
    const uniqueIntervals = [];
    const seen = new Set();

    for (const interval of intervals) {
        const key = `${interval.num}/${interval.denom}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueIntervals.push(interval);
        }
    }

    return uniqueIntervals;
}

// Shuffle array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Render keyboard legend into a given container element
function renderKeyboardLegendInto(container) {
    if (!container) return;
    container.innerHTML = '';

    const primeKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
    const reciprocalKeys = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'];

    for (const key of primeKeys) {
        if (primeMappings[key]) {
            const ratio = primeMappings[key];
            const div = document.createElement('div');
            div.className = 'legend-item';
            div.innerHTML = `<span class="legend-key">${key}</span><span class="legend-ratio">${ratio.num}/${ratio.denom}</span>`;
            container.appendChild(div);
        }
    }

    for (const key of reciprocalKeys) {
        if (reciprocalMappings[key]) {
            const ratio = reciprocalMappings[key];
            const div = document.createElement('div');
            div.className = 'legend-item';
            div.innerHTML = `<span class="legend-key">${key.toUpperCase()}</span><span class="legend-ratio">${ratio.num}/${ratio.denom}</span>`;
            container.appendChild(div);
        }
    }
}

function renderKeyboardLegend() {
    renderKeyboardLegendInto(keyboardLegendGrid);
}

// Format elapsed time as M:SS.CC
function formatElapsedTime(startTimeMs) {
    const elapsed = (Date.now() - startTimeMs) / 1000;
    const minutes = Math.floor(elapsed / 60);
    const seconds = Math.floor(elapsed % 60);
    const centiseconds = Math.floor((elapsed % 1) * 100);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

// Update timer
function updateTimer() {
    if (!gameActive) return;
    timerEl.textContent = formatElapsedTime(startTime);
}

// Update composition display
function updateCompositionDisplay() {
    // In chord mode, ONLY show current interval being built
    if (gameMode === 'adaptive-chord') {
        if (currentComposition.length === 0) {
            currentCompositionEl.textContent = 'Press keys to build interval...';
            currentCompositionEl.style.color = '#999';
            return;
        }

        const product = multiplyFractions(currentComposition);

        if (currentComposition.length === 1) {
            // Just one interval, show it directly
            currentCompositionEl.innerHTML = `<strong>${product.num}/${product.denom}</strong>`;
        } else {
            // Show the multiplication
            const parts = currentComposition.map(c => `${c.num}/${c.denom}`).join(' × ');
            currentCompositionEl.innerHTML = `${parts} = <strong>${product.num}/${product.denom}</strong>`;
        }
        currentCompositionEl.style.color = '#333';

        // Update piano roll arrow to point at current composition
        updateChordPianoRoll();

        return;
    }

    // Original behavior for interval mode
    if (currentComposition.length === 0) {
        currentCompositionEl.textContent = 'Press keys to build...';
        currentCompositionEl.style.color = '#999';
        return;
    }

    // Show only last two items: previous product and newest input
    const product = multiplyFractions(currentComposition);
    const newest = currentComposition[currentComposition.length - 1];

    if (currentComposition.length === 1) {
        // Only one item, just show it
        currentCompositionEl.innerHTML = `<strong>${newest.num}/${newest.denom}</strong>`;
    } else {
        // Show previous product × newest = current product
        const previousProduct = multiplyFractions(currentComposition.slice(0, -1));
        currentCompositionEl.innerHTML = `${previousProduct.num}/${previousProduct.denom} × ${newest.num}/${newest.denom} = <strong>${product.num}/${product.denom}</strong>`;
    }

    currentCompositionEl.style.color = '#333';
}

// Multiply array of fractions
function multiplyFractions(fractions) {
    if (fractions.length === 0) return { num: 1, denom: 1 };

    let num = 1;
    let denom = 1;

    for (const frac of fractions) {
        num *= frac.num;
        denom *= frac.denom;
    }

    return reduceFraction(num, denom);
}

// Check if composition matches target
function checkAnswer() {
    const product = multiplyFractions(currentComposition);
    return product.num === currentInterval.num && product.denom === currentInterval.denom;
}

// Handle keypress
document.addEventListener('keydown', (e) => {
    if (!gameActive) return;

    const key = e.key.toLowerCase();

    // Handle chord mode separately
    if (gameMode === 'adaptive-chord') {
        handleChordKeypress(e, key);
        return;
    }

    // Backspace - clear composition
    if (key === 'backspace') {
        e.preventDefault();
        currentComposition = [];
        updateCompositionDisplay();
        return;
    }

    // Submit key - check answer
    if (key === submitKey.toLowerCase()) {
        e.preventDefault();
        if (currentComposition.length === 0) return;

        // Check if correct
        if (checkAnswer()) {
            handleCorrectAnswer();
        } else {
            // Wrong answer
            const product = multiplyFractions(currentComposition);
            feedbackEl.textContent = `Wrong! You entered ${product.num}/${product.denom}, target is ${currentInterval.num}/${currentInterval.denom}`;
            feedbackEl.className = 'feedback incorrect';
            feedbackEl.style.background = '#f8d7da';
            feedbackEl.style.color = '#721c24';
        }
        return;
    }

    // Check if key is mapped
    if (allMappings[key]) {
        e.preventDefault();

        // Add to composition
        currentComposition.push(allMappings[key]);
        updateCompositionDisplay();
    }
});

// Check if two interval sets match (unordered)
function intervalsMatch(entered, expected) {
    // Both arrays should have the same length
    if (entered.length !== expected.length) return false;

    // Create copies to avoid modifying originals
    const enteredCopy = entered.map(e => `${e.num}/${e.denom}`);
    const expectedCopy = expected.map(e => `${e.num}/${e.denom}`);

    // Sort both arrays
    enteredCopy.sort();
    expectedCopy.sort();

    // Compare element by element
    for (let i = 0; i < enteredCopy.length; i++) {
        if (enteredCopy[i] !== expectedCopy[i]) return false;
    }

    return true;
}

// Handle chord mode keypress
function handleChordKeypress(e, key) {
    // Use the globally stored expected intervals (accounts for starting position transformation)
    const expectedIntervals = currentExpectedIntervals.length > 0 ? currentExpectedIntervals : CHORD_TYPES[currentChord];

    // Backspace - RESET ENTIRE CHORD (keep 1/1 auto-placed)
    if (key === 'backspace') {
        e.preventDefault();
        currentComposition = [{ num: 1, denom: 1 }];
        chordProgress = [{ num: 1, denom: 1 }];
        updateCompositionDisplay(); // This now updates piano roll automatically
        resetChordIntervalHighlights();
        markIntervalCorrect('1/1');
        feedbackEl.textContent = '';
        feedbackEl.className = 'feedback';
        feedbackEl.style.background = '';
        feedbackEl.style.color = '';
        return;
    }

    // Submit key (`) - check if interval is correct
    if (key === submitKey.toLowerCase()) {
        e.preventDefault();

        // Get the current interval
        const product = multiplyFractions(currentComposition);
        const intervalKey = `${product.num}/${product.denom}`;

        // Check if this interval is one of the expected intervals
        const expectedSet = new Set(expectedIntervals.map(i => `${i.num}/${i.denom}`));
        const alreadyEnteredSet = new Set(chordProgress.map(i => `${i.num}/${i.denom}`));

        if (expectedSet.has(intervalKey) && !alreadyEnteredSet.has(intervalKey)) {
            // CORRECT interval!
            chordProgress.push(product);

            // Mark the interval as correct (green + wiggle)
            markIntervalCorrect(intervalKey);

            // Update piano roll visualization
            updateChordPianoRoll();

            // Play single tone for this interval
            playSingleTone(product.num, product.denom);

            // Reset to 1/1 for next interval
            currentComposition = [{ num: 1, denom: 1 }];
            updateCompositionDisplay();

            // Check if chord is complete
            const isLastInterval = chordProgress.length === expectedIntervals.length;

            if (isLastInterval) {
                // Track timing
                const timeTaken = (Date.now() - questionStartTime) / 1000;
                questionCount++;
                totalTime += timeTaken;

                // Track stats for adaptive chord mode
                if (gameMode === 'adaptive-chord' && currentChord) {
                    if (chordStats[currentChord]) {
                        chordStats[currentChord].attempts++;
                        chordStats[currentChord].totalTime += timeTaken;
                        chordStats[currentChord].recentTimes.push(timeTaken);
                        // Keep only the configured number of recent attempts
                        const currentWindow = getCurrentRollingAverageWindow();
                        if (chordStats[currentChord].recentTimes.length > currentWindow) {
                            chordStats[currentChord].recentTimes.shift();
                        }
                    }
                }

                // Update score display
                questionCountEl.textContent = questionCount;
                avgTimeEl.textContent = (totalTime / questionCount).toFixed(2) + 's';

                // Show feedback after 300ms (after last note finishes)
                setTimeout(() => {
                    feedbackEl.textContent = `Correct! (${timeTaken.toFixed(2)}s)`;
                    feedbackEl.className = 'feedback correct';

                    // Play the entire chord (all intervals together)
                    playChordAudio(expectedIntervals);
                }, 300);

                // Check for unlocking new chord in adaptive chord mode
                if (gameMode === 'adaptive-chord') {
                    // Increment tutorial index if tutorial is active
                    if (chordTutorialActive && chordTutorialIndex < chordTutorialSequence.length) {
                        chordTutorialIndex++;
                        saveAdaptiveChordProgress(); // Save tutorial progress
                    }

                    // If we're drilling a new chord, increment the drill count
                    if (currentNewChord && currentChord === currentNewChord) {
                        newChordDrillCount++;

                        // If drill is complete, add chord to active pool
                        if (newChordDrillCount >= newChordDrillTarget) {
                            const chordToAdd = allChordsSorted.find(c => c.key === currentNewChord);
                            if (chordToAdd) {
                                activeChords.push(chordToAdd);

                                // Show completion message
                                const addedPosInfo = chordToAdd.positionLabel ? ` ${chordToAdd.positionLabel}` : '';
                                setTimeout(() => {
                                    feedbackEl.innerHTML = `<strong>✓ Drill complete!</strong><br>${chordToAdd.name}${addedPosInfo} has been added to the mix!`;
                                    feedbackEl.className = 'feedback';
                                    feedbackEl.style.background = '#d4edda';
                                    feedbackEl.style.color = '#155724';
                                }, 1400);
                            }

                            // Reset drill tracking
                            currentNewChord = null;
                            newChordDrillCount = 0;
                            adaptiveChordLevel = countBaseChords(activeChords);
                            updateGameChordLevelDisplay();
                            saveAdaptiveChordProgress();

                            // Update progress display
                            updateGameChordProgress();
                        } else {
                            // Update feedback to show drill progress
                            setTimeout(() => {
                                feedbackEl.innerHTML = `Drill progress: ${newChordDrillCount}/${newChordDrillTarget}`;
                                feedbackEl.className = 'feedback';
                                feedbackEl.style.background = '#fff3cd';
                                feedbackEl.style.color = '#856404';
                            }, 1400);

                            // Update progress display
                            updateGameChordProgress();
                        }
                    } else {
                        // Normal mastery checking
                        checkAndUnlockNextChord();

                        // Update progress display
                        updateGameChordProgress();
                    }
                }

                // Wait for last note (300ms) + chord sound + wiggle, then move to next question
                setTimeout(() => {
                    nextAdaptiveChordQuestion();
                }, 1300); // 300ms (last note) + 600ms (wiggle) + 400ms (chord sound)
            }
        } else {
            // WRONG interval - play the wrong note, then reset entire chord (keep 1/1 auto-placed)
            playSingleTone(product.num, product.denom);

            currentComposition = [{ num: 1, denom: 1 }];
            chordProgress = [{ num: 1, denom: 1 }];
            updateCompositionDisplay(); // This now updates piano roll automatically
            resetChordIntervalHighlights();
            markIntervalCorrect('1/1');

            // Reset drill count if wrong answer during drilling (must be X in a row)
            if (gameMode === 'adaptive-chord' && currentNewChord && currentChord === currentNewChord) {
                newChordDrillCount = 0;
                saveAdaptiveChordProgress();
                feedbackEl.textContent = `Wrong interval! Drill reset - you need ${newChordDrillTarget} correct in a row. Expected one of: ${[...expectedSet].filter(i => !alreadyEnteredSet.has(i)).join(', ')}`;
            } else {
                feedbackEl.textContent = `Wrong interval! Expected one of: ${[...expectedSet].filter(i => !alreadyEnteredSet.has(i)).join(', ')}`;
            }

            feedbackEl.className = 'feedback incorrect';
            feedbackEl.style.background = '#f8d7da';
            feedbackEl.style.color = '#721c24';

            // Clear error message and styling after 2 seconds
            setTimeout(() => {
                feedbackEl.textContent = '';
                feedbackEl.className = 'feedback';
                feedbackEl.style.background = '';
                feedbackEl.style.color = '';
            }, 2000);
        }
        return;
    }

    // Add to current interval composition (multiply)
    if (allMappings[key]) {
        e.preventDefault();
        currentComposition.push(allMappings[key]);
        updateCompositionDisplay();
    }
}

// Mark an interval as correctly entered (green + wiggle animation)
function markIntervalCorrect(intervalKey) {
    const spans = document.querySelectorAll('.chord-interval');
    spans.forEach(span => {
        if (span.dataset.interval === intervalKey) {
            span.style.color = 'green';
            span.style.fontWeight = 'bold';
            span.classList.add('wiggle');

            // Remove wiggle class after animation
            setTimeout(() => {
                span.classList.remove('wiggle');
            }, 600);
        }
    });
}

// Reset all interval highlights to default
function resetChordIntervalHighlights() {
    const spans = document.querySelectorAll('.chord-interval');
    spans.forEach(span => {
        span.style.color = '';
        span.style.fontWeight = '';
        span.classList.remove('wiggle');
    });
}

// ===== PIANO ROLL VISUALIZATION =====

// Convert intervals to MIDI note numbers
function intervalsToMIDI(intervals, baseNote = 60) {
    return intervals.map(interval => {
        const ratio = interval.num / interval.denom;
        const semitones = 12 * Math.log2(ratio);
        return Math.round(baseNote + semitones);
    });
}

// Render piano roll visualization for a chord (vertical MIDI-style)
function renderChordPianoRoll(chordKey, enteredIntervals = [], currentCompositionValue = null) {
    const container = document.getElementById('chord-piano-roll');
    if (!container) return;

    // Use the globally stored expected intervals (accounts for starting position transformation)
    const intervals = currentExpectedIntervals.length > 0 ? currentExpectedIntervals : CHORD_TYPES[chordKey];
    if (!intervals) return;

    // Calculate continuous positions in octaves for each interval
    const positions = intervals.map(interval => {
        const ratio = interval.num / interval.denom;
        return Math.log2(ratio); // Position in octaves from 1/1
    });

    // Find range for scaling
    const minPos = Math.min(...positions);
    const maxPos = Math.max(...positions);

    // Add padding (in octaves)
    const padding = 0.25; // Quarter octave padding
    const paddedMin = minPos - padding;
    const paddedMax = maxPos + padding;
    const totalRange = paddedMax - paddedMin;

    // SVG dimensions
    const pixelsPerOctave = 100; // Pixels per octave
    const height = totalRange * pixelsPerOctave;
    const arrowWidth = 25;
    const noteWidth = 80;
    const barHeight = 10; // Height of each note bar
    const width = arrowWidth + noteWidth + 5;

    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;

    // Create a set of entered intervals for lookup
    const enteredSet = new Set(enteredIntervals.map(i => `${i.num}/${i.denom}`));

    // Draw each interval bar
    intervals.forEach((interval, index) => {
        const pos = positions[index];

        // Y position (inverted - higher pitch at top)
        const normalizedPos = (pos - paddedMin) / totalRange;
        const y = height - (normalizedPos * height) - barHeight / 2;

        const isEntered = enteredSet.has(`${interval.num}/${interval.denom}`);
        const color = isEntered ? '#4caf50' : '#999';

        svg += `<rect x="${arrowWidth}" y="${y}" width="${noteWidth}" height="${barHeight}"
                fill="${color}" stroke="#000" stroke-width="1" rx="2"/>`;
    });

    // Draw arrow pointing at the current composition value
    if (currentCompositionValue) {
        const currentRatio = currentCompositionValue.num / currentCompositionValue.denom;
        const currentPos = Math.log2(currentRatio);
        const normalizedPos = (currentPos - paddedMin) / totalRange;
        const arrowY = height - (normalizedPos * height);

        // Arrow pointing right
        svg += `<path d="M ${arrowWidth - 5} ${arrowY} L 5 ${arrowY - 6} L 5 ${arrowY + 6} Z"
                fill="#4caf50" class="root-arrow"/>`;
    }

    svg += '</svg>';

    container.innerHTML = svg;
}

// Update piano roll as intervals are entered
function updateChordPianoRoll() {
    if (gameMode !== 'adaptive-chord') return;
    const currentValue = multiplyFractions(currentComposition);
    renderChordPianoRoll(currentChord, chordProgress, currentValue);
}

// Handle correct answer
function handleCorrectAnswer() {
    const timeTaken = (Date.now() - questionStartTime) / 1000;
    questionCount++;
    totalTime += timeTaken;

    // Track stats for adaptive interval mode
    if (gameMode === 'adaptive' && currentInterval) {
        const key = `${currentInterval.num}/${currentInterval.denom}`;
        if (intervalStats[key]) {
            intervalStats[key].attempts++;
            intervalStats[key].totalTime += timeTaken;
            intervalStats[key].recentTimes.push(timeTaken);
            // Keep only the configured number of recent attempts
            if (intervalStats[key].recentTimes.length > rollingAverageWindow) {
                intervalStats[key].recentTimes.shift();
            }
        }
    }

    // Track stats for adaptive chord mode (skip during drill phase — drill times shouldn't count toward mastery)
    if (gameMode === 'adaptive-chord' && currentChord) {
        const isDrilling = currentNewChord && currentChord === currentNewChord && newChordDrillCount < newChordDrillTarget;
        if (!isDrilling && chordStats[currentChord]) {
            chordStats[currentChord].attempts++;
            chordStats[currentChord].totalTime += timeTaken;
            chordStats[currentChord].recentTimes.push(timeTaken);
            // Keep only the configured number of recent attempts
            if (chordStats[currentChord].recentTimes.length > rollingAverageWindow) {
                chordStats[currentChord].recentTimes.shift();
            }
        }
    }

    // Update score display
    questionCountEl.textContent = questionCount;
    avgTimeEl.textContent = (totalTime / questionCount).toFixed(2) + 's';

    // Show feedback
    feedbackEl.textContent = `Correct! (${timeTaken.toFixed(2)}s)`;
    feedbackEl.className = 'feedback correct';

    // Play success sound
    playSound('excellent');

    // Check for unlocking new interval in adaptive mode
    if (gameMode === 'adaptive') {
        // Increment tutorial index if tutorial is active
        if (tutorialActive && tutorialIndex < tutorialSequence.length) {
            tutorialIndex++;
            saveAdaptiveProgress(); // Save tutorial progress
        }

        checkAndUnlockNextInterval();
    }

    // Check for unlocking new chord in adaptive chord mode
    if (gameMode === 'adaptive-chord') {
        // Increment tutorial index if tutorial is active
        if (chordTutorialActive && chordTutorialIndex < chordTutorialSequence.length) {
            chordTutorialIndex++;
            saveAdaptiveChordProgress(); // Save tutorial progress
        }

        checkAndUnlockNextChord();
    }

    // Wait a bit then move to next question
    setTimeout(() => {
        if (gameMode === 'adaptive') {
            nextAdaptiveQuestion();
        } else if (gameMode === 'adaptive-chord') {
            nextAdaptiveChordQuestion();
        }
    }, 800);
}

// Skip button
skipBtn.addEventListener('click', () => {
    feedbackEl.textContent = `Skipped. The answer was: ${getCorrectFactorization()}`;
    feedbackEl.className = 'feedback';
    feedbackEl.style.background = '#fff3cd';
    feedbackEl.style.color = '#856404';

    setTimeout(() => {
        if (gameMode === 'adaptive') {
            nextAdaptiveQuestion();
        } else if (gameMode === 'adaptive-chord') {
            nextAdaptiveChordQuestion();
        }
    }, 2000);
});

// Get correct factorization as string
function getCorrectFactorization() {
    // This is complex - for now just show the target
    return `(see factorization of ${currentInterval.display})`;
}

// ===== ADAPTIVE MODE FUNCTIONS =====

// Initialize adaptive mode with all intervals sorted by complexity
function initializeAdaptiveMode() {
    // Generate all intervals (complexity 0-900)
    const allIntervals = generateIntervals(0, 900);

    // Separate ascending and descending intervals
    const ascendingIntervals = allIntervals.filter(i => i.num / i.denom >= 1);
    const descendingIntervals = allIntervals.filter(i => i.num / i.denom < 1);

    // Sort ascending by complexity, then add descending pairs after their ascending counterparts
    ascendingIntervals.sort((a, b) => a.complexity - b.complexity);

    allIntervalsSorted = [];
    const descendingMap = new Map();

    // Create map of descending intervals by their ascending counterpart
    for (const desc of descendingIntervals) {
        const ascKey = `${desc.denom}/${desc.num}`; // reciprocal
        descendingMap.set(ascKey, desc);
    }

    // Build sorted list: ascending interval followed by its descending counterpart (if exists)
    for (const asc of ascendingIntervals) {
        const ascKey = `${asc.num}/${asc.denom}`;
        allIntervalsSorted.push(asc);

        // Add descending counterpart immediately after if it exists
        if (descendingMap.has(ascKey)) {
            allIntervalsSorted.push(descendingMap.get(ascKey));
            descendingMap.delete(ascKey); // Mark as added
        }
    }

    // Add any remaining descending intervals that didn't have ascending counterparts
    for (const desc of descendingMap.values()) {
        allIntervalsSorted.push(desc);
    }

    // Initialize stats for all intervals
    intervalStats = {};
    for (const interval of allIntervalsSorted) {
        const key = `${interval.num}/${interval.denom}`;
        intervalStats[key] = {
            attempts: 0,
            totalTime: 0,
            recentTimes: [],
            mastered: false,
            lastSeenQuestion: -1,
            interval: interval
        };
    }

    // Start with prime harmonics (ascending only)
    const startingIntervals = ['2/1', '3/2', '5/4', '7/4', '11/8'];
    activeIntervals = [];
    for (const key of startingIntervals) {
        const interval = allIntervalsSorted.find(i => `${i.num}/${i.denom}` === key);
        if (interval) {
            activeIntervals.push(interval);
        }
    }

    // Set level to match number of active intervals (minus initial 4, but we start with 5 now)
    adaptiveLevel = activeIntervals.length - 4;

    // Save to localStorage
    saveAdaptiveProgress();
}

// Load adaptive progress from localStorage
function loadAdaptiveProgress() {
    const saved = localStorage.getItem('ji_adaptive_progress');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            intervalStats = data.intervalStats || {};
            activeIntervals = data.activeIntervals || [];
            adaptiveLevel = data.adaptiveLevel || 1;
            tutorialIndex = data.tutorialIndex !== undefined ? data.tutorialIndex : 0;
            tutorialActive = data.tutorialActive !== undefined ? data.tutorialActive : true;

            // Reconstruct interval objects with proper ordering (ascending first, then descending)
            const allIntervals = generateIntervals(0, 900);

            // Separate ascending and descending intervals
            const ascendingIntervals = allIntervals.filter(i => i.num / i.denom >= 1);
            const descendingIntervals = allIntervals.filter(i => i.num / i.denom < 1);

            // Sort ascending by complexity
            ascendingIntervals.sort((a, b) => a.complexity - b.complexity);

            allIntervalsSorted = [];
            const descendingMap = new Map();

            // Create map of descending intervals by their ascending counterpart
            for (const desc of descendingIntervals) {
                const ascKey = `${desc.denom}/${desc.num}`; // reciprocal
                descendingMap.set(ascKey, desc);
            }

            // Build sorted list: ascending interval followed by its descending counterpart (if exists)
            for (const asc of ascendingIntervals) {
                const ascKey = `${asc.num}/${asc.denom}`;
                allIntervalsSorted.push(asc);

                // Add descending counterpart immediately after if it exists
                if (descendingMap.has(ascKey)) {
                    allIntervalsSorted.push(descendingMap.get(ascKey));
                    descendingMap.delete(ascKey); // Mark as added
                }
            }

            // Add any remaining descending intervals that didn't have ascending counterparts
            for (const desc of descendingMap.values()) {
                allIntervalsSorted.push(desc);
            }

            // Restore interval references in stats
            for (const key in intervalStats) {
                const interval = allIntervalsSorted.find(i => `${i.num}/${i.denom}` === key);
                if (interval) {
                    intervalStats[key].interval = interval;
                }
            }

            // Restore activeIntervals with full interval objects
            activeIntervals = activeIntervals.map(key => {
                const interval = allIntervalsSorted.find(i => `${i.num}/${i.denom}` === (key.num ? `${key.num}/${key.denom}` : key));
                return interval;
            }).filter(i => i);

            // Sync level with number of active intervals (minus initial 4)
            adaptiveLevel = activeIntervals.length - 4;

            return true;
        } catch (e) {
            console.error('Failed to load adaptive progress:', e);
            return false;
        }
    }
    return false;
}

// Save adaptive progress to localStorage
function saveAdaptiveProgress() {
    const data = {
        intervalStats: intervalStats,
        activeIntervals: activeIntervals.map(i => ({ num: i.num, denom: i.denom })),
        adaptiveLevel: adaptiveLevel,
        tutorialIndex: tutorialIndex,
        tutorialActive: tutorialActive
    };
    localStorage.setItem('ji_adaptive_progress', JSON.stringify(data));
}

// Reset adaptive progress
function resetAdaptiveProgress() {
    if (confirm('Are you sure you want to reset all adaptive mode progress?')) {
        localStorage.removeItem('ji_adaptive_progress');
        tutorialIndex = 0;
        tutorialActive = true;
        initializeAdaptiveMode();
        updateAdaptiveStats();
        updateAdaptiveLevelDisplay();
        alert('Progress reset! You can now start fresh.');
    }
}

// Resume from specific level
function resumeFromLevel(targetLevel) {
    if (targetLevel < 1) {
        alert('Level must be 1 or higher');
        return;
    }

    // Convert level to number of intervals (level 1 = 5 intervals, level 2 = 6 intervals, etc.)
    let numIntervals = targetLevel + 4;

    // Generate all intervals with proper ordering (ascending first, then descending)
    const allIntervals = generateIntervals(0, 900);

    // Separate ascending and descending intervals
    const ascendingIntervals = allIntervals.filter(i => i.num / i.denom >= 1);
    const descendingIntervals = allIntervals.filter(i => i.num / i.denom < 1);

    // Sort ascending by complexity
    ascendingIntervals.sort((a, b) => a.complexity - b.complexity);

    allIntervalsSorted = [];
    const descendingMap = new Map();

    // Create map of descending intervals by their ascending counterpart
    for (const desc of descendingIntervals) {
        const ascKey = `${desc.denom}/${desc.num}`; // reciprocal
        descendingMap.set(ascKey, desc);
    }

    // Build sorted list: ascending interval followed by its descending counterpart (if exists)
    for (const asc of ascendingIntervals) {
        const ascKey = `${asc.num}/${asc.denom}`;
        allIntervalsSorted.push(asc);

        // Add descending counterpart immediately after if it exists
        if (descendingMap.has(ascKey)) {
            allIntervalsSorted.push(descendingMap.get(ascKey));
            descendingMap.delete(ascKey); // Mark as added
        }
    }

    // Add any remaining descending intervals that didn't have ascending counterparts
    for (const desc of descendingMap.values()) {
        allIntervalsSorted.push(desc);
    }

    if (numIntervals > allIntervalsSorted.length) {
        alert(`Maximum level is ${allIntervalsSorted.length - 4}. Setting to maximum.`);
        numIntervals = allIntervalsSorted.length;
    }

    // Initialize stats
    intervalStats = {};
    for (const interval of allIntervalsSorted) {
        const key = `${interval.num}/${interval.denom}`;
        intervalStats[key] = {
            attempts: 0,
            totalTime: 0,
            recentTimes: [],
            mastered: false,
            lastSeenQuestion: -1,
            interval: interval
        };
    }

    // Populate with the first numIntervals from allIntervalsSorted
    activeIntervals = [];
    for (let i = 0; i < Math.min(numIntervals, allIntervalsSorted.length); i++) {
        const interval = allIntervalsSorted[i];
        activeIntervals.push(interval);

        const intervalKey = `${interval.num}/${interval.denom}`;
        if (intervalStats[intervalKey]) {
            // Mark earlier ones as mastered, leave the last few unmastered
            if (i < numIntervals - 2) {
                intervalStats[intervalKey].mastered = true;
                intervalStats[intervalKey].attempts = 10;
                intervalStats[intervalKey].totalTime = 10;
                intervalStats[intervalKey].recentTimes = [1, 1, 1, 1, 1];
            } else {
                // Leave as unmastered for recent intervals
                intervalStats[intervalKey].mastered = false;
                intervalStats[intervalKey].attempts = 2;
                intervalStats[intervalKey].totalTime = 6;
                intervalStats[intervalKey].recentTimes = [3, 3];
            }
        }
    }

    // Set the level to match the number of intervals (minus initial 4)
    adaptiveLevel = activeIntervals.length - 4;

    // Skip tutorial if resuming from a level > 1 (which means > 5 intervals)
    if (targetLevel > 5) {
        tutorialIndex = tutorialSequence.length;
        tutorialActive = false;
    } else {
        tutorialIndex = 0;
        tutorialActive = true;
    }

    // Save progress
    saveAdaptiveProgress();

    // Update UI
    updateAdaptiveStats();
    updateAdaptiveLevelDisplay();

    alert(`Progress restored to ${activeIntervals.length} intervals!`);
}

// Start adaptive game
function startAdaptiveGame() {
    // Read settings
    const masteryInput = document.getElementById('mastery-threshold-input');
    const minAttemptsInput = document.getElementById('min-attempts-input');
    const weightInput = document.getElementById('new-interval-weight-input');
    const rollingWindowInput = document.getElementById('rolling-average-window-input');
    const nonMasteredRateInput = document.getElementById('non-mastered-rate-input');
    const displayModeSelect = document.getElementById('display-mode-select');

    masteryThreshold = masteryInput ? parseFloat(masteryInput.value) : 2;
    minAttemptsForMastery = minAttemptsInput ? parseInt(minAttemptsInput.value) : 5;
    newIntervalWeight = weightInput ? parseInt(weightInput.value) : 3;
    rollingAverageWindow = rollingWindowInput ? parseInt(rollingWindowInput.value) : 10;
    nonMasteredRate = nonMasteredRateInput ? parseInt(nonMasteredRateInput.value) : 60;

    // Check adaptive mode display selector first, fallback to main selector
    const displayModeSelectAdaptive = document.getElementById('display-mode-select-adaptive');
    const effectiveDisplaySelect = displayModeSelectAdaptive || displayModeSelect;

    if (effectiveDisplaySelect) {
        displayMode = effectiveDisplaySelect.value;
        currentRotationIndex = 0; // Reset rotation when starting new game
    }

    // Save settings
    saveSettings();

    // Load or initialize
    if (!loadAdaptiveProgress()) {
        initializeAdaptiveMode();
    }

    if (activeIntervals.length === 0) {
        alert('No intervals available! Resetting...');
        initializeAdaptiveMode();
    }

    // Reset game state
    gameActive = true;
    gameMode = 'adaptive';
    questionCount = 0;
    totalTime = 0;
    currentComposition = [];
    lastInterval = null; // Reset to allow any first interval
    globalQuestionCounter = 0; // Reset question counter for guaranteed appearance

    // Start timer
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 100);

    // Render keyboard legend
    renderKeyboardLegend();

    // Show adaptive level indicator
    const levelIndicator = document.getElementById('adaptive-level-indicator');
    if (levelIndicator) {
        levelIndicator.style.display = 'flex';
        updateGameLevelDisplay();
    }

    // Show game panel
    showGame();

    // Update interval progress display
    updateGameIntervalProgress();

    // Start first question
    nextAdaptiveQuestion();
}

// Select weighted random interval based on rolling average times
function selectWeightedRandomInterval() {
    if (activeIntervals.length === 0) return null;

    const n = activeIntervals.length;
    const guaranteedWindow = 3 * n; // Every interval must appear within 3n questions

    // Check for intervals that MUST appear (haven't appeared in 3n questions)
    const mustAppearIntervals = [];
    for (const interval of activeIntervals) {
        const key = `${interval.num}/${interval.denom}`;
        const stats = intervalStats[key];

        if (stats) {
            const questionsSinceLastSeen = globalQuestionCounter - stats.lastSeenQuestion;
            if (stats.lastSeenQuestion === -1 || questionsSinceLastSeen >= guaranteedWindow) {
                mustAppearIntervals.push(interval);
            }
        }
    }

    // If there are intervals that must appear, select randomly from them
    if (mustAppearIntervals.length > 0) {
        const randomIndex = Math.floor(Math.random() * mustAppearIntervals.length);
        return mustAppearIntervals[randomIndex];
    }

    // Otherwise, use weighted random selection
    // Calculate weights for each interval
    const intervalWeights = [];
    let totalWeight = 0;

    // Count mastered vs non-mastered intervals
    let masteredCount = 0;
    let nonMasteredCount = 0;

    for (const interval of activeIntervals) {
        const key = `${interval.num}/${interval.denom}`;
        const stats = intervalStats[key];

        if (stats && stats.mastered) {
            masteredCount++;
        } else {
            nonMasteredCount++;
        }
    }

    // Calculate base weights to achieve desired non-mastered rate
    const targetRatio = nonMasteredRate / 100;
    const nonMasteredBaseWeight = 10;
    const masteredBaseWeight = masteredCount > 0 && targetRatio < 1
        ? (nonMasteredBaseWeight * nonMasteredCount * (1 - targetRatio)) / (targetRatio * masteredCount)
        : 1;

    // Find the most recently added interval
    const newestInterval = activeIntervals[activeIntervals.length - 1];
    const newestKey = `${newestInterval.num}/${newestInterval.denom}`;

    for (const interval of activeIntervals) {
        const key = `${interval.num}/${interval.denom}`;
        const stats = intervalStats[key];

        let weight;

        if (key === newestKey) {
            // Newest interval gets extra weight
            weight = nonMasteredBaseWeight * newIntervalWeight;
        } else if (stats && stats.mastered) {
            // Mastered intervals get lower weight
            weight = masteredBaseWeight;
        } else if (stats && stats.recentTimes.length > 0) {
            // Non-mastered intervals: weight based on rolling average time
            // Higher average time = higher weight (more practice needed)
            const avgTime = stats.recentTimes.reduce((a, b) => a + b, 0) / stats.recentTimes.length;
            // Weight increases with average time, scaled by base weight
            weight = nonMasteredBaseWeight * (1 + avgTime / masteryThreshold);
        } else {
            // No attempts yet, use base non-mastered weight
            weight = nonMasteredBaseWeight;
        }

        intervalWeights.push({ interval, weight });
        totalWeight += weight;
    }

    // Select random interval based on weights
    let random = Math.random() * totalWeight;
    for (const item of intervalWeights) {
        random -= item.weight;
        if (random <= 0) {
            return item.interval;
        }
    }

    // Fallback to last interval (shouldn't happen)
    return intervalWeights[intervalWeights.length - 1].interval;
}

// Next adaptive question
function nextAdaptiveQuestion() {
    // Check if tutorial is active and we're still in the tutorial sequence
    if (tutorialActive && tutorialIndex < tutorialSequence.length) {
        const tutorialKey = tutorialSequence[tutorialIndex];
        currentInterval = allIntervalsSorted.find(i => `${i.num}/${i.denom}` === tutorialKey);

        if (!currentInterval) {
            console.error(`Tutorial interval ${tutorialKey} not found`);
            // Fall back to normal selection
            tutorialActive = false;
        }
    } else {
        // Tutorial complete, use normal selection
        tutorialActive = false;

        // Select interval using weighted random selection
        let attempts = 0;
        const maxAttempts = 50;

        do {
            currentInterval = selectWeightedRandomInterval();
            attempts++;

            // If we have more than one interval available and this matches the last one, try again
            if (activeIntervals.length > 1 && lastInterval &&
                currentInterval.num === lastInterval.num &&
                currentInterval.denom === lastInterval.denom) {
                continue;
            }
            break;
        } while (attempts < maxAttempts);
    }

    if (!currentInterval) {
        console.error('Failed to select an interval');
        return;
    }

    // Update tracking for selected interval
    const selectedKey = `${currentInterval.num}/${currentInterval.denom}`;
    if (intervalStats[selectedKey]) {
        intervalStats[selectedKey].lastSeenQuestion = globalQuestionCounter;
    }

    // Increment global question counter
    globalQuestionCounter++;

    // Store as last interval
    lastInterval = { num: currentInterval.num, denom: currentInterval.denom };

    // Increment rotation index for next question (if in rotation mode)
    if (displayMode.startsWith('rotate-')) {
        currentRotationIndex++;
    }

    // Display target using the display mode (or hide for ear training)
    if (earTrainingMode) {
        targetIntervalEl.innerHTML = '<div style="font-size: 0.6em; color: #999;">🎵 Ear Training Mode</div>';
    } else {
        targetIntervalEl.innerHTML = formatIntervalDisplay(currentInterval.num, currentInterval.denom);
    }

    // Reset composition
    currentComposition = [];
    updateCompositionDisplay();

    // Clear feedback
    feedbackEl.textContent = '';
    feedbackEl.className = 'feedback';

    // Update interval progress display
    updateGameIntervalProgress();

    // Start question timer
    questionStartTime = Date.now();

    // Play interval audio
    playIntervalAudio(currentInterval.num, currentInterval.denom);
}

// Check and unlock next interval
function checkAndUnlockNextInterval() {
    // Check if all active intervals are mastered
    let allMastered = true;
    for (const interval of activeIntervals) {
        const key = `${interval.num}/${interval.denom}`;
        const stats = intervalStats[key];

        if (!stats) continue;

        // Calculate average of recent times
        const avgRecent = stats.recentTimes.length > 0
            ? stats.recentTimes.reduce((a, b) => a + b, 0) / stats.recentTimes.length
            : 999;

        // Check mastery criteria
        const isMastered = stats.attempts >= minAttemptsForMastery && avgRecent < masteryThreshold;
        stats.mastered = isMastered;

        if (!isMastered) {
            allMastered = false;
        }
    }

    // If all mastered, unlock next interval
    if (allMastered && activeIntervals.length < allIntervalsSorted.length) {
        // Find next interval not in active set
        const activeKeys = new Set(activeIntervals.map(i => `${i.num}/${i.denom}`));
        const nextInterval = allIntervalsSorted.find(i => !activeKeys.has(`${i.num}/${i.denom}`));

        if (nextInterval) {
            activeIntervals.push(nextInterval);
            const key = `${nextInterval.num}/${nextInterval.denom}`;

            // Update level to match number of active intervals (minus initial 4)
            adaptiveLevel = activeIntervals.length - 4;
            updateGameLevelDisplay();

            // Show notification
            feedbackEl.innerHTML = `<strong>🎉 Level ${adaptiveLevel}! New interval unlocked!</strong><br>${nextInterval.num}/${nextInterval.denom} (${getIntervalName(nextInterval.num, nextInterval.denom) || 'Complexity: ' + nextInterval.complexity})`;
            feedbackEl.className = 'feedback';
            feedbackEl.style.background = '#d1ecf1';
            feedbackEl.style.color = '#0c5460';

            // Update interval progress display with new interval
            updateGameIntervalProgress();

            // Save progress (no need to rebuild pool - using weighted random selection)
            saveAdaptiveProgress();
        }
    }

    // Save progress periodically
    if (questionCount % 5 === 0) {
        saveAdaptiveProgress();
    }
}

// Update adaptive level display in settings panel
function updateAdaptiveLevelDisplay() {
    const levelNumberEl = document.getElementById('adaptive-level-number');
    if (levelNumberEl) {
        levelNumberEl.textContent = adaptiveLevel;
    }
}

// Update game interval progress display
function updateGameIntervalProgress() {
    const progressContainer = document.getElementById('game-interval-progress');
    const progressStats = document.getElementById('game-progress-stats');

    if (!progressContainer || !progressStats) return;

    // Only show in adaptive mode
    if (gameMode !== 'adaptive') {
        progressContainer.style.display = 'none';
        return;
    }

    progressContainer.style.display = 'block';

    // Build stats HTML
    let html = '';

    for (const interval of activeIntervals) {
        const key = `${interval.num}/${interval.denom}`;
        const stats = intervalStats[key];

        if (!stats) continue;

        const avgRecent = stats.recentTimes.length > 0
            ? (stats.recentTimes.reduce((a, b) => a + b, 0) / stats.recentTimes.length).toFixed(2)
            : 'N/A';

        const isMastered = stats.attempts >= minAttemptsForMastery && avgRecent !== 'N/A' && parseFloat(avgRecent) < masteryThreshold;

        // Calculate cents and get interval name
        const cents = (1200 * Math.log2(interval.num / interval.denom)).toFixed(2);
        const intervalName = getIntervalName(interval.num, interval.denom);

        const classes = ['game-stat-item'];
        if (isMastered) classes.push('mastered');

        html += `
            <div class="${classes.join(' ')}">
                <div class="game-stat-interval">${key}</div>
                <div class="game-stat-details">
                    <span class="game-stat-cents">${cents}¢</span>
                    ${intervalName ? `<span class="game-stat-name">${intervalName}</span>` : ''}
                </div>
                <div class="game-stat-info">
                    <span>Attempts: ${stats.attempts}</span>
                    <span>Avg: ${avgRecent}s</span>
                    ${isMastered ? '<span class="game-stat-badge mastered">✓ Mastered</span>' : '<span class="game-stat-badge learning">Learning</span>'}
                </div>
            </div>
        `;
    }

    progressStats.innerHTML = html;
}

// Update game chord progress display (during adaptive chord game)
function updateGameChordProgress() {
    const progressContainer = document.getElementById('game-interval-progress');
    const progressStats = document.getElementById('game-progress-stats');

    if (!progressContainer || !progressStats) return;

    // Only show in adaptive chord mode
    if (gameMode !== 'adaptive-chord') {
        progressContainer.style.display = 'none';
        return;
    }

    progressContainer.style.display = 'block';

    const currentMasteryThreshold = getCurrentMasteryThreshold();
    const currentMinAttempts = getCurrentMinAttemptsForMastery();
    const currentWindow = getCurrentRollingAverageWindow();

    initDefaultCollapsedState(activeChords, collapsedChordGroups);

    let html = buildGroupedChordHTML({
        chordList: activeChords,
        statsObj: chordStats,
        disabledSet: disabledChords,
        collapsedSet: collapsedChordGroups,
        cssPrefix: 'game-stat',
        masteryThreshold: currentMasteryThreshold,
        minAttempts: currentMinAttempts,
        rollingWindow: currentWindow,
        showIntervals: true,
        dataMode: 'chord'
    });

    // Show drill progress if drilling (outside grouping)
    if (currentNewChord) {
        const newChord = allChordsSorted.find(c => c.key === currentNewChord);
        if (newChord) {
            const newChordIntervalsDisplay = newChord.expectedIntervals.map(i => `${i.num}/${i.denom}`).join(', ');
            const newChordPosInfo = newChord.positionLabel ? ` <small>${newChord.positionLabel}</small>` : '';
            html += `
                <div class="game-stat-item drilling">
                    <div class="game-stat-interval">${newChord.name}${newChordPosInfo}</div>
                    <div class="game-stat-details">
                        <span class="game-stat-cents">${newChordIntervalsDisplay}</span>
                    </div>
                    <div class="game-stat-info">
                        <span class="game-stat-badge drilling">Drilling: ${newChordDrillCount}/${newChordDrillTarget}</span>
                    </div>
                </div>
            `;
        }
    }

    progressStats.innerHTML = html;

    attachChordGroupHandlers(progressStats, {
        chordList: activeChords,
        disabledSet: disabledChords,
        collapsedSet: collapsedChordGroups,
        saveFunc: saveAdaptiveChordProgress,
        updateFunc: updateGameChordProgress,
        dataMode: 'chord'
    });
}

// Update game level display in game panel
function updateGameLevelDisplay() {
    const gameLevelNumberEl = document.getElementById('game-level-number');
    if (gameLevelNumberEl) {
        gameLevelNumberEl.textContent = adaptiveLevel;
    }
}

// Update adaptive stats display
function updateAdaptiveStats() {
    const statsEl = document.getElementById('adaptive-stats');
    if (!statsEl) return;

    // Update level display
    updateAdaptiveLevelDisplay();

    // If no active intervals, try loading or show message
    if (activeIntervals.length === 0) {
        if (!loadAdaptiveProgress() || activeIntervals.length === 0) {
            statsEl.innerHTML = '<p>Click "Start/Continue" to begin!</p>';
            return;
        }
    }

    let html = `<div class="stats-grid">`;

    for (const interval of activeIntervals) {
        const key = `${interval.num}/${interval.denom}`;
        const stats = intervalStats[key];

        if (!stats) continue;

        const avgRecent = stats.recentTimes.length > 0
            ? (stats.recentTimes.reduce((a, b) => a + b, 0) / stats.recentTimes.length).toFixed(2)
            : 'N/A';

        const isMastered = stats.attempts >= minAttemptsForMastery && avgRecent !== 'N/A' && parseFloat(avgRecent) < masteryThreshold;

        html += `
            <div class="stat-item ${isMastered ? 'mastered' : ''}">
                <div class="stat-interval">${key}</div>
                <div class="stat-info">
                    <span>Attempts: ${stats.attempts}</span>
                    <span>Avg: ${avgRecent}s</span>
                    ${isMastered ? '<span class="mastered-badge">✓ Mastered</span>' : ''}
                </div>
            </div>
        `;
    }

    html += '</div>';
    html += `<p class="progress-text">Active intervals: ${activeIntervals.length} / ${allIntervalsSorted.length}</p>`;

    statsEl.innerHTML = html;
}

// ===== ADAPTIVE CHORD MODE FUNCTIONS =====

// Initialize adaptive chord mode
function initializeAdaptiveChordMode() {
    // Initialize sorted chords (expand starting positions if enabled, include inversions if enabled)
    initializeChordsSorted(randomStartingNote, includeInversions);

    // Initialize stats for all chords
    chordStats = {};
    for (const chord of allChordsSorted) {
        chordStats[chord.key] = {
            attempts: 0,
            totalTime: 0,
            recentTimes: [],
            mastered: false,
            lastSeenQuestion: -1,
            chord: chord
        };
    }

    // Start with the first chord entry (handles both expanded and non-expanded keys)
    activeChords = [];
    if (allChordsSorted.length > 0) {
        activeChords.push(allChordsSorted[0]);
    }

    // Reset drill tracking
    newChordDrillCount = 0;
    currentNewChord = null;

    // Set tutorial sequence dynamically
    chordTutorialSequence = allChordsSorted.length > 0 ? [allChordsSorted[0].key] : ['4:5:6'];

    // Set level to match number of base chords
    adaptiveChordLevel = countBaseChords(activeChords);

    // Save to localStorage
    saveAdaptiveChordProgress();
}

// Load adaptive chord progress from localStorage
function loadAdaptiveChordProgress() {
    const saved = localStorage.getItem('ji_adaptive_chord_progress');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            const savedExpandFlag = data.randomStartingNote || false;

            // Initialize sorted chords with current flags
            initializeChordsSorted(randomStartingNote, includeInversions);

            // Set tutorial sequence dynamically
            chordTutorialSequence = allChordsSorted.length > 0 ? [allChordsSorted[0].key] : ['4:5:6'];

            // Check if expand flag changed - need migration
            if (savedExpandFlag !== randomStartingNote) {
                // Flag changed, migrate keys
                const migratedStats = {};
                const oldStats = data.chordStats || {};

                if (randomStartingNote && !savedExpandFlag) {
                    // Old keys are plain (e.g. "4:5:6"), new keys are compound (e.g. "4:5:6_sp0")
                    for (const oldKey in oldStats) {
                        const newKey = oldKey + '_sp0';
                        migratedStats[newKey] = oldStats[oldKey];
                    }
                } else if (!randomStartingNote && savedExpandFlag) {
                    // Old keys are compound (e.g. "4:5:6_sp0"), new keys are plain (e.g. "4:5:6")
                    for (const oldKey in oldStats) {
                        const newKey = oldKey.replace(/_sp\d+$/, '');
                        // Only keep sp0 data (or first encountered) for plain key
                        if (!migratedStats[newKey]) {
                            migratedStats[newKey] = oldStats[oldKey];
                        }
                    }
                }

                chordStats = migratedStats;

                // Migrate activeChords
                const migratedActive = [];
                const oldActive = data.activeChords || [];
                for (const savedChord of oldActive) {
                    const oldKey = savedChord.key || savedChord;
                    let newKey;
                    if (randomStartingNote && !savedExpandFlag) {
                        newKey = oldKey + '_sp0';
                    } else {
                        newKey = oldKey.replace(/_sp\d+$/, '');
                    }
                    const chord = allChordsSorted.find(c => c.key === newKey);
                    if (chord && !migratedActive.find(c => c.key === chord.key)) {
                        migratedActive.push(chord);
                    }
                }
                activeChords = migratedActive;

                // Migrate currentNewChord
                let oldNewChord = data.currentNewChord || null;
                if (oldNewChord) {
                    if (randomStartingNote && !savedExpandFlag) {
                        oldNewChord = oldNewChord + '_sp0';
                    } else {
                        oldNewChord = oldNewChord.replace(/_sp\d+$/, '');
                    }
                }
                currentNewChord = oldNewChord;
            } else {
                chordStats = data.chordStats || {};
                activeChords = data.activeChords || [];
                currentNewChord = data.currentNewChord || null;
            }

            adaptiveChordLevel = data.adaptiveChordLevel || 1;
            chordTutorialIndex = data.chordTutorialIndex !== undefined ? data.chordTutorialIndex : 0;
            chordTutorialActive = data.chordTutorialActive !== undefined ? data.chordTutorialActive : true;
            newChordDrillCount = data.newChordDrillCount || 0;

            // Restore chord references in stats
            for (const key in chordStats) {
                const chord = allChordsSorted.find(c => c.key === key);
                if (chord) {
                    chordStats[key].chord = chord;
                }
            }

            // Restore activeChords with full chord objects (if not already migrated)
            if (!Array.isArray(activeChords[0]?.intervals)) {
                activeChords = activeChords.map(savedChord => {
                    const key = savedChord.key || savedChord;
                    return allChordsSorted.find(c => c.key === key);
                }).filter(c => c);
            }

            // Restore disabled chords
            disabledChords = new Set(data.disabledChords || []);

            // Sync level with number of base chords
            adaptiveChordLevel = countBaseChords(activeChords);

            return true;
        } catch (e) {
            console.error('Failed to load adaptive chord progress:', e);
            return false;
        }
    }
    return false;
}

// Save adaptive chord progress to localStorage
function saveAdaptiveChordProgress() {
    const data = {
        chordStats: chordStats,
        activeChords: activeChords.map(c => ({ key: c.key })),
        adaptiveChordLevel: adaptiveChordLevel,
        chordTutorialIndex: chordTutorialIndex,
        chordTutorialActive: chordTutorialActive,
        newChordDrillCount: newChordDrillCount,
        currentNewChord: currentNewChord,
        randomStartingNote: randomStartingNote,
        includeInversions: includeInversions,
        disabledChords: [...disabledChords]
    };
    localStorage.setItem('ji_adaptive_chord_progress', JSON.stringify(data));
}

// Reset adaptive chord progress
function resetAdaptiveChordProgress() {
    if (confirm('Are you sure you want to reset all adaptive chord mode progress?')) {
        localStorage.removeItem('ji_adaptive_chord_progress');
        chordTutorialIndex = 0;
        chordTutorialActive = true;
        initializeAdaptiveChordMode();
        updateAdaptiveChordStats();
        updateAdaptiveChordLevelDisplay();
        alert('Chord progress reset! You can now start fresh.');
    }
}

// Resume from specific chord level (input = number of base chords)
function resumeFromChordLevel(targetLevel) {
    if (targetLevel < 1) {
        alert('Level must be 1 or higher');
        return;
    }

    // Initialize sorted chords with current flags
    initializeChordsSorted(randomStartingNote, includeInversions);

    let numBaseChords = targetLevel;

    if (numBaseChords > TOTAL_BASE_CHORDS) {
        alert(`Maximum is ${TOTAL_BASE_CHORDS} base chords. Setting to maximum.`);
        numBaseChords = TOTAL_BASE_CHORDS;
    }

    // Initialize stats for all chords
    chordStats = {};
    for (const chord of allChordsSorted) {
        chordStats[chord.key] = {
            attempts: 0,
            totalTime: 0,
            recentTimes: [],
            mastered: false,
            lastSeenQuestion: -1,
            chord: chord
        };
    }

    // Get all variants for the first N base chords
    const variantsToUnlock = getAllVariantsForFirstNBaseChords(numBaseChords, allChordsSorted);

    activeChords = [];
    for (let i = 0; i < variantsToUnlock.length; i++) {
        const chord = variantsToUnlock[i];
        activeChords.push(chord);

        const chordKey = chord.key;
        if (chordStats[chordKey]) {
            // Mark earlier ones as mastered, leave the last few unmastered
            if (i < variantsToUnlock.length - 2) {
                chordStats[chordKey].mastered = true;
                chordStats[chordKey].attempts = 10;
                chordStats[chordKey].totalTime = 10;
                chordStats[chordKey].recentTimes = [1, 1, 1, 1, 1];
            } else {
                // Leave as unmastered for recent chords
                chordStats[chordKey].attempts = 3;
                chordStats[chordKey].totalTime = 12;
                chordStats[chordKey].recentTimes = [4, 4, 4];
            }
        }
    }

    // Reset drill tracking
    newChordDrillCount = 0;
    currentNewChord = null;
    chordTutorialIndex = 9999; // Skip tutorial
    chordTutorialActive = false;

    // Set level to match number of base chords
    adaptiveChordLevel = countBaseChords(activeChords);

    // Save to localStorage
    saveAdaptiveChordProgress();

    // Update UI
    updateAdaptiveChordStats();
    updateAdaptiveChordLevelDisplay();

    alert(`Level ${adaptiveChordLevel} — ${activeChords.length} chord variant${activeChords.length !== 1 ? 's' : ''} unlocked.`);
}

// Start adaptive chord game
function startAdaptiveChordGame() {
    // Read chord-specific settings
    const masteryInput = document.getElementById('chord-mastery-threshold-input');
    const minAttemptsInput = document.getElementById('chord-min-attempts-input');
    const rollingWindowInput = document.getElementById('chord-rolling-average-window-input');
    const nonMasteredRateInput = document.getElementById('chord-non-mastered-rate-input');

    masteryThreshold = masteryInput ? parseFloat(masteryInput.value) : 5;
    minAttemptsForMastery = minAttemptsInput ? parseInt(minAttemptsInput.value) : 5;
    rollingAverageWindow = rollingWindowInput ? parseInt(rollingWindowInput.value) : 3;
    nonMasteredRate = nonMasteredRateInput ? parseInt(nonMasteredRateInput.value) : 80;

    // Read sound settings from global interval mode settings (chord mode uses same sound settings)
    const synthTypeSelect = document.getElementById('synth-type-select');
    const releaseTimeInput = document.getElementById('release-time-input');
    const varyPitchCheckbox = document.getElementById('vary-pitch-checkbox');
    const enableSoundCheckbox = document.getElementById('enable-sound-checkbox');

    if (synthTypeSelect) synthType = synthTypeSelect.value;
    if (releaseTimeInput) releaseTime = parseFloat(releaseTimeInput.value);
    if (varyPitchCheckbox) varyPitch = varyPitchCheckbox.checked;
    if (enableSoundCheckbox) enableSound = enableSoundCheckbox.checked;

    // Save settings
    saveSettings();

    // Load or initialize
    if (!loadAdaptiveChordProgress()) {
        initializeAdaptiveChordMode();
    }

    if (activeChords.length === 0) {
        alert('No chords available! Resetting...');
        initializeAdaptiveChordMode();
    }

    // Reset game state
    gameActive = true;
    gameMode = 'adaptive-chord';
    questionCount = 0;
    totalTime = 0;
    currentComposition = [];
    lastChord = null;
    globalChordQuestionCounter = 0;

    // Start timer
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 100);

    // Render keyboard legend
    renderKeyboardLegend();

    // Show adaptive chord level indicator
    const levelIndicator = document.getElementById('adaptive-level-indicator');
    if (levelIndicator) {
        levelIndicator.style.display = 'flex';
        updateGameChordLevelDisplay();
    }

    // Show chord progress
    updateGameChordProgress();

    // Show game panel
    showGame();

    // Start first question
    nextAdaptiveChordQuestion();
}

// Select weighted random chord
function selectWeightedRandomChord() {
    // Filter out disabled chords
    const enabledChords = activeChords.filter(c => !disabledChords.has(c.key));
    if (enabledChords.length === 0) return null;

    const n = enabledChords.length;
    const guaranteedWindow = 3 * n;

    // Check for chords that MUST appear
    const mustAppearChords = [];
    for (const chord of enabledChords) {
        const stats = chordStats[chord.key];
        if (stats) {
            const questionsSinceLastSeen = globalChordQuestionCounter - stats.lastSeenQuestion;
            if (stats.lastSeenQuestion === -1 || questionsSinceLastSeen >= guaranteedWindow) {
                mustAppearChords.push(chord);
            }
        }
    }

    if (mustAppearChords.length > 0) {
        const randomIndex = Math.floor(Math.random() * mustAppearChords.length);
        return mustAppearChords[randomIndex];
    }

    // Weighted random selection based on mastery
    const chordWeights = [];
    let totalWeight = 0;

    // Get current settings
    const currentMasteryThreshold = getCurrentMasteryThreshold();
    const currentNonMasteredRate = getCurrentNonMasteredRate();
    const currentWindow = getCurrentRollingAverageWindow();

    let masteredCount = 0;
    let nonMasteredCount = 0;

    for (const chord of enabledChords) {
        const stats = chordStats[chord.key];
        if (stats && stats.mastered) {
            masteredCount++;
        } else {
            nonMasteredCount++;
        }
    }

    const masteredBaseWeight = nonMasteredCount > 0 ? (100 - currentNonMasteredRate) / masteredCount : 1;
    const nonMasteredBaseWeight = nonMasteredCount > 0 ? currentNonMasteredRate / nonMasteredCount : 1;

    for (const chord of enabledChords) {
        const stats = chordStats[chord.key];
        let weight;

        if (stats && stats.mastered) {
            weight = masteredBaseWeight;
        } else if (stats && stats.recentTimes.length > 0) {
            // Calculate average using only the most recent N attempts (rolling window)
            const recentTimesWindow = stats.recentTimes.slice(-currentWindow);
            const avgTime = recentTimesWindow.reduce((a, b) => a + b, 0) / recentTimesWindow.length;
            weight = nonMasteredBaseWeight * (1 + avgTime / currentMasteryThreshold);
        } else {
            weight = nonMasteredBaseWeight;
        }

        chordWeights.push({ chord, weight });
        totalWeight += weight;
    }

    let random = Math.random() * totalWeight;
    for (const item of chordWeights) {
        random -= item.weight;
        if (random <= 0) {
            return item.chord;
        }
    }

    return chordWeights[chordWeights.length - 1].chord;
}

// Next adaptive chord question
function nextAdaptiveChordQuestion() {
    // Check if we're drilling a new chord
    if (currentNewChord && newChordDrillCount < newChordDrillTarget) {
        // Continue drilling the new chord
        currentChord = currentNewChord;
    }
    // Check if tutorial is active
    else if (chordTutorialActive && chordTutorialIndex < chordTutorialSequence.length) {
        const tutorialKey = chordTutorialSequence[chordTutorialIndex];
        currentChord = tutorialKey;
    } else {
        // Tutorial complete, use normal selection
        chordTutorialActive = false;

        let attempts = 0;
        const maxAttempts = 50;

        do {
            const selectedChord = selectWeightedRandomChord();
            if (!selectedChord) break;

            currentChord = selectedChord.key;
            attempts++;

            if (activeChords.length > 1 && lastChord && currentChord === lastChord) {
                continue;
            }
            break;
        } while (attempts < maxAttempts);
    }

    // Update tracking
    if (chordStats[currentChord]) {
        chordStats[currentChord].lastSeenQuestion = globalChordQuestionCounter;
    }
    globalChordQuestionCounter++;
    lastChord = currentChord;

    // Look up the chord entry from allChordsSorted to get startingPosition and expectedIntervals
    const chordEntry = allChordsSorted.find(c => c.key === currentChord);

    // Use entry's pre-computed starting position and expected intervals
    currentChordStartingPosition = chordEntry ? chordEntry.startingPosition : 0;
    const expectedIntervals = chordEntry ? chordEntry.expectedIntervals : CHORD_TYPES[currentChord];

    // Store the expected intervals globally for use in validation and rendering
    currentExpectedIntervals = expectedIntervals;

    // Display the chord
    const traditionalName = chordEntry ? chordEntry.name : (CHORD_NAMES[currentChord] || currentChord);
    const harmonicNotation = chordEntry ? chordEntry.chordKey : currentChord;

    const intervalsHTML = expectedIntervals.map((int, idx) =>
        `<span class="chord-interval" data-interval="${int.num}/${int.denom}">${int.num}/${int.denom}</span>`
    ).join(', ');

    // Generate starting position text
    const positionLabel = chordEntry ? chordEntry.positionLabel : '';
    const startingPositionText = positionLabel
        ? `<div class="starting-position">Starting <strong>${positionLabel}</strong></div>`
        : '';

    targetIntervalEl.innerHTML = `
        <h2>${traditionalName}</h2>
        ${startingPositionText}
        <div class="chord-harmonic-notation">${harmonicNotation}</div>
        <div class="chord-intervals">${intervalsHTML}</div>
    `;

    // Reset composition and auto-place 1/1 as the first note
    currentComposition = [{ num: 1, denom: 1 }];
    chordProgress = [{ num: 1, denom: 1 }];
    updateCompositionDisplay();

    // Mark 1/1 as already entered in the UI
    markIntervalCorrect('1/1');

    // Render piano roll visualization with 1/1 already placed
    renderChordPianoRoll(harmonicNotation, chordProgress, { num: 1, denom: 1 });

    // Clear feedback
    feedbackEl.textContent = '';
    feedbackEl.className = 'feedback';
    feedbackEl.style.background = '';
    feedbackEl.style.color = '';

    // Start question timer
    questionStartTime = Date.now();

    // Play chord audio
    playChordAudio(expectedIntervals);
}

// Check and unlock next chord
function checkAndUnlockNextChord() {
    // Get current settings
    const currentMasteryThreshold = getCurrentMasteryThreshold();
    const currentMinAttempts = getCurrentMinAttemptsForMastery();
    const currentWindow = getCurrentRollingAverageWindow();

    // Check if all active (non-disabled) chords are mastered
    let allMastered = true;
    for (const chord of activeChords) {
        if (disabledChords.has(chord.key)) continue;
        const stats = chordStats[chord.key];
        if (!stats) continue;

        // Calculate average using only the most recent N attempts (rolling window)
        const recentTimesWindow = stats.recentTimes.slice(-currentWindow);
        const avgRecent = recentTimesWindow.length > 0
            ? recentTimesWindow.reduce((a, b) => a + b, 0) / recentTimesWindow.length
            : 999;

        const isMastered = stats.attempts >= currentMinAttempts && avgRecent < currentMasteryThreshold;
        stats.mastered = isMastered;

        if (!isMastered) {
            allMastered = false;
        }
    }

    // If all mastered, unlock next chord
    if (allMastered && activeChords.length < allChordsSorted.length && !currentNewChord) {
        const activeKeys = new Set(activeChords.map(c => c.key));
        const nextChord = allChordsSorted.find(c => !activeKeys.has(c.key));

        if (nextChord) {
            // Don't add to active chords yet - start drilling first
            currentNewChord = nextChord.key;
            newChordDrillCount = 0;

            // Check if this chord introduces a new base chord
            const nextBaseKey = getBaseChordForGrouping(nextChord.key);
            const currentBases = getUniqueBaseChords(activeChords);
            const isNewBaseChord = !currentBases.has(nextBaseKey);

            if (isNewBaseChord) {
                adaptiveChordLevel = currentBases.size + 1;
            }
            updateGameChordLevelDisplay();

            // Show notification
            const posInfo = nextChord.positionLabel ? ` ${nextChord.positionLabel}` : '';
            if (isNewBaseChord) {
                const baseName = CHORD_NAMES[nextBaseKey] || nextBaseKey;
                feedbackEl.innerHTML = `<strong>🎉 Level ${adaptiveChordLevel}! New chord unlocked: ${baseName}!</strong><br>${nextChord.name}${posInfo} (${nextChord.chordKey})<br><em>Practice this chord ${newChordDrillTarget} times before it's added to the mix</em>`;
            } else {
                feedbackEl.innerHTML = `<strong>New variant unlocked: ${nextChord.name}${posInfo}!</strong><br>(${nextChord.chordKey})<br><em>Practice this chord ${newChordDrillTarget} times before it's added to the mix</em>`;
            }
            feedbackEl.className = 'feedback';
            feedbackEl.style.background = '#d1ecf1';
            feedbackEl.style.color = '#0c5460';

            // Save progress
            saveAdaptiveChordProgress();
        }
    }

    // Save progress periodically
    if (questionCount % 5 === 0) {
        saveAdaptiveChordProgress();
    }
}

// Update adaptive chord level display in settings panel
function updateAdaptiveChordLevelDisplay() {
    const levelNumberEl = document.getElementById('adaptive-chord-level-number');
    if (levelNumberEl) {
        levelNumberEl.textContent = adaptiveChordLevel;
    }
    // Refresh open detail panel
    const detailPanel = document.getElementById('adaptive-chord-level-detail');
    if (detailPanel && detailPanel.style.display !== 'none') {
        detailPanel.innerHTML = buildLevelDetailHTML(activeChords);
    }
}

// Update game chord level display in game panel
function updateGameChordLevelDisplay() {
    const gameLevelNumberEl = document.getElementById('game-level-number');
    if (gameLevelNumberEl) {
        gameLevelNumberEl.textContent = adaptiveChordLevel;
    }
    // Refresh open detail panel
    const detailPanel = document.getElementById('game-level-detail');
    if (detailPanel && detailPanel.style.display !== 'none') {
        detailPanel.innerHTML = buildLevelDetailHTML(activeChords);
    }
}

// Build HTML showing all unlocked base chords and their variants
function buildLevelDetailHTML(activeChordsList) {
    const { groups, groupOrder } = groupChordsHierarchically(activeChordsList);
    let html = '';

    for (const baseKey of groupOrder) {
        const group = groups.get(baseKey);
        const baseName = CHORD_NAMES[baseKey] || baseKey;
        html += '<div class="base-chord-group">';
        html += `<div class="base-chord-name">${baseName} (${baseKey})</div>`;

        // Collect all variants
        const variants = [];
        if (group.header) {
            const posLabel = group.header.positionLabel ? ` ${group.header.positionLabel}` : '';
            variants.push(`${group.header.name}${posLabel}`);
        }
        for (const child of group.children) {
            const posLabel = child.positionLabel ? ` ${child.positionLabel}` : '';
            variants.push(`${child.name}${posLabel}`);
        }

        if (variants.length > 1) {
            html += '<ul class="base-chord-variants">';
            for (const v of variants) {
                html += `<li>${v}</li>`;
            }
            html += '</ul>';
        }

        html += '</div>';
    }

    if (groupOrder.length === 0) {
        html = '<p style="color: #666; text-align: center;">No chords unlocked yet.</p>';
    }

    return html;
}

// Toggle level detail panel visibility
function toggleLevelDetail(displayEl, detailEl, arrowEl, chordsList) {
    if (detailEl.style.display === 'none') {
        detailEl.innerHTML = buildLevelDetailHTML(chordsList);
        detailEl.style.display = 'block';
        if (arrowEl) arrowEl.classList.add('expanded');
    } else {
        detailEl.style.display = 'none';
        if (arrowEl) arrowEl.classList.remove('expanded');
    }
}

// ===== CHORD GROUPING HELPERS =====

// Group a chord list hierarchically by base chord
function groupChordsHierarchically(chordList) {
    const groups = new Map(); // baseKey -> { header: chord|null, children: chord[] }
    const groupOrder = [];

    for (const chord of chordList) {
        const baseKey = getBaseChordForGrouping(chord.key);

        if (!groups.has(baseKey)) {
            groups.set(baseKey, { header: null, children: [] });
            groupOrder.push(baseKey);
        }

        const group = groups.get(baseKey);
        // Header = the entry where bareChordKey === baseKey AND startingPosition === 0
        const bareChordKey = chord.key.includes('_sp') ? chord.key.split('_sp')[0] : chord.chordKey;
        if (bareChordKey === baseKey && chord.startingPosition === 0) {
            group.header = chord;
        } else {
            group.children.push(chord);
        }
    }

    return { groups, groupOrder };
}

// Compute mastery state for a chord entry
function computeChordMastery(chord, statsObj, masteryThreshold, minAttempts, rollingWindow) {
    const stats = statsObj[chord.key];
    if (!stats) return { stats: null, avgRecent: 'N/A', isMastered: false };

    const recentTimesWindow = stats.recentTimes.slice(-rollingWindow);
    const avgRecent = recentTimesWindow.length > 0
        ? (recentTimesWindow.reduce((a, b) => a + b, 0) / recentTimesWindow.length).toFixed(2)
        : 'N/A';

    const isMastered = stats.attempts >= minAttempts && avgRecent !== 'N/A' && parseFloat(avgRecent) < masteryThreshold;
    return { stats, avgRecent, isMastered };
}

// Build HTML for a single chord stat item (used in both header and child positions)
function buildChordItemHTML(chord, statsObj, disabledSet, masteryThreshold, minAttempts, rollingWindow, cssPrefix, showIntervals, isChild, toggleHTML) {
    const { stats, avgRecent, isMastered } = computeChordMastery(chord, statsObj, masteryThreshold, minAttempts, rollingWindow);
    if (!stats) return '';

    const isDisabled = disabledSet.has(chord.key);
    const itemClass = cssPrefix === 'game-stat' ? 'game-stat-item' : 'stat-item';
    const classes = [itemClass];
    if (isMastered) classes.push('mastered');
    if (isDisabled) classes.push('disabled');
    if (isChild) classes.push(cssPrefix === 'game-stat' ? 'child-game-stat-item' : 'child-stat-item');

    const posInfo = chord.positionLabel ? ` <small>${chord.positionLabel}</small>` : '';

    if (cssPrefix === 'game-stat') {
        const intervalsDisplay = chord.expectedIntervals.map(i => `${i.num}/${i.denom}`).join(', ');
        return `
            <div class="${classes.join(' ')}" data-chord-key="${chord.key}" data-mode="${chord._dataMode || 'chord'}">
                ${toggleHTML || ''}
                <div class="game-stat-interval">${chord.name}${posInfo}</div>
                <div class="game-stat-details">
                    <span class="game-stat-cents">${intervalsDisplay}</span>
                </div>
                <div class="game-stat-info">
                    <span>Attempts: ${stats.attempts}</span>
                    <span>Avg: ${avgRecent}s</span>
                    ${isMastered ? '<span class="game-stat-badge mastered">✓ Mastered</span>' : '<span class="game-stat-badge learning">Learning</span>'}
                </div>
            </div>`;
    } else {
        return `
            <div class="${classes.join(' ')}" data-chord-key="${chord.key}" data-mode="${chord._dataMode || 'chord'}">
                ${toggleHTML || ''}
                <div class="stat-interval">${chord.name}${posInfo}</div>
                <div class="stat-info">
                    <span>Attempts: ${stats.attempts}</span>
                    <span>Avg: ${avgRecent}s</span>
                    ${isMastered ? '<span class="mastered-badge">✓ Mastered</span>' : ''}
                </div>
            </div>`;
    }
}

// Build full grouped chord HTML
function buildGroupedChordHTML(options) {
    const { chordList, statsObj, disabledSet, collapsedSet, cssPrefix, masteryThreshold, minAttempts, rollingWindow, showIntervals, dataMode } = options;

    // Tag each chord with its data-mode for HTML generation
    const taggedList = chordList.map(c => ({ ...c, _dataMode: dataMode }));

    const { groups, groupOrder } = groupChordsHierarchically(taggedList);

    // For 'stat' prefix, wrap in stats-grid div (container is adaptive-stats, not the grid itself)
    // For 'game-stat' prefix, don't wrap — the container element IS the grid (has class game-progress-stats)
    const needsWrapper = cssPrefix !== 'game-stat';
    let html = needsWrapper ? '<div class="stats-grid">' : '';

    for (const baseKey of groupOrder) {
        const group = groups.get(baseKey);
        const hasChildren = group.children.length > 0;

        if (!hasChildren && group.header) {
            // Single item, no group wrapper needed — but wrap for consistent grid
            html += `<div class="chord-group">`;
            html += buildChordItemHTML(group.header, statsObj, disabledSet, masteryThreshold, minAttempts, rollingWindow, cssPrefix, showIntervals, false, '');
            html += `</div>`;
        } else if (hasChildren) {
            const isCollapsed = collapsedSet.has(baseKey);
            const arrow = isCollapsed ? '▶' : '▼';

            html += `<div class="chord-group">`;

            // Header (may be null if root position not yet unlocked)
            if (group.header) {
                const toggleHTML = `<div class="chord-group-toggle" data-base-chord="${baseKey}">${arrow}</div>`;
                html += `<div class="group-header">`;
                html += buildChordItemHTML(group.header, statsObj, disabledSet, masteryThreshold, minAttempts, rollingWindow, cssPrefix, showIntervals, false, toggleHTML);
                html += `</div>`;
            } else {
                // No header — show a label with toggle
                const baseName = CHORD_NAMES[baseKey] || baseKey;
                html += `<div class="group-header group-header-label">`;
                html += `<div class="chord-group-toggle" data-base-chord="${baseKey}">${arrow}</div>`;
                html += `<span class="stat-interval">${baseName}</span>`;
                html += `</div>`;
            }

            // Children
            html += `<div class="chord-group-children${isCollapsed ? ' collapsed' : ''}">`;
            for (const child of group.children) {
                html += buildChordItemHTML(child, statsObj, disabledSet, masteryThreshold, minAttempts, rollingWindow, cssPrefix, showIntervals, true, '');
            }
            html += `</div>`;

            html += `</div>`;
        }
    }

    if (needsWrapper) html += '</div>';
    return html;
}

// Attach event handlers for chord group toggles and disable clicks
function attachChordGroupHandlers(container, options) {
    const { chordList, disabledSet, collapsedSet, saveFunc, updateFunc, dataMode } = options;

    // Toggle expand/collapse
    container.querySelectorAll('.chord-group-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const baseChord = toggle.dataset.baseChord;
            if (collapsedSet.has(baseChord)) {
                collapsedSet.delete(baseChord);
            } else {
                collapsedSet.add(baseChord);
            }
            updateFunc();
        });
    });

    // Disable click on stat items
    const itemSelector = dataMode === 'cg'
        ? '.game-stat-item[data-chord-key], .stat-item[data-chord-key]'
        : '.game-stat-item[data-chord-key], .stat-item[data-chord-key]';

    container.querySelectorAll(itemSelector).forEach(el => {
        el.addEventListener('click', (e) => {
            // Don't toggle disable if user clicked the toggle arrow
            if (e.target.closest('.chord-group-toggle')) return;

            const key = el.dataset.chordKey;
            if (disabledSet.has(key)) {
                disabledSet.delete(key);
            } else {
                const enabledNow = chordList.filter(c => !disabledSet.has(c.key)).length;
                if (enabledNow <= 1) return;
                disabledSet.add(key);
            }
            saveFunc();
            updateFunc();
        });
    });
}

// Track which Sets have had their default collapsed state initialized
const _initializedCollapsedSets = new WeakSet();

// Initialize default collapsed state (collapse all groups that have children)
function initDefaultCollapsedState(chordList, collapsedSet) {
    if (_initializedCollapsedSets.has(collapsedSet)) return;
    const { groups, groupOrder } = groupChordsHierarchically(chordList);
    for (const baseKey of groupOrder) {
        const group = groups.get(baseKey);
        if (group.children.length > 0) {
            collapsedSet.add(baseKey);
        }
    }
    _initializedCollapsedSets.add(collapsedSet);
}

// ===== END CHORD GROUPING HELPERS =====

// Update adaptive chord stats display
function updateAdaptiveChordStats() {
    const statsEl = document.getElementById('adaptive-chord-stats');
    if (!statsEl) return;

    updateAdaptiveChordLevelDisplay();

    if (activeChords.length === 0) {
        if (!loadAdaptiveChordProgress() || activeChords.length === 0) {
            statsEl.innerHTML = '<p>Click "Start/Continue" to begin!</p>';
            return;
        }
    }

    const currentMasteryThreshold = getCurrentMasteryThreshold();
    const currentMinAttempts = getCurrentMinAttemptsForMastery();
    const currentWindow = getCurrentRollingAverageWindow();

    initDefaultCollapsedState(activeChords, collapsedChordGroups);

    let html = buildGroupedChordHTML({
        chordList: activeChords,
        statsObj: chordStats,
        disabledSet: disabledChords,
        collapsedSet: collapsedChordGroups,
        cssPrefix: 'stat',
        masteryThreshold: currentMasteryThreshold,
        minAttempts: currentMinAttempts,
        rollingWindow: currentWindow,
        showIntervals: false,
        dataMode: 'chord'
    });

    const enabledCount = activeChords.filter(c => !disabledChords.has(c.key)).length;
    html += `<p class="progress-text">Active chords: ${enabledCount} / ${allChordsSorted.length} (${activeChords.length} unlocked)</p>`;

    statsEl.innerHTML = html;

    attachChordGroupHandlers(statsEl, {
        chordList: activeChords,
        disabledSet: disabledChords,
        collapsedSet: collapsedChordGroups,
        saveFunc: saveAdaptiveChordProgress,
        updateFunc: updateAdaptiveChordStats,
        dataMode: 'chord'
    });
}

// End game button
endBtn.addEventListener('click', endGame);

// End game
function endGame() {
    gameActive = false;

    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    // Save adaptive progress before ending
    if (gameMode === 'adaptive') {
        saveAdaptiveProgress();
    } else if (gameMode === 'adaptive-chord') {
        saveAdaptiveChordProgress();
    }

    const avgTime = questionCount > 0 ? (totalTime / questionCount).toFixed(2) : 0;

    let message = `
        <div style="text-align: left;">
            <strong>Game Over!</strong><br><br>
            Questions answered: ${questionCount}<br>
            Total time: ${(totalTime).toFixed(2)}s<br>
            Average time per question: ${avgTime}s<br>
    `;

    if (gameMode === 'adaptive') {
        message += `<br>Active intervals: ${activeIntervals.length} / ${allIntervalsSorted.length}<br>`;
    }

    message += '</div>';

    feedbackEl.innerHTML = message;
    feedbackEl.className = 'feedback';
    feedbackEl.style.background = '#f8f9fa';
    feedbackEl.style.color = '#333';

    // Change button
    endBtn.textContent = 'Return to Main Menu';
    endBtn.onclick = () => {
        endBtn.textContent = 'End Game';
        endBtn.onclick = endGame;
        showMainMenu();
    };
}

// Play interval audio
function playIntervalAudio(num, denom) {
    if (!audioContext || !enableSound) return;

    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const now = audioContext.currentTime;

    // Base frequency with optional pitch variation
    let baseFreq = 220; // A3
    if (varyPitch) {
        // Random pitch shift from -500¢ to +1200¢
        const randomCents = -500 + Math.random() * 1700; // 1700 = 1200 - (-500)
        baseFreq = baseFreq * Math.pow(2, randomCents / 1200);
    }

    // Calculate interval frequency
    const cents = 1200 * Math.log2(num / denom);
    const intervalFreq = baseFreq * Math.pow(2, cents / 1200);

    // Play root note
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();

    osc1.type = synthType;
    osc1.frequency.value = baseFreq;
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);

    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + releaseTime);

    osc1.start(now);
    osc1.stop(now + releaseTime);

    // Play interval note
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();

    osc2.type = synthType;
    osc2.frequency.value = intervalFreq;
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);

    gain2.gain.setValueAtTime(0.15, now + 0.3);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3 + releaseTime);

    osc2.start(now + 0.3);
    osc2.stop(now + 0.3 + releaseTime);
}

// Play single tone for chord mode
function playSingleTone(num, denom) {
    if (!audioContext || !enableSound) return;

    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const now = audioContext.currentTime;

    // Base frequency (no pitch variation for chord mode)
    const baseFreq = 220; // A3

    // Calculate frequency for this interval
    const cents = 1200 * Math.log2(num / denom);
    const freq = baseFreq * Math.pow(2, cents / 1200);

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = 'sine'; // Always sine wave for chord mode
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(audioContext.destination);

    const sustainTime = 0.1;
    const releaseTime = 0.3;
    const totalDuration = sustainTime + releaseTime;

    // Envelope: instant attack (plucky), sustain, then release
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.setValueAtTime(0.3, now + sustainTime);
    gain.gain.exponentialRampToValueAtTime(0.001, now + totalDuration);

    osc.start(now);
    osc.stop(now + totalDuration);
}

// Play chord audio (all intervals together)
function playChordAudio(intervals) {
    if (!audioContext || !enableSound) return;

    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const now = audioContext.currentTime;

    // Base frequency (no pitch variation for chord mode)
    const baseFreq = 220; // A3

    const duration = 1.0; // Longer duration for chord

    // Play all intervals simultaneously as a chord
    intervals.forEach(interval => {
        const cents = 1200 * Math.log2(interval.num / interval.denom);
        const freq = baseFreq * Math.pow(2, cents / 1200);

        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.type = 'sine'; // Always sine wave for chord mode
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(audioContext.destination);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.start(now);
        osc.stop(now + duration);
    });
}

// Play sound
function playSound(type) {
    if (!audioContext) return;

    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const now = audioContext.currentTime;

    if (type === 'correct') {
        // Single pleasant tone for correct interval
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.frequency.value = 800; // Pleasant high tone
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.start(now);
        osc.stop(now + 0.15);
    } else if (type === 'excellent') {
        // Major chord arpeggio for completing the chord
        const notes = [
            { freq: 523.25, start: 0, duration: 0.15 },
            { freq: 659.25, start: 0.08, duration: 0.15 },
            { freq: 783.99, start: 0.16, duration: 0.2 }
        ];

        notes.forEach(note => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);

            osc.frequency.value = note.freq;
            gain.gain.setValueAtTime(0.2, now + note.start);
            gain.gain.exponentialRampToValueAtTime(0.01, now + note.start + note.duration);

            osc.start(now + note.start);
            osc.stop(now + note.start + note.duration);
        });
    }
}

// ============================================================
// GRID MOVEMENT GAME
// ============================================================

// Grid game state
let gridGameActive = false;
let gridSize = 10;
let playerRow = 0;
let playerCol = 0;
let targetRow = 0;
let targetCol = 0;
let gridScore = 0;
let gridStartTime = null;
let gridTimerInterval = null;
let gridTargetStartTime = null;
let gridTotalTime = 0;

// Grid mode navigation (added earlier in the file with other button listeners)
const backToMainFromGridBtn = document.getElementById('back-to-main-from-grid-btn');
if (backToMainFromGridBtn) {
    backToMainFromGridBtn.addEventListener('click', () => {
        if (gridGameActive) {
            endGridGame();
        }
        showMainMenu();
    });
}

const startGridBtn = document.getElementById('start-grid-btn');
if (startGridBtn) {
    startGridBtn.addEventListener('click', () => {
        startGridGame();
    });
}

const resetGridBtn = document.getElementById('reset-grid-btn');
if (resetGridBtn) {
    resetGridBtn.addEventListener('click', () => {
        resetGridGame();
    });
}

const gridSizeInput = document.getElementById('grid-size-input');
const gridSizeDisplay = document.getElementById('grid-size-display');
if (gridSizeInput && gridSizeDisplay) {
    gridSizeInput.addEventListener('input', () => {
        const newSize = parseInt(gridSizeInput.value);
        gridSize = newSize;
        gridSizeDisplay.textContent = newSize;
        if (gridGameActive) {
            renderGrid();
        }
    });
}

function startGridGame() {
    gridGameActive = true;
    gridScore = 0;
    gridTotalTime = 0;
    gridStartTime = Date.now();

    // Initialize player in center
    playerRow = Math.floor(gridSize / 2);
    playerCol = Math.floor(gridSize / 2);

    // Place first target
    placeNewTarget();

    // Start timer
    if (gridTimerInterval) {
        clearInterval(gridTimerInterval);
    }
    gridTimerInterval = setInterval(updateGridTimer, 10);

    // Render grid
    renderGrid();
    updateGridStats();

    // Focus on the grid container to capture key events
    document.getElementById('grid-container').focus();
}

function endGridGame() {
    gridGameActive = false;
    if (gridTimerInterval) {
        clearInterval(gridTimerInterval);
        gridTimerInterval = null;
    }
}

function resetGridGame() {
    endGridGame();
    gridScore = 0;
    gridTotalTime = 0;
    updateGridStats();
    renderGrid();
}

function placeNewTarget() {
    gridTargetStartTime = Date.now();

    // Place target at random position (different from player)
    let newRow, newCol;
    do {
        newRow = Math.floor(Math.random() * gridSize);
        newCol = Math.floor(Math.random() * gridSize);
    } while (newRow === playerRow && newCol === playerCol);

    targetRow = newRow;
    targetCol = newCol;
}

function movePlayer(dRow, dCol) {
    if (!gridGameActive) return;

    const newRow = playerRow + dRow;
    const newCol = playerCol + dCol;

    // Check bounds
    if (newRow >= 0 && newRow < gridSize && newCol >= 0 && newCol < gridSize) {
        playerRow = newRow;
        playerCol = newCol;
        renderGrid();
    }
}

function captureTarget() {
    if (!gridGameActive) return;

    // Check if player is on target
    if (playerRow === targetRow && playerCol === targetCol) {
        const targetTime = (Date.now() - gridTargetStartTime) / 1000;
        gridTotalTime += targetTime;
        gridScore++;
        updateGridStats();

        // Place new target at different location
        let newRow, newCol;
        do {
            newRow = Math.floor(Math.random() * gridSize);
            newCol = Math.floor(Math.random() * gridSize);
        } while (newRow === playerRow && newCol === playerCol);

        targetRow = newRow;
        targetCol = newCol;
        gridTargetStartTime = Date.now();

        playSound('correct');

        // Force re-render
        renderGrid();
    }
}

function renderGrid() {
    const container = document.getElementById('grid-container');
    container.innerHTML = '';
    container.tabIndex = 0; // Make focusable

    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';

            // Mark player position
            if (row === playerRow && col === playerCol) {
                cell.classList.add('player-cell');
                cell.textContent = '◆';
            }
            // Mark target position
            else if (row === targetRow && col === targetCol) {
                cell.classList.add('target-cell');
                cell.textContent = '●';
            }

            container.appendChild(cell);
        }
    }

    // Set grid template columns
    container.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
}

function updateGridTimer() {
    if (!gridGameActive || !gridStartTime) return;
    document.getElementById('grid-timer').textContent = formatElapsedTime(gridStartTime);
}

function updateGridStats() {
    document.getElementById('grid-score').textContent = gridScore;

    if (gridScore > 0) {
        const avgTime = gridTotalTime / gridScore;
        document.getElementById('grid-avg-time').textContent = avgTime.toFixed(2) + 's';
    } else {
        document.getElementById('grid-avg-time').textContent = '0.00s';
    }
}

// Handle grid game keyboard input
function handleGridKeyPress(event) {
    if (!gridGameActive) return;

    const key = event.key.toLowerCase();

    // ASDF movement: a=left, s=up, d=down, f=right
    switch (key) {
        case 'a':
            event.preventDefault();
            movePlayer(0, -1);
            break;
        case 's':
            event.preventDefault();
            movePlayer(-1, 0);
            break;
        case 'd':
            event.preventDefault();
            movePlayer(1, 0);
            break;
        case 'f':
            event.preventDefault();
            movePlayer(0, 1);
            break;
        case 'tab':
            event.preventDefault();
            captureTarget();
            break;
    }
}

// Add grid keydown listener to document
document.addEventListener('keydown', (event) => {
    // Chord+Grid combined mode takes priority
    if (chordGridGameActive) {
        handleChordGridKeyPress(event);
        return;
    }
    if (gridGameActive) {
        handleGridKeyPress(event);
    }
});

// ============================================================
// CHORD + GRID COMBINED MODE
// ============================================================

// Chord-Grid game state
let chordGridGameActive = false;
let chordGridPhase = 'grid'; // 'grid' or 'chord'
let chordGridSize = 10;
let chordGridPlayerRow = 0;
let chordGridPlayerCol = 0;
let chordGridTargetRow = 0;
let chordGridTargetCol = 0;
let chordGridScore = 0;
let chordGridStartTime = null;
let chordGridTimerInterval = null;
let chordGridTargetStartTime = null;
let chordGridTotalTime = 0;
let chordGridRandomStart = false;
let chordGridIncludeInversions = true;

// Chord-Grid chord state (separate from main chord mode)
let cgCurrentChord = null;
let cgCurrentExpectedIntervals = [];
let cgCurrentStartingPosition = 0;
let cgChordProgress = [];
let cgCurrentComposition = [];
let cgActiveChords = []; // progressively unlocked chords

// Chord-Grid adaptive progression state
let cgChordStats = {}; // { 'chordKey': { attempts, totalTime, recentTimes, mastered, lastSeenQuestion } }
let cgAdaptiveLevel = 1;
let cgLastChord = null;
let cgGlobalQuestionCounter = 0;
let cgNewChordDrillCount = 0;
let cgNewChordDrillTarget = 5;
let cgCurrentNewChord = null;
let cgTutorialActive = true;
let cgTutorialIndex = 0;
let cgTutorialSequence = ['4:5:6'];
let cgDisabledChords = new Set(); // Chord keys disabled by user (won't appear in questions)

// Chord-Grid event listeners
const chordGridSizeInput = document.getElementById('chord-grid-size-input');
const chordGridSizeDisplay = document.getElementById('chord-grid-size-display');
if (chordGridSizeInput && chordGridSizeDisplay) {
    chordGridSizeInput.addEventListener('input', () => {
        const newSize = parseInt(chordGridSizeInput.value);
        chordGridSize = newSize;
        chordGridSizeDisplay.textContent = newSize;
    });
}

const backToMainFromChordGridBtn = document.getElementById('back-to-main-from-chord-grid-btn');
if (backToMainFromChordGridBtn) {
    backToMainFromChordGridBtn.addEventListener('click', () => {
        if (chordGridGameActive) {
            endChordGridGame();
        }
        showMainMenu();
    });
}

const startChordGridBtn = document.getElementById('start-chord-grid-btn');
if (startChordGridBtn) {
    startChordGridBtn.addEventListener('click', () => {
        initAudio();
        startChordGridGame();
    });
}

const resetChordGridBtn = document.getElementById('reset-chord-grid-btn');
if (resetChordGridBtn) {
    resetChordGridBtn.addEventListener('click', () => {
        resetChordGridGame();
    });
}

const endChordGridBtn = document.getElementById('end-chord-grid-btn');
if (endChordGridBtn) {
    endChordGridBtn.addEventListener('click', () => {
        endChordGridGame();
        showChordGridMode();
        updateCGStats();
    });
}

// Resume from specific chord-grid level button
const cgResumeLevelBtn = document.getElementById('cg-resume-level-btn');
if (cgResumeLevelBtn) {
    cgResumeLevelBtn.addEventListener('click', () => {
        const input = document.getElementById('cg-resume-level-input');
        if (input) {
            const targetLevel = parseInt(input.value);
            if (targetLevel >= 1) {
                resumeFromCGLevel(targetLevel);
            } else {
                alert('Please enter a valid level number (1 or higher)');
            }
        }
    });
}

// Click handlers for level detail panels (CG mode)
const cgLevelDisplay = document.getElementById('cg-level-display');
if (cgLevelDisplay) {
    cgLevelDisplay.addEventListener('click', () => {
        const detail = document.getElementById('cg-level-detail');
        const arrow = document.getElementById('cg-level-arrow');
        if (detail) toggleLevelDetail(cgLevelDisplay, detail, arrow, cgActiveChords);
    });
}

const cgLevelIndicator = document.getElementById('cg-level-indicator');
if (cgLevelIndicator) {
    cgLevelIndicator.addEventListener('click', () => {
        const detail = document.getElementById('cg-game-level-detail');
        const arrow = document.getElementById('cg-game-level-arrow');
        if (detail) toggleLevelDetail(cgLevelIndicator, detail, arrow, cgActiveChords);
    });
}

// Start the chord-grid game
function startChordGridGame() {
    // Read settings
    const sizeInput = document.getElementById('chord-grid-size-input');
    if (sizeInput) chordGridSize = parseInt(sizeInput.value);

    const randomStartCheckbox = document.getElementById('chord-grid-random-start-checkbox');
    chordGridRandomStart = randomStartCheckbox ? randomStartCheckbox.checked : false;

    const cgInversionsCheckbox = document.getElementById('chord-grid-include-inversions-checkbox');
    chordGridIncludeInversions = cgInversionsCheckbox ? cgInversionsCheckbox.checked : true;

    // Load or initialize adaptive progress
    if (!loadCGAdaptiveProgress()) {
        initializeCGAdaptiveMode();
    }

    if (cgActiveChords.length === 0) {
        alert('No chords available! Resetting...');
        initializeCGAdaptiveMode();
    }

    // Reset game state
    chordGridGameActive = true;
    chordGridScore = 0;
    chordGridTotalTime = 0;
    chordGridStartTime = Date.now();
    cgLastChord = null;
    cgGlobalQuestionCounter = 0;

    // Initialize player in center
    chordGridPlayerRow = Math.floor(chordGridSize / 2);
    chordGridPlayerCol = Math.floor(chordGridSize / 2);

    // Select first chord and place target
    selectNextChordGridChord();
    placeChordGridTarget();

    // Start timer
    if (chordGridTimerInterval) clearInterval(chordGridTimerInterval);
    chordGridTimerInterval = setInterval(updateChordGridTimer, 10);

    // Show game panel and set grid phase
    showChordGridGame();
    setChordGridPhase('grid');

    // Update level display
    updateCGLevelDisplay();

    // Render
    renderChordGrid();
    updateChordGridStats();
    updateCGGameProgress();
    renderChordGridKeyboardLegend();

    // Focus grid
    const container = document.getElementById('chord-grid-container');
    if (container) container.focus();
}

// Initialize chord-grid adaptive mode
function initializeCGAdaptiveMode() {
    // Initialize sorted chords (expand starting positions if enabled, include inversions if enabled)
    initializeChordsSorted(chordGridRandomStart, chordGridIncludeInversions);

    cgChordStats = {};
    for (const chord of allChordsSorted) {
        cgChordStats[chord.key] = {
            attempts: 0,
            totalTime: 0,
            recentTimes: [],
            mastered: false,
            lastSeenQuestion: -1,
            chord: chord
        };
    }

    // Start with the first chord entry
    cgActiveChords = [];
    if (allChordsSorted.length > 0) {
        cgActiveChords.push(allChordsSorted[0]);
    }

    cgNewChordDrillCount = 0;
    cgCurrentNewChord = null;
    cgTutorialActive = true;
    cgTutorialIndex = 0;

    // Set tutorial sequence dynamically
    cgTutorialSequence = allChordsSorted.length > 0 ? [allChordsSorted[0].key] : ['4:5:6'];

    cgAdaptiveLevel = countBaseChords(cgActiveChords);

    saveCGAdaptiveProgress();
}

// Load chord-grid adaptive progress
function loadCGAdaptiveProgress() {
    const saved = localStorage.getItem('ji_cg_adaptive_progress');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            const savedExpandFlag = data.chordGridRandomStart || false;

            // Initialize sorted chords with current flags
            initializeChordsSorted(chordGridRandomStart, chordGridIncludeInversions);

            // Set tutorial sequence dynamically
            cgTutorialSequence = allChordsSorted.length > 0 ? [allChordsSorted[0].key] : ['4:5:6'];

            // Check if expand flag changed - need migration
            if (savedExpandFlag !== chordGridRandomStart) {
                const migratedStats = {};
                const oldStats = data.cgChordStats || {};

                if (chordGridRandomStart && !savedExpandFlag) {
                    for (const oldKey in oldStats) {
                        const newKey = oldKey + '_sp0';
                        migratedStats[newKey] = oldStats[oldKey];
                    }
                } else if (!chordGridRandomStart && savedExpandFlag) {
                    for (const oldKey in oldStats) {
                        const newKey = oldKey.replace(/_sp\d+$/, '');
                        if (!migratedStats[newKey]) {
                            migratedStats[newKey] = oldStats[oldKey];
                        }
                    }
                }

                cgChordStats = migratedStats;

                const migratedActive = [];
                const oldActive = data.cgActiveChords || [];
                for (const savedChord of oldActive) {
                    const oldKey = savedChord.key || savedChord;
                    let newKey;
                    if (chordGridRandomStart && !savedExpandFlag) {
                        newKey = oldKey + '_sp0';
                    } else {
                        newKey = oldKey.replace(/_sp\d+$/, '');
                    }
                    const chord = allChordsSorted.find(c => c.key === newKey);
                    if (chord && !migratedActive.find(c => c.key === chord.key)) {
                        migratedActive.push(chord);
                    }
                }
                cgActiveChords = migratedActive;

                let oldNewChord = data.cgCurrentNewChord || null;
                if (oldNewChord) {
                    if (chordGridRandomStart && !savedExpandFlag) {
                        oldNewChord = oldNewChord + '_sp0';
                    } else {
                        oldNewChord = oldNewChord.replace(/_sp\d+$/, '');
                    }
                }
                cgCurrentNewChord = oldNewChord;
            } else {
                cgChordStats = data.cgChordStats || {};
                cgActiveChords = data.cgActiveChords || [];
                cgCurrentNewChord = data.cgCurrentNewChord || null;
            }

            cgAdaptiveLevel = data.cgAdaptiveLevel || 1;
            cgTutorialIndex = data.cgTutorialIndex !== undefined ? data.cgTutorialIndex : 0;
            cgTutorialActive = data.cgTutorialActive !== undefined ? data.cgTutorialActive : true;
            cgNewChordDrillCount = data.cgNewChordDrillCount || 0;

            // Restore chord references
            for (const key in cgChordStats) {
                const chord = allChordsSorted.find(c => c.key === key);
                if (chord) cgChordStats[key].chord = chord;
            }

            // Restore activeChords with full chord objects (if not already migrated)
            if (!Array.isArray(cgActiveChords[0]?.intervals)) {
                cgActiveChords = cgActiveChords.map(savedChord => {
                    const key = savedChord.key || savedChord;
                    return allChordsSorted.find(c => c.key === key);
                }).filter(c => c);
            }

            // Restore disabled chords
            cgDisabledChords = new Set(data.cgDisabledChords || []);

            cgAdaptiveLevel = countBaseChords(cgActiveChords);
            return true;
        } catch (e) {
            console.error('Failed to load CG adaptive progress:', e);
            return false;
        }
    }
    return false;
}

// Save chord-grid adaptive progress
function saveCGAdaptiveProgress() {
    const data = {
        cgChordStats: cgChordStats,
        cgActiveChords: cgActiveChords.map(c => ({ key: c.key })),
        cgAdaptiveLevel: cgAdaptiveLevel,
        cgTutorialIndex: cgTutorialIndex,
        cgTutorialActive: cgTutorialActive,
        cgNewChordDrillCount: cgNewChordDrillCount,
        cgCurrentNewChord: cgCurrentNewChord,
        chordGridRandomStart: chordGridRandomStart,
        chordGridIncludeInversions: chordGridIncludeInversions,
        cgDisabledChords: [...cgDisabledChords]
    };
    localStorage.setItem('ji_cg_adaptive_progress', JSON.stringify(data));
}

// Reset chord-grid adaptive progress
function resetCGAdaptiveProgress() {
    if (confirm('Are you sure you want to reset all Chords + Grid progress?')) {
        localStorage.removeItem('ji_cg_adaptive_progress');
        cgTutorialIndex = 0;
        cgTutorialActive = true;
        initializeCGAdaptiveMode();
        updateCGStats();
        updateCGLevelDisplay();
        alert('Chords + Grid progress reset!');
    }
}

// Resume from specific chord-grid level (input = number of base chords)
function resumeFromCGLevel(targetLevel) {
    if (targetLevel < 1) {
        alert('Level must be 1 or higher');
        return;
    }

    // Initialize sorted chords with current flags
    initializeChordsSorted(chordGridRandomStart, chordGridIncludeInversions);

    let numBaseChords = targetLevel;
    if (numBaseChords > TOTAL_BASE_CHORDS) {
        alert(`Maximum is ${TOTAL_BASE_CHORDS} base chords. Setting to maximum.`);
        numBaseChords = TOTAL_BASE_CHORDS;
    }

    cgChordStats = {};
    for (const chord of allChordsSorted) {
        cgChordStats[chord.key] = {
            attempts: 0,
            totalTime: 0,
            recentTimes: [],
            mastered: false,
            lastSeenQuestion: -1,
            chord: chord
        };
    }

    // Get all variants for the first N base chords
    const variantsToUnlock = getAllVariantsForFirstNBaseChords(numBaseChords, allChordsSorted);

    cgActiveChords = [];
    for (let i = 0; i < variantsToUnlock.length; i++) {
        const chord = variantsToUnlock[i];
        cgActiveChords.push(chord);
        if (cgChordStats[chord.key]) {
            if (i < variantsToUnlock.length - 2) {
                cgChordStats[chord.key].mastered = true;
                cgChordStats[chord.key].attempts = 10;
                cgChordStats[chord.key].totalTime = 10;
                cgChordStats[chord.key].recentTimes = [1, 1, 1, 1, 1];
            } else {
                cgChordStats[chord.key].attempts = 3;
                cgChordStats[chord.key].totalTime = 12;
                cgChordStats[chord.key].recentTimes = [4, 4, 4];
            }
        }
    }

    cgNewChordDrillCount = 0;
    cgCurrentNewChord = null;
    cgTutorialIndex = 9999;
    cgTutorialActive = false;
    cgAdaptiveLevel = countBaseChords(cgActiveChords);

    saveCGAdaptiveProgress();
    updateCGStats();
    updateCGLevelDisplay();

    alert(`Level ${cgAdaptiveLevel} — ${cgActiveChords.length} chord variant${cgActiveChords.length !== 1 ? 's' : ''} unlocked.`);
}

// Helper functions to get CG settings
function getCGMasteryThreshold() {
    const input = document.getElementById('cg-mastery-threshold-input');
    return input ? parseFloat(input.value) : 10;
}

function getCGMinAttempts() {
    const input = document.getElementById('cg-min-attempts-input');
    return input ? parseInt(input.value) : 5;
}

function getCGRollingWindow() {
    const input = document.getElementById('cg-rolling-average-window-input');
    return input ? parseInt(input.value) : 3;
}

function getCGNonMasteredRate() {
    const input = document.getElementById('cg-non-mastered-rate-input');
    return input ? parseInt(input.value) : 80;
}

// Update chord-grid level display
function updateCGLevelDisplay() {
    const levelEl = document.getElementById('cg-level-number');
    if (levelEl) levelEl.textContent = cgAdaptiveLevel;
    const gameLevelEl = document.getElementById('cg-game-level-number');
    if (gameLevelEl) gameLevelEl.textContent = cgAdaptiveLevel;
    // Refresh open detail panels
    const detailPanel = document.getElementById('cg-level-detail');
    if (detailPanel && detailPanel.style.display !== 'none') {
        detailPanel.innerHTML = buildLevelDetailHTML(cgActiveChords);
    }
    const gameDetailPanel = document.getElementById('cg-game-level-detail');
    if (gameDetailPanel && gameDetailPanel.style.display !== 'none') {
        gameDetailPanel.innerHTML = buildLevelDetailHTML(cgActiveChords);
    }
}

// Update chord-grid stats display
function updateCGStats() {
    const statsEl = document.getElementById('cg-stats');
    if (!statsEl) return;

    updateCGLevelDisplay();

    if (cgActiveChords.length === 0) {
        if (!loadCGAdaptiveProgress() || cgActiveChords.length === 0) {
            statsEl.innerHTML = '<p>Click "Start / Continue" to begin!</p>';
            return;
        }
    }

    const currentThreshold = getCGMasteryThreshold();
    const currentMinAttempts = getCGMinAttempts();
    const currentWindow = getCGRollingWindow();

    initDefaultCollapsedState(cgActiveChords, collapsedCGChordGroups);

    let html = buildGroupedChordHTML({
        chordList: cgActiveChords,
        statsObj: cgChordStats,
        disabledSet: cgDisabledChords,
        collapsedSet: collapsedCGChordGroups,
        cssPrefix: 'stat',
        masteryThreshold: currentThreshold,
        minAttempts: currentMinAttempts,
        rollingWindow: currentWindow,
        showIntervals: false,
        dataMode: 'cg'
    });

    const cgEnabledCount = cgActiveChords.filter(c => !cgDisabledChords.has(c.key)).length;
    html += `<p class="progress-text">Active chords: ${cgEnabledCount} / ${allChordsSorted.length} (${cgActiveChords.length} unlocked)</p>`;
    statsEl.innerHTML = html;

    attachChordGroupHandlers(statsEl, {
        chordList: cgActiveChords,
        disabledSet: cgDisabledChords,
        collapsedSet: collapsedCGChordGroups,
        saveFunc: saveCGAdaptiveProgress,
        updateFunc: updateCGStats,
        dataMode: 'cg'
    });
}

// Update chord-grid game progress display (in-game)
function updateCGGameProgress() {
    const progressContainer = document.getElementById('cg-game-interval-progress');
    const progressStats = document.getElementById('cg-game-progress-stats');

    if (!progressContainer || !progressStats) return;

    progressContainer.style.display = 'block';

    const currentThreshold = getCGMasteryThreshold();
    const currentMinAttempts = getCGMinAttempts();
    const currentWindow = getCGRollingWindow();

    initDefaultCollapsedState(cgActiveChords, collapsedCGChordGroups);

    let html = buildGroupedChordHTML({
        chordList: cgActiveChords,
        statsObj: cgChordStats,
        disabledSet: cgDisabledChords,
        collapsedSet: collapsedCGChordGroups,
        cssPrefix: 'game-stat',
        masteryThreshold: currentThreshold,
        minAttempts: currentMinAttempts,
        rollingWindow: currentWindow,
        showIntervals: true,
        dataMode: 'cg'
    });

    // Show drill progress if drilling (outside grouping)
    if (cgCurrentNewChord) {
        const newChord = allChordsSorted.find(c => c.key === cgCurrentNewChord);
        if (newChord) {
            const newChordIntervalsDisplay = newChord.expectedIntervals.map(i => `${i.num}/${i.denom}`).join(', ');
            const newChordPosInfo = newChord.positionLabel ? ` <small>${newChord.positionLabel}</small>` : '';
            html += `
                <div class="game-stat-item drilling">
                    <div class="game-stat-interval">${newChord.name}${newChordPosInfo}</div>
                    <div class="game-stat-details">
                        <span class="game-stat-cents">${newChordIntervalsDisplay}</span>
                    </div>
                    <div class="game-stat-info">
                        <span class="game-stat-badge drilling">Drilling: ${cgNewChordDrillCount}/${cgNewChordDrillTarget}</span>
                    </div>
                </div>
            `;
        }
    }

    progressStats.innerHTML = html;

    attachChordGroupHandlers(progressStats, {
        chordList: cgActiveChords,
        disabledSet: cgDisabledChords,
        collapsedSet: collapsedCGChordGroups,
        saveFunc: saveCGAdaptiveProgress,
        updateFunc: updateCGGameProgress,
        dataMode: 'cg'
    });
}

// Weighted random chord selection for chord-grid mode
function selectWeightedRandomCGChord() {
    // Filter out disabled chords
    const enabledChords = cgActiveChords.filter(c => !cgDisabledChords.has(c.key));
    if (enabledChords.length === 0) return null;

    const n = enabledChords.length;
    const guaranteedWindow = 3 * n;

    // Check for chords that MUST appear
    const mustAppearChords = [];
    for (const chord of enabledChords) {
        const stats = cgChordStats[chord.key];
        if (stats) {
            const questionsSinceLastSeen = cgGlobalQuestionCounter - stats.lastSeenQuestion;
            if (stats.lastSeenQuestion === -1 || questionsSinceLastSeen >= guaranteedWindow) {
                mustAppearChords.push(chord);
            }
        }
    }

    if (mustAppearChords.length > 0) {
        return mustAppearChords[Math.floor(Math.random() * mustAppearChords.length)];
    }

    // Weighted random selection
    const chordWeights = [];
    let totalWeight = 0;
    const currentThreshold = getCGMasteryThreshold();
    const currentNonMasteredRate = getCGNonMasteredRate();
    const currentWindow = getCGRollingWindow();

    let masteredCount = 0;
    let nonMasteredCount = 0;

    for (const chord of enabledChords) {
        const stats = cgChordStats[chord.key];
        if (stats && stats.mastered) masteredCount++;
        else nonMasteredCount++;
    }

    const masteredBaseWeight = nonMasteredCount > 0 ? (100 - currentNonMasteredRate) / masteredCount : 1;
    const nonMasteredBaseWeight = nonMasteredCount > 0 ? currentNonMasteredRate / nonMasteredCount : 1;

    for (const chord of enabledChords) {
        const stats = cgChordStats[chord.key];
        let weight;

        if (stats && stats.mastered) {
            weight = masteredBaseWeight;
        } else if (stats && stats.recentTimes.length > 0) {
            const recentTimesWindow = stats.recentTimes.slice(-currentWindow);
            const avgTime = recentTimesWindow.reduce((a, b) => a + b, 0) / recentTimesWindow.length;
            weight = nonMasteredBaseWeight * (1 + avgTime / currentThreshold);
        } else {
            weight = nonMasteredBaseWeight;
        }

        chordWeights.push({ chord, weight });
        totalWeight += weight;
    }

    let random = Math.random() * totalWeight;
    for (const item of chordWeights) {
        random -= item.weight;
        if (random <= 0) return item.chord;
    }

    return chordWeights[chordWeights.length - 1].chord;
}

// Check and unlock next chord in chord-grid mode
function checkAndUnlockNextCGChord() {
    const currentThreshold = getCGMasteryThreshold();
    const currentMinAttempts = getCGMinAttempts();
    const currentWindow = getCGRollingWindow();

    let allMastered = true;
    for (const chord of cgActiveChords) {
        const stats = cgChordStats[chord.key];
        if (!stats) continue;

        const recentTimesWindow = stats.recentTimes.slice(-currentWindow);
        const avgRecent = recentTimesWindow.length > 0
            ? recentTimesWindow.reduce((a, b) => a + b, 0) / recentTimesWindow.length
            : 999;

        const isMastered = stats.attempts >= currentMinAttempts && avgRecent < currentThreshold;
        stats.mastered = isMastered;
        if (!isMastered && !cgDisabledChords.has(chord.key)) allMastered = false;
    }

    if (allMastered && cgActiveChords.length < allChordsSorted.length && !cgCurrentNewChord) {
        const activeKeys = new Set(cgActiveChords.map(c => c.key));
        const nextChord = allChordsSorted.find(c => !activeKeys.has(c.key));

        if (nextChord) {
            cgCurrentNewChord = nextChord.key;
            cgNewChordDrillCount = 0;

            // Check if this chord introduces a new base chord
            const nextBaseKey = getBaseChordForGrouping(nextChord.key);
            const currentBases = getUniqueBaseChords(cgActiveChords);
            const isNewBaseChord = !currentBases.has(nextBaseKey);

            if (isNewBaseChord) {
                cgAdaptiveLevel = currentBases.size + 1;
            }
            updateCGLevelDisplay();

            const feedbackEl = document.getElementById('chord-grid-feedback');
            if (feedbackEl) {
                const cgPosInfo = nextChord.positionLabel ? ` ${nextChord.positionLabel}` : '';
                if (isNewBaseChord) {
                    const baseName = CHORD_NAMES[nextBaseKey] || nextBaseKey;
                    feedbackEl.innerHTML = `<strong>Level ${cgAdaptiveLevel}! New chord unlocked: ${baseName}!</strong><br>${nextChord.name}${cgPosInfo} (${nextChord.chordKey})<br><em>Practice ${cgNewChordDrillTarget} times before it's added to the mix</em>`;
                } else {
                    feedbackEl.innerHTML = `<strong>New variant unlocked: ${nextChord.name}${cgPosInfo}!</strong><br>(${nextChord.chordKey})<br><em>Practice ${cgNewChordDrillTarget} times before it's added to the mix</em>`;
                }
                feedbackEl.className = 'feedback';
                feedbackEl.style.background = '#d1ecf1';
                feedbackEl.style.color = '#0c5460';
            }

            saveCGAdaptiveProgress();
        }
    }

    if (chordGridScore % 5 === 0) {
        saveCGAdaptiveProgress();
    }
}

// End the chord-grid game
function endChordGridGame() {
    chordGridGameActive = false;
    if (chordGridTimerInterval) {
        clearInterval(chordGridTimerInterval);
        chordGridTimerInterval = null;
    }
    saveCGAdaptiveProgress();
}

// Reset the chord-grid game (resets adaptive progress)
function resetChordGridGame() {
    endChordGridGame();
    resetCGAdaptiveProgress();
}

// Select next chord for chord-grid mode (adaptive weighted)
function selectNextChordGridChord() {
    if (cgActiveChords.length === 0) return;

    // Drilling new chord
    if (cgCurrentNewChord && cgNewChordDrillCount < cgNewChordDrillTarget) {
        cgCurrentChord = cgCurrentNewChord;
    }
    // Tutorial
    else if (cgTutorialActive && cgTutorialIndex < cgTutorialSequence.length) {
        cgCurrentChord = cgTutorialSequence[cgTutorialIndex];
    }
    // Normal weighted selection
    else {
        cgTutorialActive = false;
        let attempts = 0;
        const maxAttempts = 50;

        do {
            const selectedChord = selectWeightedRandomCGChord();
            if (!selectedChord) break;
            cgCurrentChord = selectedChord.key;
            attempts++;
            if (cgActiveChords.length > 1 && cgLastChord && cgCurrentChord === cgLastChord) continue;
            break;
        } while (attempts < maxAttempts);
    }

    // Update tracking
    if (cgChordStats[cgCurrentChord]) {
        cgChordStats[cgCurrentChord].lastSeenQuestion = cgGlobalQuestionCounter;
    }
    cgGlobalQuestionCounter++;
    cgLastChord = cgCurrentChord;

    // Look up the chord entry from allChordsSorted
    const cgChordEntry = allChordsSorted.find(c => c.key === cgCurrentChord);

    // Use entry's pre-computed starting position and expected intervals
    cgCurrentStartingPosition = cgChordEntry ? cgChordEntry.startingPosition : 0;
    cgCurrentExpectedIntervals = cgChordEntry ? cgChordEntry.expectedIntervals : CHORD_TYPES[cgCurrentChord];

    // Reset chord building state
    cgChordProgress = [];
    cgCurrentComposition = [{ num: 1, denom: 1 }];

    // Update chord display
    updateChordGridChordDisplay();
}

// Update the chord display in the game panel
function updateChordGridChordDisplay() {
    const nameEl = document.getElementById('chord-grid-chord-name');
    const notationEl = document.getElementById('chord-grid-chord-notation');
    const intervalsEl = document.getElementById('chord-grid-chord-intervals');
    const startPosEl = document.getElementById('chord-grid-starting-position');

    if (!nameEl) return;

    // Look up the chord entry
    const cgDisplayEntry = allChordsSorted.find(c => c.key === cgCurrentChord);
    const traditionalName = cgDisplayEntry ? cgDisplayEntry.name : (CHORD_NAMES[cgCurrentChord] || cgCurrentChord);
    const harmonicNotation = cgDisplayEntry ? cgDisplayEntry.chordKey : cgCurrentChord;

    nameEl.textContent = traditionalName;
    notationEl.textContent = harmonicNotation;

    const intervalsHTML = cgCurrentExpectedIntervals.map(int =>
        `<span class="chord-interval" data-interval="${int.num}/${int.denom}">${int.num}/${int.denom}</span>`
    ).join(', ');
    intervalsEl.innerHTML = intervalsHTML;

    // Starting position
    const posLabel = cgDisplayEntry ? cgDisplayEntry.positionLabel : '';
    if (posLabel) {
        startPosEl.innerHTML = `Starting <strong>${posLabel}</strong>`;
    } else {
        startPosEl.innerHTML = '';
    }
}

// Place target at random position (not on player)
function placeChordGridTarget() {
    chordGridTargetStartTime = Date.now();
    let newRow, newCol;
    do {
        newRow = Math.floor(Math.random() * chordGridSize);
        newCol = Math.floor(Math.random() * chordGridSize);
    } while (newRow === chordGridPlayerRow && newCol === chordGridPlayerCol);
    chordGridTargetRow = newRow;
    chordGridTargetCol = newCol;
}

// Move player in chord-grid mode
function moveChordGridPlayer(dRow, dCol) {
    if (!chordGridGameActive || chordGridPhase !== 'grid') return;

    const newRow = chordGridPlayerRow + dRow;
    const newCol = chordGridPlayerCol + dCol;

    if (newRow >= 0 && newRow < chordGridSize && newCol >= 0 && newCol < chordGridSize) {
        chordGridPlayerRow = newRow;
        chordGridPlayerCol = newCol;
        renderChordGrid();
    }
}

// Capture target in chord-grid mode
function captureChordGridTarget() {
    if (!chordGridGameActive || chordGridPhase !== 'grid') return;

    if (chordGridPlayerRow === chordGridTargetRow && chordGridPlayerCol === chordGridTargetCol) {
        // Transition to chord phase
        setChordGridPhase('chord');
    }
}

// Set phase (grid or chord)
function setChordGridPhase(phase) {
    chordGridPhase = phase;

    const phaseIndicator = document.getElementById('chord-grid-phase-indicator');
    const gridContainer = document.getElementById('chord-grid-container');
    const pianoRoll = document.getElementById('chord-grid-piano-roll');
    const keyboardLegend = document.getElementById('chord-grid-keyboard-legend');
    const compositionDisplay = document.getElementById('chord-grid-composition-display');
    const controlsInfo = document.getElementById('chord-grid-controls-info');
    const chordLabel = document.querySelector('.chord-grid-chord-label');

    if (phase === 'grid') {
        if (phaseIndicator) {
            phaseIndicator.className = 'chord-grid-phase-indicator grid-phase';
            phaseIndicator.textContent = 'Grid Phase - Navigate to target';
        }
        if (gridContainer) gridContainer.classList.remove('chord-phase-dimmed');
        if (pianoRoll) pianoRoll.style.display = 'flex';
        if (keyboardLegend) keyboardLegend.style.display = 'none';
        if (compositionDisplay) compositionDisplay.style.display = 'none';
        if (controlsInfo) controlsInfo.style.display = 'block';
        if (chordLabel) chordLabel.textContent = 'Upcoming Chord:';

        // Render piano roll as static preview (no arrow, all grey)
        renderChordGridPianoRollPreview();
    } else {
        if (phaseIndicator) {
            phaseIndicator.className = 'chord-grid-phase-indicator chord-phase';
            phaseIndicator.textContent = 'Chord Phase - Build the chord!';
        }
        if (gridContainer) gridContainer.classList.add('chord-phase-dimmed');
        if (pianoRoll) pianoRoll.style.display = 'flex';
        if (keyboardLegend) keyboardLegend.style.display = 'block';
        if (compositionDisplay) compositionDisplay.style.display = 'flex';
        if (controlsInfo) controlsInfo.style.display = 'none';
        if (chordLabel) chordLabel.textContent = 'Build this chord:';

        // Reset chord state for building (auto-place 1/1)
        cgChordProgress = [{ num: 1, denom: 1 }];
        cgCurrentComposition = [{ num: 1, denom: 1 }];
        updateChordGridCompositionDisplay();
        renderChordGridPianoRoll();
        playSingleTone(1, 1);

        // Reset interval highlights, then mark 1/1 as placed
        const spans = document.querySelectorAll('#chord-grid-chord-intervals .chord-interval');
        spans.forEach(span => {
            span.style.color = '';
            span.style.fontWeight = '';
        });
        // Mark 1/1 as already entered
        spans.forEach(span => {
            if (span.dataset.interval === '1/1') {
                span.style.color = 'green';
                span.style.fontWeight = 'bold';
            }
        });
    }
}

// Handle keypress in chord-grid mode
function handleChordGridKeyPress(event) {
    if (!chordGridGameActive) return;

    const key = event.key.toLowerCase();

    if (chordGridPhase === 'grid') {
        // Grid phase: ASDF movement + Tab capture
        switch (key) {
            case 'a':
                event.preventDefault();
                moveChordGridPlayer(0, -1);
                break;
            case 's':
                event.preventDefault();
                moveChordGridPlayer(-1, 0);
                break;
            case 'd':
                event.preventDefault();
                moveChordGridPlayer(1, 0);
                break;
            case 'f':
                event.preventDefault();
                moveChordGridPlayer(0, 1);
                break;
            case 'tab':
                event.preventDefault();
                captureChordGridTarget();
                break;
        }
    } else {
        // Chord phase: chord building keys
        handleChordGridChordKeypress(event, key);
    }
}

// Handle chord building keypress in chord-grid mode
function handleChordGridChordKeypress(event, key) {
    const feedbackEl = document.getElementById('chord-grid-feedback');

    // Backspace - reset chord (keep 1/1 auto-placed)
    if (key === 'backspace') {
        event.preventDefault();
        cgCurrentComposition = [{ num: 1, denom: 1 }];
        cgChordProgress = [{ num: 1, denom: 1 }];
        updateChordGridCompositionDisplay();
        renderChordGridPianoRoll();

        // Reset interval highlights, then mark 1/1 as placed
        const spans = document.querySelectorAll('#chord-grid-chord-intervals .chord-interval');
        spans.forEach(span => {
            span.style.color = '';
            span.style.fontWeight = '';
        });
        spans.forEach(span => {
            if (span.dataset.interval === '1/1') {
                span.style.color = 'green';
                span.style.fontWeight = 'bold';
            }
        });

        if (feedbackEl) {
            feedbackEl.textContent = '';
            feedbackEl.className = 'feedback';
            feedbackEl.style.background = '';
            feedbackEl.style.color = '';
        }
        return;
    }

    // Submit key - check interval
    if (key === submitKey.toLowerCase()) {
        event.preventDefault();

        const product = multiplyFractions(cgCurrentComposition);
        const intervalKey = `${product.num}/${product.denom}`;

        const expectedSet = new Set(cgCurrentExpectedIntervals.map(i => `${i.num}/${i.denom}`));
        const alreadyEnteredSet = new Set(cgChordProgress.map(i => `${i.num}/${i.denom}`));

        if (expectedSet.has(intervalKey) && !alreadyEnteredSet.has(intervalKey)) {
            // Correct interval
            cgChordProgress.push(product);

            // Mark interval correct (green + wiggle)
            const spans = document.querySelectorAll('#chord-grid-chord-intervals .chord-interval');
            spans.forEach(span => {
                if (span.dataset.interval === intervalKey) {
                    span.style.color = 'green';
                    span.style.fontWeight = 'bold';
                    span.classList.add('wiggle');
                    setTimeout(() => span.classList.remove('wiggle'), 600);
                }
            });

            // Play single tone
            playSingleTone(product.num, product.denom);

            // Reset composition for next interval
            cgCurrentComposition = [{ num: 1, denom: 1 }];
            updateChordGridCompositionDisplay();
            renderChordGridPianoRoll();

            // Check if chord is complete
            if (cgChordProgress.length === cgCurrentExpectedIntervals.length) {
                // Chord complete!
                const targetTime = (Date.now() - chordGridTargetStartTime) / 1000;
                chordGridTotalTime += targetTime;
                chordGridScore++;
                updateChordGridStats();

                // Record stats for adaptive progression (skip during drill phase — drill times shouldn't count toward mastery)
                const cgIsDrilling = cgCurrentNewChord && cgCurrentChord === cgCurrentNewChord && cgNewChordDrillCount < cgNewChordDrillTarget;
                if (!cgIsDrilling && cgChordStats[cgCurrentChord]) {
                    cgChordStats[cgCurrentChord].attempts++;
                    cgChordStats[cgCurrentChord].totalTime += targetTime;
                    cgChordStats[cgCurrentChord].recentTimes.push(targetTime);
                    // Keep recent times bounded
                    if (cgChordStats[cgCurrentChord].recentTimes.length > 20) {
                        cgChordStats[cgCurrentChord].recentTimes = cgChordStats[cgCurrentChord].recentTimes.slice(-20);
                    }
                }

                // Handle drill counting for new chord
                if (cgCurrentNewChord && cgCurrentChord === cgCurrentNewChord) {
                    cgNewChordDrillCount++;

                    if (cgNewChordDrillCount >= cgNewChordDrillTarget) {
                        // Add to active chords
                        const chordToAdd = allChordsSorted.find(c => c.key === cgCurrentNewChord);
                        if (chordToAdd && !cgActiveChords.find(c => c.key === chordToAdd.key)) {
                            cgActiveChords.push(chordToAdd);
                            if (!cgChordStats[chordToAdd.key]) {
                                cgChordStats[chordToAdd.key] = {
                                    attempts: 0, totalTime: 0, recentTimes: [],
                                    mastered: false, lastSeenQuestion: -1, chord: chordToAdd
                                };
                            }
                        }
                        cgCurrentNewChord = null;
                        cgNewChordDrillCount = 0;
                        cgAdaptiveLevel = countBaseChords(cgActiveChords);
                        updateCGLevelDisplay();
                        saveCGAdaptiveProgress();
                    }
                }

                // Handle tutorial progression
                if (cgTutorialActive) {
                    cgTutorialIndex++;
                }

                // Check mastery and unlock next chord
                checkAndUnlockNextCGChord();

                // Update progress display
                updateCGGameProgress();

                // Show feedback
                let drillMsg = '';
                if (cgCurrentNewChord && cgCurrentChord === cgCurrentNewChord) {
                    drillMsg = ` | Drill: ${cgNewChordDrillCount}/${cgNewChordDrillTarget}`;
                }

                setTimeout(() => {
                    if (feedbackEl) {
                        feedbackEl.textContent = `Correct! (${targetTime.toFixed(2)}s)${drillMsg}`;
                        feedbackEl.className = 'feedback correct';
                    }
                    // Play chord audio
                    playChordAudio(cgCurrentExpectedIntervals);
                }, 300);

                // After delay, transition back to grid phase with new chord + target
                setTimeout(() => {
                    if (!chordGridGameActive) return;

                    if (feedbackEl) {
                        feedbackEl.textContent = '';
                        feedbackEl.className = 'feedback';
                        feedbackEl.style.background = '';
                        feedbackEl.style.color = '';
                    }

                    // Select next chord and place new target
                    selectNextChordGridChord();
                    placeChordGridTarget();

                    // Switch back to grid phase
                    setChordGridPhase('grid');
                    renderChordGrid();

                    // Focus grid
                    const container = document.getElementById('chord-grid-container');
                    if (container) container.focus();
                }, 1300);
            }
        } else {
            // Wrong interval - reset chord progress (keep 1/1 auto-placed)
            playSingleTone(product.num, product.denom);

            cgCurrentComposition = [{ num: 1, denom: 1 }];
            cgChordProgress = [{ num: 1, denom: 1 }];
            updateChordGridCompositionDisplay();
            renderChordGridPianoRoll();

            // Reset drill count on wrong answer
            if (cgCurrentNewChord && cgCurrentChord === cgCurrentNewChord) {
                cgNewChordDrillCount = 0;
            }

            // Reset interval highlights, then mark 1/1 as placed
            const spans = document.querySelectorAll('#chord-grid-chord-intervals .chord-interval');
            spans.forEach(span => {
                span.style.color = '';
                span.style.fontWeight = '';
            });
            spans.forEach(span => {
                if (span.dataset.interval === '1/1') {
                    span.style.color = 'green';
                    span.style.fontWeight = 'bold';
                }
            });

            if (feedbackEl) {
                feedbackEl.textContent = `Wrong interval! Expected one of: ${[...expectedSet].filter(i => !alreadyEnteredSet.has(i)).join(', ')}`;
                feedbackEl.className = 'feedback incorrect';
                feedbackEl.style.background = '#f8d7da';
                feedbackEl.style.color = '#721c24';
            }

            setTimeout(() => {
                if (feedbackEl) {
                    feedbackEl.textContent = '';
                    feedbackEl.className = 'feedback';
                    feedbackEl.style.background = '';
                    feedbackEl.style.color = '';
                }
            }, 2000);
        }
        return;
    }

    // Add to composition
    if (allMappings[key]) {
        event.preventDefault();
        cgCurrentComposition.push(allMappings[key]);
        updateChordGridCompositionDisplay();
        renderChordGridPianoRoll();
    }
}

// Render the chord-grid game grid
function renderChordGrid() {
    const container = document.getElementById('chord-grid-container');
    if (!container) return;
    container.innerHTML = '';
    container.tabIndex = 0;

    for (let row = 0; row < chordGridSize; row++) {
        for (let col = 0; col < chordGridSize; col++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';

            if (row === chordGridPlayerRow && col === chordGridPlayerCol) {
                cell.classList.add('player-cell');
                cell.textContent = '◆';
            } else if (row === chordGridTargetRow && col === chordGridTargetCol) {
                cell.classList.add('target-cell');
                cell.textContent = '●';
            }

            container.appendChild(cell);
        }
    }

    container.style.gridTemplateColumns = `repeat(${chordGridSize}, 1fr)`;
}

// Render piano roll for chord-grid mode
function renderChordGridPianoRoll() {
    const container = document.getElementById('chord-grid-piano-roll');
    if (!container || !cgCurrentChord) return;

    const intervals = cgCurrentExpectedIntervals;
    if (!intervals || intervals.length === 0) return;

    // Calculate positions
    const positions = intervals.map(interval => Math.log2(interval.num / interval.denom));
    const minPos = Math.min(...positions);
    const maxPos = Math.max(...positions);
    const padding = 0.25;
    const paddedMin = minPos - padding;
    const paddedMax = maxPos + padding;
    const totalRange = paddedMax - paddedMin;

    const pixelsPerOctave = 100;
    const height = totalRange * pixelsPerOctave;
    const arrowWidth = 25;
    const noteWidth = 80;
    const barHeight = 10;
    const width = arrowWidth + noteWidth + 5;

    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;

    const enteredSet = new Set(cgChordProgress.map(i => `${i.num}/${i.denom}`));

    intervals.forEach((interval, index) => {
        const pos = positions[index];
        const normalizedPos = (pos - paddedMin) / totalRange;
        const y = height - (normalizedPos * height) - barHeight / 2;
        const isEntered = enteredSet.has(`${interval.num}/${interval.denom}`);
        const color = isEntered ? '#4caf50' : '#999';

        svg += `<rect x="${arrowWidth}" y="${y}" width="${noteWidth}" height="${barHeight}"
                fill="${color}" stroke="#000" stroke-width="1" rx="2"/>`;
    });

    // Arrow for current composition
    const currentValue = multiplyFractions(cgCurrentComposition);
    if (currentValue) {
        const currentRatio = currentValue.num / currentValue.denom;
        const currentPos = Math.log2(currentRatio);
        const normalizedPos = (currentPos - paddedMin) / totalRange;
        const arrowY = height - (normalizedPos * height);

        svg += `<path d="M ${arrowWidth - 5} ${arrowY} L 5 ${arrowY - 6} L 5 ${arrowY + 6} Z"
                fill="#4caf50" class="root-arrow"/>`;
    }

    svg += '</svg>';
    container.innerHTML = svg;
}

// Render piano roll as a static preview (grid phase - no arrow, all bars grey)
function renderChordGridPianoRollPreview() {
    const container = document.getElementById('chord-grid-piano-roll');
    if (!container || !cgCurrentChord) return;

    const intervals = cgCurrentExpectedIntervals;
    if (!intervals || intervals.length === 0) return;

    const positions = intervals.map(interval => Math.log2(interval.num / interval.denom));
    const minPos = Math.min(...positions);
    const maxPos = Math.max(...positions);
    const padding = 0.25;
    const paddedMin = minPos - padding;
    const paddedMax = maxPos + padding;
    const totalRange = paddedMax - paddedMin;

    const pixelsPerOctave = 100;
    const height = totalRange * pixelsPerOctave;
    const arrowWidth = 25;
    const noteWidth = 80;
    const barHeight = 10;
    const width = arrowWidth + noteWidth + 5;

    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;

    intervals.forEach((interval, index) => {
        const pos = positions[index];
        const normalizedPos = (pos - paddedMin) / totalRange;
        const y = height - (normalizedPos * height) - barHeight / 2;

        svg += `<rect x="${arrowWidth}" y="${y}" width="${noteWidth}" height="${barHeight}"
                fill="#999" stroke="#000" stroke-width="1" rx="2"/>`;
    });

    // Arrow pointing at 1/1 (the starting note)
    const startPos = Math.log2(1); // 0
    const normalizedStart = (startPos - paddedMin) / totalRange;
    const arrowY = height - (normalizedStart * height);

    svg += `<path d="M ${arrowWidth - 5} ${arrowY} L 5 ${arrowY - 6} L 5 ${arrowY + 6} Z"
            fill="#4caf50" class="root-arrow"/>`;

    svg += '</svg>';
    container.innerHTML = svg;
}

// Update composition display for chord-grid mode
function updateChordGridCompositionDisplay() {
    const el = document.getElementById('chord-grid-composition');
    if (!el) return;

    if (cgCurrentComposition.length === 0 || (cgCurrentComposition.length === 1 && cgCurrentComposition[0].num === 1 && cgCurrentComposition[0].denom === 1)) {
        el.textContent = 'Press keys to build interval...';
        el.style.color = '#999';
        return;
    }

    const product = multiplyFractions(cgCurrentComposition);

    if (cgCurrentComposition.length === 1) {
        el.innerHTML = `<strong>${product.num}/${product.denom}</strong>`;
    } else {
        const parts = cgCurrentComposition.map(c => `${c.num}/${c.denom}`).join(' × ');
        el.innerHTML = `${parts} = <strong>${product.num}/${product.denom}</strong>`;
    }
    el.style.color = '#333';
}

function updateChordGridTimer() {
    if (!chordGridGameActive || !chordGridStartTime) return;
    const el = document.getElementById('chord-grid-timer');
    if (el) el.textContent = formatElapsedTime(chordGridStartTime);
}

// Update chord-grid stats
function updateChordGridStats() {
    const scoreEl = document.getElementById('chord-grid-score');
    const avgEl = document.getElementById('chord-grid-avg-time');

    if (scoreEl) scoreEl.textContent = chordGridScore;
    if (avgEl) {
        avgEl.textContent = chordGridScore > 0
            ? (chordGridTotalTime / chordGridScore).toFixed(2) + 's'
            : '0.00s';
    }
}

function renderChordGridKeyboardLegend() {
    renderKeyboardLegendInto(document.getElementById('chord-grid-legend-grid'));
}
