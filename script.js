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

// Adaptive mode state (for intervals)
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

// Sound settings
let synthType = 'sawtooth'; // 'sawtooth', 'sine', 'square', 'triangle'
let releaseTime = 2; // seconds
let varyPitch = true; // vary starting pitch
let enableSound = true; // enable/disable sound
let earTrainingMode = false; // hide target interval for ear training

// Submit key
let submitKey = '`'; // default submit key

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

// Base chord definitions (harmonic notation with 1:1 root)
const BASE_CHORD_TYPES = {
    '4:5:6': [{ num: 1, denom: 1 }, { num: 5, denom: 4 }, { num: 3, denom: 2 }],            // Major
    '10:12:15': [{ num: 1, denom: 1 }, { num: 6, denom: 5 }, { num: 3, denom: 2 }],         // Minor
    '5:6:7': [{ num: 1, denom: 1 }, { num: 6, denom: 5 }, { num: 7, denom: 5 }],            // Diminished
    '16:20:25': [{ num: 1, denom: 1 }, { num: 5, denom: 4 }, { num: 25, denom: 16 }],       // Augmented
    '6:8:9': [{ num: 1, denom: 1 }, { num: 4, denom: 3 }, { num: 3, denom: 2 }],            // Sus4
    '8:9:12': [{ num: 1, denom: 1 }, { num: 9, denom: 8 }, { num: 3, denom: 2 }],           // Sus2
    '20:25:30:36': [{ num: 1, denom: 1 }, { num: 5, denom: 4 }, { num: 3, denom: 2 }, { num: 9, denom: 5 }],    // Dominant 7th
    '8:10:12:15': [{ num: 1, denom: 1 }, { num: 5, denom: 4 }, { num: 3, denom: 2 }, { num: 15, denom: 8 }],    // Major 7th
    '10:12:15:18': [{ num: 1, denom: 1 }, { num: 6, denom: 5 }, { num: 3, denom: 2 }, { num: 9, denom: 5 }],    // Minor 7th
    '4:5:6:7': [{ num: 1, denom: 1 }, { num: 5, denom: 4 }, { num: 3, denom: 2 }, { num: 7, denom: 4 }],        // Harmonic 7th
    '20:24:30:35': [{ num: 1, denom: 1 }, { num: 6, denom: 5 }, { num: 3, denom: 2 }, { num: 7, denom: 4 }],    // Subminor 7th
    '12:15:18:20': [{ num: 1, denom: 1 }, { num: 5, denom: 4 }, { num: 3, denom: 2 }, { num: 5, denom: 3 }],    // Major 6th
    '30:36:45:50': [{ num: 1, denom: 1 }, { num: 6, denom: 5 }, { num: 3, denom: 2 }, { num: 5, denom: 3 }]     // Minor 6th
};

// Traditional chord names mapping
const CHORD_NAMES = {
    // Major chord variations
    '4:5:6': 'Major',
    '5:6:4': 'Major (from 3rd)',
    '6:4:5': 'Major (from 5th)',
    '5:6:8': 'Major 1st inv',
    '6:8:10': 'Major 2nd inv',

    // Minor chord variations
    '10:12:15': 'Minor',
    '12:15:10': 'Minor (from 3rd)',
    '15:10:12': 'Minor (from 5th)',
    '12:15:20': 'Minor 1st inv',
    '15:20:24': 'Minor 2nd inv',

    // Other triads
    '5:6:7': 'Diminished',
    '16:20:25': 'Augmented',
    '6:8:9': 'Sus4',
    '8:9:12': 'Sus2',

    // 7th chords
    '20:25:30:36': 'Dominant 7th',
    '8:10:12:15': 'Major 7th',
    '10:12:15:18': 'Minor 7th',
    '4:5:6:7': 'Harmonic 7th',
    '20:24:30:35': 'Subminor 7th',

    // 6th chords
    '12:15:18:20': 'Major 6th',
    '30:36:45:50': 'Minor 6th'
};

