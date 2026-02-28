// Game state
let gameActive = false;
let gameMode = 'interval'; // 'interval', 'chord', or 'adaptive'
let currentInterval = null;
let currentChord = null;
let questionCount = 0;
let totalTime = 0;
let intervalPool = [];
let chordPool = [];
let remainingIntervals = [];
let remainingChords = [];
let startTime = null;
let timerInterval = null;
let questionStartTime = null;
let currentComposition = []; // Array of {num, denom} fractions
let chordProgress = []; // For chord mode: array of entered intervals
let repeatSlowThreshold = 5; // seconds

// Adaptive mode state
let adaptiveMode = false;
let intervalStats = {}; // { 'num/denom': { attempts: 0, totalTime: 0, recentTimes: [], mastered: false, lastSeenQuestion: -1 } }
let activeIntervals = []; // Currently unlocked intervals
let allIntervalsSorted = []; // All intervals sorted by complexity
let masteryThreshold = 2.5; // seconds
let minAttemptsForMastery = 5;
let newIntervalWeight = 3;
let rollingAverageWindow = 10; // number of recent attempts to average for mastery check
let nonMasteredRate = 60; // percentage of questions that should be non-mastered intervals
let displayMode = 'all'; // 'all', 'fraction', 'cents', 'name', 'rotate-fraction-cents', 'rotate-fraction-name', 'rotate-cents-name', 'rotate-all'
let currentRotationIndex = 0; // Track current rotation state for cycling display modes
let adaptiveLevel = 1; // Current level (starts at 1, increments when new intervals added)
let lastInterval = null; // Track last interval to prevent immediate repeats
let globalQuestionCounter = 0; // Track total questions asked in current session for guaranteed appearance
let tutorialSequence = ['2/1', '3/2', '5/4', '7/4', '11/8']; // First 5 questions in order - the initial ascending intervals
let tutorialIndex = 0; // Current position in tutorial sequence
let tutorialActive = true; // Whether tutorial is active

// Sound settings
let synthType = 'sawtooth'; // 'sawtooth', 'sine', 'square', 'triangle'
let releaseTime = 2; // seconds
let varyPitch = true; // vary starting pitch
let enableSound = true; // enable/disable sound
let earTrainingMode = false; // hide target interval for ear training

// Key mappings - default mappings
const DEFAULT_PRIME_MAPPINGS = {
    '1': { num: 2, denom: 1 },
    '2': { num: 3, denom: 2 },
    '3': { num: 5, denom: 4 },
    '4': { num: 7, denom: 4 },
    '5': { num: 11, denom: 8 },
    '6': { num: 13, denom: 8 },
    '7': { num: 17, denom: 16 },
    '8': { num: 19, denom: 16 },
    '9': { num: 23, denom: 16 },
    '0': { num: 29, denom: 16 }
};

const DEFAULT_RECIPROCAL_MAPPINGS = {
    'q': { num: 1, denom: 2 },
    'w': { num: 2, denom: 3 },
    'e': { num: 4, denom: 5 },
    'r': { num: 4, denom: 7 },
    't': { num: 8, denom: 11 },
    'y': { num: 8, denom: 13 },
    'u': { num: 16, denom: 17 },
    'i': { num: 16, denom: 19 },
    'o': { num: 16, denom: 23 },
    'p': { num: 16, denom: 29 }
};

// Current mappings (can be customized)
let primeMappings = { ...DEFAULT_PRIME_MAPPINGS };
let reciprocalMappings = { ...DEFAULT_RECIPROCAL_MAPPINGS };

// All mappings combined
let allMappings = {};

