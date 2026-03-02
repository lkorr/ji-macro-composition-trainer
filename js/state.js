// ============================================================
// GLOBAL STATE
// ============================================================

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
let allChordsSorted = []; // All chords sorted by complexity (chord mode)
let cgAllChordsSorted = []; // All chords sorted by complexity (chord+grid mode)
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

// Current mappings (can be customized)
let primeMappings = { ...DEFAULT_PRIME_MAPPINGS };
let reciprocalMappings = { ...DEFAULT_RECIPROCAL_MAPPINGS };

// All mappings combined
let allMappings = {};

// Audio context
let audioContext = null;

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

// Chord-Grid hotkeys (configurable)
let cgMoveLeft = 'a';
let cgMoveUp = 's';
let cgMoveDown = 'd';
let cgMoveRight = 'f';
let cgCaptureKey = 'tab';