// Generate chord inversions by using different notes as the root
function generateInversion(baseChord, inversionIndex) {
    // Get the original intervals
    const intervals = BASE_CHORD_TYPES[baseChord];
    if (!intervals || inversionIndex >= intervals.length || inversionIndex === 0) {
        return null; // No inversion or invalid
    }

    // The new root is the interval at inversionIndex
    const newRoot = intervals[inversionIndex];

    // Build new intervals relative to the new root
    const invertedIntervals = intervals.map(interval => {
        // Divide each interval by the new root
        const newNum = interval.num * newRoot.denom;
        const newDenom = interval.denom * newRoot.num;
        return reduceFraction(newNum, newDenom);
    });

    // Sort by value to get proper ascending order
    invertedIntervals.sort((a, b) => (a.num / a.denom) - (b.num / b.denom));

    return invertedIntervals;
}

// Generate inversion name
function getInversionName(baseChord, inversionIndex) {
    if (inversionIndex === 0) return baseChord; // Root position

    // Parse base chord notation
    const parts = baseChord.split(':').map(Number);
    const intervals = BASE_CHORD_TYPES[baseChord];

    if (!intervals || inversionIndex >= intervals.length) return baseChord;

    // Rotate the harmonic series numbers
    const rotated = [...parts.slice(inversionIndex), ...parts.slice(0, inversionIndex)];

    // Generate new notation
    return rotated.join(':');
}

// Full CHORD_TYPES including inversions
let CHORD_TYPES = { ...BASE_CHORD_TYPES };

// Add inversions for all chords
for (const [baseName, intervals] of Object.entries(BASE_CHORD_TYPES)) {
    for (let inv = 1; inv < intervals.length; inv++) {
        const invertedIntervals = generateInversion(baseName, inv);
        const inversionName = getInversionName(baseName, inv);
        if (invertedIntervals && inversionName !== baseName) {
            CHORD_TYPES[inversionName] = invertedIntervals;
        }
    }
}

// Add custom voicings (different root notes in harmonic series)
// Major chord (4:5:6) variations
// Root on 3rd (harmonic 5): intervals are 4/5, 1/1, 6/5
CHORD_TYPES['5:6:4'] = [
    { num: 4, denom: 5 },  // 4/5 below root
    { num: 1, denom: 1 },  // root (was 3rd)
    { num: 6, denom: 5 }   // 6/5 above root
];

// Root on 5th (harmonic 6): intervals are 2/3, 5/6, 1/1
CHORD_TYPES['6:4:5'] = [
    { num: 2, denom: 3 },  // 2/3 below root
    { num: 5, denom: 6 },  // 5/6 below root
    { num: 1, denom: 1 }   // root (was 5th)
];

// Minor chord (10:12:15) variations
// Root on 3rd (harmonic 12): intervals are 5/6, 1/1, 5/4
CHORD_TYPES['12:15:10'] = [
    { num: 5, denom: 6 },  // 5/6 below root
    { num: 1, denom: 1 },  // root (was 3rd)
    { num: 5, denom: 4 }   // 5/4 above root
];

// Root on 5th (harmonic 15): intervals are 2/3, 4/5, 1/1
CHORD_TYPES['15:10:12'] = [
    { num: 2, denom: 3 },  // 2/3 below root
    { num: 4, denom: 5 },  // 4/5 below root
    { num: 1, denom: 1 }   // root (was 5th)
];

// Calculate chord complexity (similar to interval complexity)
function getChordComplexity(chordKey) {
    const intervals = CHORD_TYPES[chordKey];
    if (!intervals) return 0;

    // Complexity = sum of (numerator × denominator) for all intervals in chord
    let complexity = 0;
    for (const interval of intervals) {
        complexity += interval.num * interval.denom;
    }

    // Add bonus complexity for number of notes (larger chords are harder)
    complexity += intervals.length * 10;

    return complexity;
}