// Interval names mapping
const INTERVAL_NAMES = {
    '16/15': 'minor semitone',
    '15/14': 'major semitone',
    '12/11': 'neutral second',
    '11/10': 'greater undecimal neutral second',
    '10/9': 'minor whole tone',
    '9/8': 'major whole tone',
    '8/7': 'septimal whole tone',
    '7/6': 'septimal subminor third',
    '6/5': 'minor third',
    '5/4': 'major third',
    '9/7': 'septimal supermajor third',
    '4/3': 'perfect fourth',
    '11/8': 'undecimal tritone',
    '7/5': 'septimal tritone',
    '10/7': 'septimal tritone',
    '16/11': 'undecimal tritone',
    '3/2': 'perfect fifth',
    '14/9': 'septimal subminor sixth',
    '8/5': 'minor sixth',
    '5/3': 'major sixth',
    '12/7': 'septimal supermajor sixth',
    '7/4': 'harmonic seventh',
    '16/9': 'Pythagorean minor seventh',
    '9/5': 'minor seventh',
    '20/11': 'lesser undecimal neutral seventh',
    '11/6': 'neutral seventh',
    '28/15': 'major seventh',
    '15/8': 'major seventh',
    '2/1': 'octave',
    '17/16': 'semitone',
    '18/17': 'semitone',
    '19/16': 'undevicesimal augmented second',
    '20/19': 'small semitone',
    '21/20': 'minor semitone',
    '22/21': 'undecimal semitone',
    '13/12': 'tridecimal 2/3-tone',
    '14/13': 'tridecimal 2/3-tone',
    '13/11': 'tridecimal minor third',
    '11/9': 'undecimal neutral third',
    '16/13': 'tridecimal major third',
    '13/10': 'tridecimal major third',
    '21/16': 'augmented fourth',
    '32/21': 'diminished fifth',
    '13/9': 'tridecimal diminished sixth',
    '18/13': 'tridecimal augmented fifth',
    '20/13': 'tridecimal minor sixth',
    '13/8': 'tridecimal neutral sixth',
    '22/13': 'tridecimal major sixth',
    '13/7': 'tridecimal minor seventh',
    '27/14': 'septimal major seventh',
    '23/16': 'vicesimotertial major second',
    '32/23': 'vicesimotertial diminished seventh',
    '23/18': 'vicesimotertial major third',
    '23/20': 'vicesimotertial minor third',
    '29/16': 'twenty-ninth harmonic',
    '32/29': 'twenty-ninth subharmonic',
    '27/16': 'Pythagorean major sixth',
    '27/20': 'acute fourth',
    '40/27': 'grave fifth',
    '25/16': 'augmented fifth',
    '32/25': 'diminished fourth',
    '25/24': 'classic chromatic semitone',
    '24/23': 'vicesimotertial semitone',
    '25/21': 'quasi-diminished fourth',
    '21/17': 'submajor third',
    '17/14': 'supraminor third',
    '25/18': 'augmented fourth',
    '27/25': 'large limma'
};

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

// Chord definitions
const CHORD_TYPES = {
    'Major': [{ num: 5, denom: 4 }, { num: 3, denom: 2 }],
    'Minor': [{ num: 6, denom: 5 }, { num: 3, denom: 2 }],
    'Diminished': [{ num: 6, denom: 5 }, { num: 7, denom: 5 }],
    'Augmented': [{ num: 5, denom: 4 }, { num: 25, denom: 16 }],
    'Sus4': [{ num: 4, denom: 3 }, { num: 3, denom: 2 }],
    'Sus2': [{ num: 9, denom: 8 }, { num: 3, denom: 2 }],
    'Dominant 7th': [{ num: 5, denom: 4 }, { num: 3, denom: 2 }, { num: 9, denom: 5 }],
    'Major 7th': [{ num: 5, denom: 4 }, { num: 3, denom: 2 }, { num: 15, denom: 8 }],
    'Minor 7th': [{ num: 6, denom: 5 }, { num: 3, denom: 2 }, { num: 9, denom: 5 }],
    'Harmonic 7th': [{ num: 5, denom: 4 }, { num: 3, denom: 2 }, { num: 7, denom: 4 }],
    'Subminor 7th': [{ num: 6, denom: 5 }, { num: 3, denom: 2 }, { num: 7, denom: 4 }],
    'Major 6th': [{ num: 5, denom: 4 }, { num: 3, denom: 2 }, { num: 5, denom: 3 }],
    'Minor 6th': [{ num: 6, denom: 5 }, { num: 3, denom: 2 }, { num: 5, denom: 3 }]
};

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
function showAdaptiveMode() {
    mappingPanel.style.display = 'none';
    const chordModePanel = document.getElementById('chord-mode-panel');
    if (chordModePanel) chordModePanel.style.display = 'none';
    const adaptiveModePanel = document.getElementById('adaptive-mode-panel');
    if (adaptiveModePanel) adaptiveModePanel.style.display = 'block';
    gamePanel.style.display = 'none';
    updateAdaptiveStats();
}