// Initialize all chords in custom pedagogical order
function initializeChordsSorted() {
    // Custom order: Major variations first, then Minor variations, then others
    const customOrder = [
        // Major chord variations (root position, then different starting notes, then inversions)
        '4:5:6',      // Major root position (1/1, 5/4, 3/2)
        '5:6:4',      // Major starting on 3rd (different root note in harmonic series)
        '6:4:5',      // Major starting on 5th (different root note in harmonic series)
        '5:6:8',      // Major 1st inversion (bass on 3rd of chord)
        // Note: need to add 2 more variations with different roots for completeness
        '6:8:10',     // Major 2nd inversion (bass on 5th of chord)

        // Minor chord variations (same pattern as major)
        '10:12:15',   // Minor root position (1/1, 6/5, 3/2)
        '12:15:10',   // Minor starting on 3rd
        '15:10:12',   // Minor starting on 5th
        '12:15:20',   // Minor 1st inversion
        '15:20:24',   // Minor 2nd inversion

        // Other triads
        '5:6:7',      // Diminished
        '16:20:25',   // Augmented
        '6:8:9',      // Sus4
        '8:9:12',     // Sus2

        // 7th chords
        '20:25:30:36',  // Dominant 7th
        '8:10:12:15',   // Major 7th
        '10:12:15:18',  // Minor 7th
        '4:5:6:7',      // Harmonic 7th
        '20:24:30:35',  // Subminor 7th

        // 6th chords
        '12:15:18:20',  // Major 6th
        '30:36:45:50'   // Minor 6th
    ];

    // Build allChordsSorted array, including only chords that exist in CHORD_TYPES
    allChordsSorted = [];
    const addedKeys = new Set();

    // First, add chords in the custom order
    for (const key of customOrder) {
        if (CHORD_TYPES[key]) {
            allChordsSorted.push({
                key: key,
                intervals: CHORD_TYPES[key],
                complexity: getChordComplexity(key),
                name: CHORD_NAMES[key] || key
            });
            addedKeys.add(key);
        }
    }

    // Then add any remaining chords not in the custom order
    for (const key of Object.keys(CHORD_TYPES)) {
        if (!addedKeys.has(key)) {
            allChordsSorted.push({
                key: key,
                intervals: CHORD_TYPES[key],
                complexity: getChordComplexity(key),
                name: CHORD_NAMES[key] || key
            });
        }
    }

    return allChordsSorted;
}

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
function showMainMenu() {
    const mainMenuPanel = document.getElementById('main-menu-panel');
    if (mainMenuPanel) mainMenuPanel.style.display = 'block';
    const adaptiveModePanel = document.getElementById('adaptive-mode-panel');
    if (adaptiveModePanel) adaptiveModePanel.style.display = 'none';
    const adaptiveChordModePanel = document.getElementById('adaptive-chord-mode-panel');
    if (adaptiveChordModePanel) adaptiveChordModePanel.style.display = 'none';
    const gridModePanel = document.getElementById('grid-mode-panel');
    if (gridModePanel) gridModePanel.style.display = 'none';
    mappingPanel.style.display = 'none';
    gamePanel.style.display = 'none';
}

function showAdaptiveMode() {
    const mainMenuPanel = document.getElementById('main-menu-panel');
    if (mainMenuPanel) mainMenuPanel.style.display = 'none';
    mappingPanel.style.display = 'none';
    const adaptiveChordModePanel = document.getElementById('adaptive-chord-mode-panel');
    if (adaptiveChordModePanel) adaptiveChordModePanel.style.display = 'none';
    const adaptiveModePanel = document.getElementById('adaptive-mode-panel');
    if (adaptiveModePanel) adaptiveModePanel.style.display = 'block';
    gamePanel.style.display = 'none';
    updateAdaptiveStats();
}

function showAdaptiveChordMode() {
    const mainMenuPanel = document.getElementById('main-menu-panel');
    if (mainMenuPanel) mainMenuPanel.style.display = 'none';
    mappingPanel.style.display = 'none';
    const adaptiveModePanel = document.getElementById('adaptive-mode-panel');
    if (adaptiveModePanel) adaptiveModePanel.style.display = 'none';
    const adaptiveChordModePanel = document.getElementById('adaptive-chord-mode-panel');
    if (adaptiveChordModePanel) adaptiveChordModePanel.style.display = 'block';
    gamePanel.style.display = 'none';
    updateAdaptiveChordStats();
}