function showMappingConfig() {
    mappingPanel.style.display = 'block';
    const chordModePanel = document.getElementById('chord-mode-panel');
    if (chordModePanel) chordModePanel.style.display = 'none';
    const adaptiveModePanel = document.getElementById('adaptive-mode-panel');
    if (adaptiveModePanel) adaptiveModePanel.style.display = 'none';
    gamePanel.style.display = 'none';
    renderMappingConfig();
}

function showChordMode() {
    mappingPanel.style.display = 'none';
    const chordModePanel = document.getElementById('chord-mode-panel');
    if (chordModePanel) chordModePanel.style.display = 'block';
    const adaptiveModePanel = document.getElementById('adaptive-mode-panel');
    if (adaptiveModePanel) adaptiveModePanel.style.display = 'none';
    gamePanel.style.display = 'none';
}

function showGame() {
    mappingPanel.style.display = 'none';
    const chordModePanel = document.getElementById('chord-mode-panel');
    if (chordModePanel) chordModePanel.style.display = 'none';
    const adaptiveModePanel = document.getElementById('adaptive-mode-panel');
    if (adaptiveModePanel) adaptiveModePanel.style.display = 'none';
    gamePanel.style.display = 'block';
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

// Chord mode button
const chordModeBtn = document.getElementById('chord-mode-btn');
if (chordModeBtn) {
    chordModeBtn.addEventListener('click', showChordMode);
}

// Back from chord mode
const backToAdaptiveFromChordBtn = document.getElementById('back-to-adaptive-from-chord-btn');
if (backToAdaptiveFromChordBtn) {
    backToAdaptiveFromChordBtn.addEventListener('click', showAdaptiveMode);
}

// Chord level cards
document.querySelectorAll('.chord-level-card').forEach(card => {
    card.addEventListener('click', () => {
        const chordLevel = parseInt(card.dataset.chordLevel);
        initAudio();
        startChordGame(chordLevel);
    });
});


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

            return true;
        } catch (e) {
            console.error('Failed to load settings:', e);
            return false;
        }
    }
    return false;
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
        'ear-training-checkbox'
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
});


// GCD function
function gcd(a, b) {
    while (b !== 0) {
        let temp = b;
        b = a % b;
        a = temp;
    }
    return a;
}

// Reduce fraction to lowest terms
function reduceFraction(num, denom) {
    const g = gcd(num, denom);
    return { num: num / g, denom: denom / g };
}

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

// Get chord level configuration
function getChordLevelConfig(level) {
    const configs = {
        1: { // Major & Minor
            chords: ['Major', 'Minor'],
            repeats: [10, 10],
            weights: [1, 1]
        },
        2: { // Diminished & Augmented
            chords: ['Diminished', 'Augmented'],
            repeats: [10, 10],
            weights: [1, 1]
        },
        3: { // All Basic Triads
            chords: ['Major', 'Minor', 'Diminished', 'Augmented'],
            repeats: [10, 10, 10, 10],
            weights: [1, 1, 1, 1]
        },
        4: { // Sus4 & Sus2
            chords: ['Sus4', 'Sus2'],
            repeats: [10, 10],
            weights: [1, 1]
        },
        5: { // All Triads (with sus emphasized)
            chords: ['Major', 'Minor', 'Diminished', 'Augmented', 'Sus4', 'Sus2'],
            repeats: [10, 10, 10, 10, 10, 10],
            weights: [1, 1, 1, 1, 2, 2] // Sus chords have higher weight
        },
        6: { // Dominant, Major & Minor 7th
            chords: ['Dominant 7th', 'Major 7th', 'Minor 7th'],
            repeats: [10, 10, 10],
            weights: [1, 1, 1]
        },
        7: { // Harmonic & Subminor 7th
            chords: ['Harmonic 7th', 'Subminor 7th'],
            repeats: [10, 10],
            weights: [1, 1]
        },
        8: { // All 7th Chords
            chords: ['Dominant 7th', 'Major 7th', 'Minor 7th', 'Harmonic 7th', 'Subminor 7th'],
            repeats: [10, 10, 10, 10, 10],
            weights: [1, 1, 1, 1, 1]
        },
        9: { // Major & Minor 6th
            chords: ['Major 6th', 'Minor 6th'],
            repeats: [10, 10],
            weights: [1, 1]
        },
        10: { // All Chords
            chords: ['Major', 'Minor', 'Diminished', 'Augmented', 'Sus4', 'Sus2', 'Dominant 7th', 'Major 7th', 'Minor 7th'],
            repeats: [10, 10, 10, 10, 10, 10, 10, 10, 10],
            weights: [1, 1, 1, 1, 1, 1, 1, 1, 1]
        }
    };
    return configs[level] || configs[1];
}

// Start chord game
function startChordGame(chordLevel) {
    // Read display mode setting
    const displayModeSelect = document.getElementById('display-mode-select');
    if (displayModeSelect) {
        displayMode = displayModeSelect.value;
        currentRotationIndex = 0; // Reset rotation when starting new game
    }

    // Read repeat slow settings
    const repeatSlowCheckbox = document.getElementById('repeat-slow-checkbox');
    const repeatSlowInput = document.getElementById('repeat-slow-input');
    const repeatSlow = repeatSlowCheckbox && repeatSlowCheckbox.checked;
    if (repeatSlow && repeatSlowInput) {
        repeatSlowThreshold = parseFloat(repeatSlowInput.value) || 5;
    }

    // Save settings
    saveSettings();

    // Get chord configuration for this level
    const config = getChordLevelConfig(chordLevel);

    // Build weighted chord pool
    chordPool = [];
    for (let i = 0; i < config.chords.length; i++) {
        const chordType = config.chords[i];
        const repeats = config.repeats[i];
        for (let j = 0; j < repeats; j++) {
            chordPool.push(chordType);
        }
    }

    // Shuffle the pool
    shuffleArray(chordPool);
    remainingChords = [...chordPool];

    // Reset game state
    gameActive = true;
    gameMode = 'chord';
    questionCount = 0;
    totalTime = 0;
    chordProgress = [];

    // Hide adaptive level indicator
    const levelIndicator = document.getElementById('adaptive-level-indicator');
    if (levelIndicator) {
        levelIndicator.style.display = 'none';
    }

    // Start timer
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 100);

    // Render keyboard legend
    renderKeyboardLegend();

    // Show game panel
    showGame();

    // Start first question
    nextChordQuestion();
}

// Render keyboard legend
function renderKeyboardLegend() {
    keyboardLegendGrid.innerHTML = '';

    // Define the order of keys for proper layout
    const primeKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
    const reciprocalKeys = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'];

    // Add primes first row (1-0)
    for (const key of primeKeys) {
        if (primeMappings[key]) {
            const ratio = primeMappings[key];
            const div = document.createElement('div');
            div.className = 'legend-item';
            div.innerHTML = `<span class="legend-key">${key}</span><span class="legend-ratio">${ratio.num}/${ratio.denom}</span>`;
            keyboardLegendGrid.appendChild(div);
        }
    }

    // Add reciprocals second row (q-p)
    for (const key of reciprocalKeys) {
        if (reciprocalMappings[key]) {
            const ratio = reciprocalMappings[key];
            const div = document.createElement('div');
            div.className = 'legend-item';
            div.innerHTML = `<span class="legend-key">${key.toUpperCase()}</span><span class="legend-ratio">${ratio.num}/${ratio.denom}</span>`;
            keyboardLegendGrid.appendChild(div);
        }
    }
}

// Update timer
function updateTimer() {
    if (!gameActive) return;
    const elapsed = Date.now() - startTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const milliseconds = Math.floor((elapsed % 1000) / 10);
    timerEl.textContent = `${minutes}:${String(remainingSeconds).padStart(2, '0')}.${String(milliseconds).padStart(2, '0')}`;
}

// Next question
function nextQuestion() {
    if (remainingIntervals.length === 0) {
        endGame();
        return;
    }

    // Get random interval, ensuring it's different from the last one
    let randomIndex;
    let attempts = 0;
    const maxAttempts = 50;

    do {
        randomIndex = Math.floor(Math.random() * remainingIntervals.length);
        currentInterval = remainingIntervals[randomIndex];
        attempts++;

        // If we have more than one interval available and this matches the last one, try again
        if (remainingIntervals.length > 1 && lastInterval &&
            currentInterval.num === lastInterval.num &&
            currentInterval.denom === lastInterval.denom) {
            continue;
        }
        break;
    } while (attempts < maxAttempts);

    // Remove from pool
    remainingIntervals.splice(randomIndex, 1);

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

    // Start question timer
    questionStartTime = Date.now();

    // Play interval audio
    playIntervalAudio(currentInterval.num, currentInterval.denom);
}