function showMappingConfig() {
    mappingPanel.style.display = 'block';
    const adaptiveModePanel = document.getElementById('adaptive-mode-panel');
    if (adaptiveModePanel) adaptiveModePanel.style.display = 'none';
    const adaptiveChordModePanel = document.getElementById('adaptive-chord-mode-panel');
    if (adaptiveChordModePanel) adaptiveChordModePanel.style.display = 'none';
    gamePanel.style.display = 'none';
    renderMappingConfig();
}

function showGridMode() {
    const mainMenuPanel = document.getElementById('main-menu-panel');
    if (mainMenuPanel) mainMenuPanel.style.display = 'none';
    mappingPanel.style.display = 'none';
    const adaptiveModePanel = document.getElementById('adaptive-mode-panel');
    if (adaptiveModePanel) adaptiveModePanel.style.display = 'none';
    const adaptiveChordModePanel = document.getElementById('adaptive-chord-mode-panel');
    if (adaptiveChordModePanel) adaptiveChordModePanel.style.display = 'none';
    const gridModePanel = document.getElementById('grid-mode-panel');
    if (gridModePanel) gridModePanel.style.display = 'block';
    gamePanel.style.display = 'none';
}

function showGame() {
    mappingPanel.style.display = 'none';
    const adaptiveModePanel = document.getElementById('adaptive-mode-panel');
    if (adaptiveModePanel) adaptiveModePanel.style.display = 'none';
    const adaptiveChordModePanel = document.getElementById('adaptive-chord-mode-panel');
    if (adaptiveChordModePanel) adaptiveChordModePanel.style.display = 'none';
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

            // Restore chord-specific UI elements (copy same values)
            const chordMasteryInput = document.getElementById('chord-mastery-threshold-input');
            const chordMinAttemptsInput = document.getElementById('chord-min-attempts-input');
            const chordRollingWindowInput = document.getElementById('chord-rolling-average-window-input');
            const chordNonMasteredRateInput = document.getElementById('chord-non-mastered-rate-input');
            const chordSynthTypeSelect = document.getElementById('chord-synth-type-select');
            const chordReleaseTimeInput = document.getElementById('chord-release-time-input');
            const chordVaryPitchCheckbox = document.getElementById('chord-vary-pitch-checkbox');
            const chordEnableSoundCheckbox = document.getElementById('chord-enable-sound-checkbox');

            if (chordMasteryInput) chordMasteryInput.value = settings.masteryThreshold ?? 3;
            if (chordMinAttemptsInput) chordMinAttemptsInput.value = settings.minAttemptsForMastery ?? 5;
            if (chordRollingWindowInput) chordRollingWindowInput.value = settings.rollingAverageWindow ?? 10;
            if (chordNonMasteredRateInput) chordNonMasteredRateInput.value = settings.nonMasteredRate ?? 60;
            if (chordSynthTypeSelect) chordSynthTypeSelect.value = settings.synthType ?? 'sawtooth';
            if (chordReleaseTimeInput) chordReleaseTimeInput.value = settings.releaseTime ?? 2;
            if (chordVaryPitchCheckbox) chordVaryPitchCheckbox.checked = settings.varyPitch ?? true;
            if (chordEnableSoundCheckbox) chordEnableSoundCheckbox.checked = settings.enableSound ?? true;

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
        'ear-training-checkbox',
        'submit-key-input',
        // Chord-specific settings
        'chord-mastery-threshold-input',
        'chord-min-attempts-input',
        'chord-rolling-average-window-input',
        'chord-non-mastered-rate-input',
        'chord-synth-type-select',
        'chord-release-time-input',
        'chord-vary-pitch-checkbox',
        'chord-enable-sound-checkbox'
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
            chords: ['4:5:6', '10:12:15'],
            repeats: [10, 10],
            weights: [1, 1]
        },
        2: { // Diminished & Augmented
            chords: ['5:6:7', '16:20:25'],
            repeats: [10, 10],
            weights: [1, 1]
        },
        3: { // All Basic Triads
            chords: ['4:5:6', '10:12:15', '5:6:7', '16:20:25'],
            repeats: [10, 10, 10, 10],
            weights: [1, 1, 1, 1]
        },
        4: { // Sus4 & Sus2
            chords: ['6:8:9', '8:9:12'],
            repeats: [10, 10],
            weights: [1, 1]
        },
        5: { // All Triads (with sus emphasized)
            chords: ['4:5:6', '10:12:15', '5:6:7', '16:20:25', '6:8:9', '8:9:12'],
            repeats: [10, 10, 10, 10, 10, 10],
            weights: [1, 1, 1, 1, 2, 2] // Sus chords have higher weight
        },
        6: { // Dominant, Major & Minor 7th
            chords: ['20:25:30:36', '8:10:12:15', '10:12:15:18'],
            repeats: [10, 10, 10],
            weights: [1, 1, 1]
        },
        7: { // Harmonic & Subminor 7th
            chords: ['4:5:6:7', '20:24:30:35'],
            repeats: [10, 10],
            weights: [1, 1]
        },
        8: { // All 7th Chords
            chords: ['20:25:30:36', '8:10:12:15', '10:12:15:18', '4:5:6:7', '20:24:30:35'],
            repeats: [10, 10, 10, 10, 10],
            weights: [1, 1, 1, 1, 1]
        },
        9: { // Major & Minor 6th
            chords: ['12:15:18:20', '30:36:45:50'],
            repeats: [10, 10],
            weights: [1, 1]
        },
        10: { // All Chords
            chords: ['4:5:6', '10:12:15', '5:6:7', '16:20:25', '6:8:9', '8:9:12', '20:25:30:36', '8:10:12:15', '10:12:15:18'],
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
    // In chord mode (both regular and adaptive), ONLY show current interval being built
    if (gameMode === 'chord' || gameMode === 'adaptive-chord') {
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

    // Handle chord mode separately (both regular and adaptive)
    if (gameMode === 'chord' || gameMode === 'adaptive-chord') {
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
    const expectedIntervals = CHORD_TYPES[currentChord];

    // Backspace - RESET ENTIRE CHORD
    if (key === 'backspace') {
        e.preventDefault();
        currentComposition = [{ num: 1, denom: 1 }];
        chordProgress = [];
        updateCompositionDisplay(); // This now updates piano roll automatically
        resetChordIntervalHighlights();
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
                        if (chordStats[currentChord].recentTimes.length > rollingAverageWindow) {
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
                                setTimeout(() => {
                                    feedbackEl.innerHTML = `<strong>✓ Drill complete!</strong><br>${chordToAdd.name} has been added to the mix!`;
                                    feedbackEl.className = 'feedback';
                                    feedbackEl.style.background = '#d4edda';
                                    feedbackEl.style.color = '#155724';
                                }, 1400);
                            }

                            // Reset drill tracking
                            currentNewChord = null;
                            newChordDrillCount = 0;
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
                    if (gameMode === 'adaptive-chord') {
                        nextAdaptiveChordQuestion();
                    } else {
                        nextChordQuestion();
                    }
                }, 1300); // 300ms (last note) + 600ms (wiggle) + 400ms (chord sound)
            }
        } else {
            // WRONG interval - play the wrong note, then reset entire chord
            playSingleTone(product.num, product.denom);

            currentComposition = [{ num: 1, denom: 1 }];
            chordProgress = [];
            updateCompositionDisplay(); // This now updates piano roll automatically
            resetChordIntervalHighlights();

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

    const intervals = CHORD_TYPES[chordKey];
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
    if (gameMode !== 'chord' && gameMode !== 'adaptive-chord') return;
    const currentValue = multiplyFractions(currentComposition);
    renderChordPianoRoll(currentChord, chordProgress, currentValue);
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

    // Get traditional name (or use harmonic notation if no traditional name exists)
    const traditionalName = CHORD_NAMES[currentChord] || currentChord;

    // Display target chord using traditional name with harmonic notation below
    const intervalsHTML = expectedIntervals.map((int, idx) =>
        `<span class="chord-interval" data-interval="${int.num}/${int.denom}">${int.num}/${int.denom}</span>`
    ).join(', ');

    targetIntervalEl.innerHTML = `
        <h2>${traditionalName}</h2>
        <div class="chord-harmonic-notation">${currentChord}</div>
        <div class="chord-intervals">${intervalsHTML}</div>
    `;

    // Reset - start with 1/1 in composition
    currentComposition = [{ num: 1, denom: 1 }];
    chordProgress = [];
    updateCompositionDisplay();

    // Render piano roll visualization (arrow starts at 1/1)
    renderChordPianoRoll(currentChord, [], { num: 1, denom: 1 });

    // Clear feedback
    feedbackEl.textContent = '';
    feedbackEl.className = 'feedback';
    feedbackEl.style.background = '';
    feedbackEl.style.color = '';

    // Start question timer
    questionStartTime = Date.now();
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

    // Track stats for adaptive chord mode
    if (gameMode === 'adaptive-chord' && currentChord) {
        if (chordStats[currentChord]) {
            chordStats[currentChord].attempts++;
            chordStats[currentChord].totalTime += timeTaken;
            chordStats[currentChord].recentTimes.push(timeTaken);
            // Keep only the configured number of recent attempts
            if (chordStats[currentChord].recentTimes.length > rollingAverageWindow) {
                chordStats[currentChord].recentTimes.shift();
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
        if (gameMode === 'interval') {
            nextQuestion();
        } else if (gameMode === 'chord') {
            nextChordQuestion();
        } else if (gameMode === 'adaptive') {
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

    // Build stats HTML
    let html = '';

    for (const chord of activeChords) {
        const stats = chordStats[chord.key];

        if (!stats) continue;

        const avgRecent = stats.recentTimes.length > 0
            ? (stats.recentTimes.reduce((a, b) => a + b, 0) / stats.recentTimes.length).toFixed(2)
            : 'N/A';

        const isMastered = stats.attempts >= minAttemptsForMastery && avgRecent !== 'N/A' && parseFloat(avgRecent) < masteryThreshold;

        const classes = ['game-stat-item'];
        if (isMastered) classes.push('mastered');

        html += `
            <div class="${classes.join(' ')}">
                <div class="game-stat-interval">${chord.name}</div>
                <div class="game-stat-details">
                    <span class="game-stat-cents">${chord.key}</span>
                </div>
                <div class="game-stat-info">
                    <span>Attempts: ${stats.attempts}</span>
                    <span>Avg: ${avgRecent}s</span>
                    ${isMastered ? '<span class="game-stat-badge mastered">✓ Mastered</span>' : '<span class="game-stat-badge learning">Learning</span>'}
                </div>
            </div>
        `;
    }

    // Show drill progress if drilling
    if (currentNewChord) {
        const newChord = allChordsSorted.find(c => c.key === currentNewChord);
        if (newChord) {
            html += `
                <div class="game-stat-item drilling">
                    <div class="game-stat-interval">${newChord.name}</div>
                    <div class="game-stat-details">
                        <span class="game-stat-cents">${newChord.key}</span>
                    </div>
                    <div class="game-stat-info">
                        <span class="game-stat-badge drilling">Drilling: ${newChordDrillCount}/${newChordDrillTarget}</span>
                    </div>
                </div>
            `;
        }
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

// ===== ADAPTIVE CHORD MODE FUNCTIONS =====

// Initialize adaptive chord mode
function initializeAdaptiveChordMode() {
    // Initialize sorted chords if not already done
    if (allChordsSorted.length === 0) {
        initializeChordsSorted();
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

    // Start with just major chord
    const startingChords = ['4:5:6'];
    activeChords = [];
    for (const key of startingChords) {
        const chord = allChordsSorted.find(c => c.key === key);
        if (chord) {
            activeChords.push(chord);
        }
    }

    // Reset drill tracking
    newChordDrillCount = 0;
    currentNewChord = null;

    // Set level to match number of active chords
    adaptiveChordLevel = activeChords.length;

    // Save to localStorage
    saveAdaptiveChordProgress();
}

// Load adaptive chord progress from localStorage
function loadAdaptiveChordProgress() {
    const saved = localStorage.getItem('ji_adaptive_chord_progress');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            chordStats = data.chordStats || {};
            activeChords = data.activeChords || [];
            adaptiveChordLevel = data.adaptiveChordLevel || 1;
            chordTutorialIndex = data.chordTutorialIndex !== undefined ? data.chordTutorialIndex : 0;
            chordTutorialActive = data.chordTutorialActive !== undefined ? data.chordTutorialActive : true;
            newChordDrillCount = data.newChordDrillCount || 0;
            currentNewChord = data.currentNewChord || null;

            // Initialize sorted chords if not already done
            if (allChordsSorted.length === 0) {
                initializeChordsSorted();
            }

            // Restore chord references in stats
            for (const key in chordStats) {
                const chord = allChordsSorted.find(c => c.key === key);
                if (chord) {
                    chordStats[key].chord = chord;
                }
            }

            // Restore activeChords with full chord objects
            activeChords = activeChords.map(savedChord => {
                const key = savedChord.key || savedChord;
                return allChordsSorted.find(c => c.key === key);
            }).filter(c => c);

            // Sync level with number of active chords
            adaptiveChordLevel = activeChords.length;

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
        currentNewChord: currentNewChord
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

// Start adaptive chord game
function startAdaptiveChordGame() {
    // Read chord-specific settings
    const masteryInput = document.getElementById('chord-mastery-threshold-input');
    const minAttemptsInput = document.getElementById('chord-min-attempts-input');
    const rollingWindowInput = document.getElementById('chord-rolling-average-window-input');
    const nonMasteredRateInput = document.getElementById('chord-non-mastered-rate-input');
    const synthTypeSelect = document.getElementById('chord-synth-type-select');
    const releaseTimeInput = document.getElementById('chord-release-time-input');
    const varyPitchCheckbox = document.getElementById('chord-vary-pitch-checkbox');
    const enableSoundCheckbox = document.getElementById('chord-enable-sound-checkbox');

    masteryThreshold = masteryInput ? parseFloat(masteryInput.value) : 3;
    minAttemptsForMastery = minAttemptsInput ? parseInt(minAttemptsInput.value) : 5;
    rollingAverageWindow = rollingWindowInput ? parseInt(rollingWindowInput.value) : 10;
    nonMasteredRate = nonMasteredRateInput ? parseInt(nonMasteredRateInput.value) : 60;

    // Read sound settings
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
    if (activeChords.length === 0) return null;

    const n = activeChords.length;
    const guaranteedWindow = 3 * n;

    // Check for chords that MUST appear
    const mustAppearChords = [];
    for (const chord of activeChords) {
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

    let masteredCount = 0;
    let nonMasteredCount = 0;

    for (const chord of activeChords) {
        const stats = chordStats[chord.key];
        if (stats && stats.mastered) {
            masteredCount++;
        } else {
            nonMasteredCount++;
        }
    }

    const masteredBaseWeight = nonMasteredCount > 0 ? (100 - nonMasteredRate) / masteredCount : 1;
    const nonMasteredBaseWeight = nonMasteredCount > 0 ? nonMasteredRate / nonMasteredCount : 1;

    for (const chord of activeChords) {
        const stats = chordStats[chord.key];
        let weight;

        if (stats && stats.mastered) {
            weight = masteredBaseWeight;
        } else if (stats && stats.recentTimes.length > 0) {
            const avgTime = stats.recentTimes.reduce((a, b) => a + b, 0) / stats.recentTimes.length;
            weight = nonMasteredBaseWeight * (1 + avgTime / masteryThreshold);
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

    // Display the chord
    const expectedIntervals = CHORD_TYPES[currentChord];
    const traditionalName = CHORD_NAMES[currentChord] || currentChord;

    const intervalsHTML = expectedIntervals.map((int, idx) =>
        `<span class="chord-interval" data-interval="${int.num}/${int.denom}">${int.num}/${int.denom}</span>`
    ).join(', ');

    targetIntervalEl.innerHTML = `
        <h2>${traditionalName}</h2>
        <div class="chord-harmonic-notation">${currentChord}</div>
        <div class="chord-intervals">${intervalsHTML}</div>
    `;

    // Reset composition
    currentComposition = [{ num: 1, denom: 1 }];
    chordProgress = [];
    updateCompositionDisplay();

    // Render piano roll visualization (arrow starts at 1/1)
    renderChordPianoRoll(currentChord, [], { num: 1, denom: 1 });

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
    // Check if all active chords are mastered
    let allMastered = true;
    for (const chord of activeChords) {
        const stats = chordStats[chord.key];
        if (!stats) continue;

        const avgRecent = stats.recentTimes.length > 0
            ? stats.recentTimes.reduce((a, b) => a + b, 0) / stats.recentTimes.length
            : 999;

        const isMastered = stats.attempts >= minAttemptsForMastery && avgRecent < masteryThreshold;
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

            // Update level
            adaptiveChordLevel = activeChords.length + 1;
            updateGameChordLevelDisplay();

            // Show notification
            feedbackEl.innerHTML = `<strong>🎉 Chord Level ${adaptiveChordLevel}! New chord unlocked!</strong><br>${nextChord.name} (${nextChord.key})<br><em>Practice this chord ${newChordDrillTarget} times before it's added to the mix</em>`;
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
}

// Update game chord level display in game panel
function updateGameChordLevelDisplay() {
    const gameLevelNumberEl = document.getElementById('game-level-number');
    if (gameLevelNumberEl) {
        gameLevelNumberEl.textContent = adaptiveChordLevel;
    }
}

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

    let html = `<div class="stats-grid">`;

    for (const chord of activeChords) {
        const stats = chordStats[chord.key];
        if (!stats) continue;

        const avgRecent = stats.recentTimes.length > 0
            ? (stats.recentTimes.reduce((a, b) => a + b, 0) / stats.recentTimes.length).toFixed(2)
            : 'N/A';

        const isMastered = stats.attempts >= minAttemptsForMastery && avgRecent !== 'N/A' && parseFloat(avgRecent) < masteryThreshold;

        html += `
            <div class="stat-item ${isMastered ? 'mastered' : ''}">
                <div class="stat-interval">${chord.name}</div>
                <div class="stat-info">
                    <span>Attempts: ${stats.attempts}</span>
                    <span>Avg: ${avgRecent}s</span>
                    ${isMastered ? '<span class="mastered-badge">✓ Mastered</span>' : ''}
                </div>
            </div>
        `;
    }

    html += '</div>';
    html += `<p class="progress-text">Active chords: ${activeChords.length} / ${allChordsSorted.length}</p>`;

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

    // Place target at random position (not on player)
    do {
        targetRow = Math.floor(Math.random() * gridSize);
        targetCol = Math.floor(Math.random() * gridSize);
    } while (targetRow === playerRow && targetCol === playerCol);
}

function movePlayer(dRow, dCol) {
    if (!gridGameActive) return;

    const newRow = playerRow + dRow;
    const newCol = playerCol + dCol;

    // Check bounds
    if (newRow >= 0 && newRow < gridSize && newCol >= 0 && newCol < gridSize) {
        playerRow = newRow;
        playerCol = newCol;

        // Check if reached target
        if (playerRow === targetRow && playerCol === targetCol) {
            const targetTime = (Date.now() - gridTargetStartTime) / 1000;
            gridTotalTime += targetTime;
            gridScore++;
            updateGridStats();
            placeNewTarget();
            playFeedbackSound('correct');
        }

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

    const elapsed = (Date.now() - gridStartTime) / 1000;
    const minutes = Math.floor(elapsed / 60);
    const seconds = Math.floor(elapsed % 60);
    const centiseconds = Math.floor((elapsed % 1) * 100);

    document.getElementById('grid-timer').textContent =
        `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
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

    // Vim-style movement: h (left), j (down), k (up), l (right)
    switch (key) {
        case 'h':
            event.preventDefault();
            movePlayer(0, -1);
            break;
        case 'j':
            event.preventDefault();
            movePlayer(1, 0);
            break;
        case 'k':
            event.preventDefault();
            movePlayer(-1, 0);
            break;
        case 'l':
            event.preventDefault();
            movePlayer(0, 1);
            break;
    }
}

// Add grid keydown listener to document
document.addEventListener('keydown', (event) => {
    if (gridGameActive) {
        handleGridKeyPress(event);
    }
});