// Update composition display
function updateCompositionDisplay() {
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
    if (gameMode === 'chord') {
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

    // Check if key is mapped
    if (allMappings[key]) {
        e.preventDefault();

        // Add to composition
        currentComposition.push(allMappings[key]);
        updateCompositionDisplay();

        // Check if correct
        if (checkAnswer()) {
            handleCorrectAnswer();
        }
    }
});

// Handle chord mode keypress
function handleChordKeypress(e, key) {
    // Backspace - clear current interval
    if (key === 'backspace') {
        e.preventDefault();
        currentComposition = [];
        updateCompositionDisplay();
        return;
    }

    // Enter - submit current interval
    if (key === 'enter') {
        e.preventDefault();
        if (currentComposition.length === 0) return;

        const product = multiplyFractions(currentComposition);
        const expectedIntervals = CHORD_TYPES[currentChord];
        const expectedInterval = expectedIntervals[chordProgress.length];

        if (product.num === expectedInterval.num && product.denom === expectedInterval.denom) {
            // Correct interval
            chordProgress.push(expectedInterval);
            currentComposition = [];

            // Check if chord is complete
            if (chordProgress.length === expectedIntervals.length) {
                handleCorrectAnswer();
            } else {
                // Show progress
                feedbackEl.textContent = `Correct! ${chordProgress.length}/${expectedIntervals.length} intervals entered.`;
                feedbackEl.className = 'feedback correct';
                updateCompositionDisplay();
            }
        } else {
            // Wrong interval
            feedbackEl.textContent = `Wrong! Expected ${expectedInterval.num}/${expectedInterval.denom}, got ${product.num}/${product.denom}`;
            feedbackEl.className = 'feedback incorrect';
            feedbackEl.style.background = '#f8d7da';
            feedbackEl.style.color = '#721c24';
        }
        return;
    }

    // Add to current interval composition
    if (allMappings[key]) {
        e.preventDefault();
        currentComposition.push(allMappings[key]);
        updateCompositionDisplay();
    }
}

// Next chord question
function nextChordQuestion() {
    if (remainingChords.length === 0) {
        endGame();
        return;
    }

    // Get chord type
    const randomIndex = Math.floor(Math.random() * remainingChords.length);
    currentChord = remainingChords.splice(randomIndex, 1)[0];

    const expectedIntervals = CHORD_TYPES[currentChord];

    // Display target chord
    targetIntervalEl.innerHTML = `<h2>${currentChord}</h2><div class="chord-intervals">${expectedIntervals.map(int => `${int.num}/${int.denom}`).join(', ')}</div>`;

    // Reset
    currentComposition = [];
    chordProgress = [];
    updateCompositionDisplay();
    feedbackEl.textContent = '';
    feedbackEl.className = 'feedback';

    // Start question timer
    questionStartTime = Date.now();
}

// Handle correct answer
function handleCorrectAnswer() {
    const timeTaken = (Date.now() - questionStartTime) / 1000;
    questionCount++;
    totalTime += timeTaken;

    // Track stats for adaptive mode
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

    // Check if should repeat due to slow time
    const repeatSlowCheckbox = document.getElementById('repeat-slow-checkbox');
    if (repeatSlowCheckbox && repeatSlowCheckbox.checked && timeTaken > repeatSlowThreshold) {
        if (gameMode === 'interval') {
            remainingIntervals.push(currentInterval);
            shuffleArray(remainingIntervals);
        } else if (gameMode === 'adaptive') {
            remainingIntervals.push(currentInterval);
            shuffleArray(remainingIntervals);
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

    // Wait a bit then move to next question
    setTimeout(() => {
        if (gameMode === 'interval') {
            nextQuestion();
        } else if (gameMode === 'chord') {
            nextChordQuestion();
        } else if (gameMode === 'adaptive') {
            nextAdaptiveQuestion();
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
        nextQuestion();
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
    remainingIntervals = []; // Not used in weighted random selection, but keep for compatibility
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
    endBtn.textContent = 'Return to Menu';
    endBtn.onclick = () => {
        endBtn.textContent = 'End Game';
        endBtn.onclick = endGame;
        if (gameMode === 'chord') {
            showChordMode();
        } else {
            showAdaptiveMode();
        }
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

// Play sound
function playSound(type) {
    if (!audioContext) return;

    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const now = audioContext.currentTime;

    if (type === 'excellent') {
        // Major chord arpeggio
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
