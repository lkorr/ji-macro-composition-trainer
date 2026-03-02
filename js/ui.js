// ============================================================
// UI: DOM refs, navigation, settings, keyboard legend, display, chord UI
// ============================================================

// DOM elements
const gamePanel = document.getElementById('game-panel');
const mappingConfigBtn = document.getElementById('mapping-config-btn');
const targetIntervalEl = document.getElementById('target-interval');
const currentCompositionEl = document.getElementById('current-composition');
const feedbackEl = document.getElementById('feedback');
const questionCountEl = document.getElementById('question-count');
const avgTimeEl = document.getElementById('avg-time');
const timerEl = document.getElementById('timer');
const skipBtn = document.getElementById('skip-btn');
const endBtn = document.getElementById('end-btn');
const keyboardLegendGrid = document.getElementById('keyboard-legend-grid');

// Navigation functions
const ALL_PANEL_IDS = [
    'main-menu-panel', 'adaptive-mode-panel', 'adaptive-chord-mode-panel',
    'chord-grid-mode-panel', 'chord-grid-game-panel',
    'hotkeys-panel', 'game-panel'
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

// Track which panel to return to when closing the hotkeys panel
let hotkeysPanelOrigin = 'adaptive-mode-panel';

function showHotkeysPanel(origin) {
    hotkeysPanelOrigin = origin || 'adaptive-mode-panel';
    showPanel('hotkeys-panel');
    renderHotkeysPanel();
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

// Unified hotkeys panel render
function renderHotkeysPanel() {
    // Ratio inputs
    const primeRatios = [
        { num: 2, denom: 1 }, { num: 3, denom: 2 }, { num: 5, denom: 4 },
        { num: 7, denom: 4 }, { num: 11, denom: 8 }, { num: 13, denom: 8 },
        { num: 17, denom: 16 }, { num: 19, denom: 16 }, { num: 23, denom: 16 }, { num: 29, denom: 16 }
    ];
    const reciprocalRatios = [
        { num: 1, denom: 2 }, { num: 2, denom: 3 }, { num: 4, denom: 5 },
        { num: 4, denom: 7 }, { num: 8, denom: 11 }, { num: 8, denom: 13 },
        { num: 16, denom: 17 }, { num: 16, denom: 19 }, { num: 16, denom: 23 }, { num: 16, denom: 29 }
    ];

    function findKeyForRatio(ratio, mappings) {
        for (const [key, r] of Object.entries(mappings)) {
            if (r.num === ratio.num && r.denom === ratio.denom) return key;
        }
        return '';
    }

    const primeMappingsEl = document.getElementById('prime-mappings');
    const reciprocalMappingsEl = document.getElementById('reciprocal-mappings');
    primeMappingsEl.innerHTML = '';
    reciprocalMappingsEl.innerHTML = '';

    for (const ratio of primeRatios) {
        const currentKey = findKeyForRatio(ratio, primeMappings);
        const div = document.createElement('div');
        div.className = 'mapping-item';
        div.innerHTML = `<label><span class="key-display">${ratio.num}/${ratio.denom}</span> → <input type="text" class="ratio-input key-input" data-num="${ratio.num}" data-denom="${ratio.denom}" data-type="prime" value="${currentKey}" maxlength="1" placeholder="key"></label>`;
        primeMappingsEl.appendChild(div);
    }

    for (const ratio of reciprocalRatios) {
        const currentKey = findKeyForRatio(ratio, reciprocalMappings);
        const div = document.createElement('div');
        div.className = 'mapping-item';
        div.innerHTML = `<label><span class="key-display">${ratio.num}/${ratio.denom}</span> → <input type="text" class="ratio-input key-input" data-num="${ratio.num}" data-denom="${ratio.denom}" data-type="reciprocal" value="${currentKey}" maxlength="1" placeholder="key"></label>`;
        reciprocalMappingsEl.appendChild(div);
    }

    // Special keys
    const submitKeyBtn = document.getElementById('submit-key-btn');
    if (submitKeyBtn) submitKeyBtn.textContent = submitKey === ' ' ? 'Space' : submitKey;

    // Grid movement keys
    const leftInput = document.getElementById('cg-move-left-input');
    const upInput = document.getElementById('cg-move-up-input');
    const downInput = document.getElementById('cg-move-down-input');
    const rightInput = document.getElementById('cg-move-right-input');
    const captureBtn = document.getElementById('cg-capture-key-btn');
    if (leftInput) leftInput.value = cgMoveLeft;
    if (upInput) upInput.value = cgMoveUp;
    if (downInput) downInput.value = cgMoveDown;
    if (rightInput) rightInput.value = cgMoveRight;
    if (captureBtn) captureBtn.textContent = cgCaptureKey === 'tab' ? 'Tab' : cgCaptureKey;
}

function saveHotkeysPanel() {
    // Save ratio mappings
    primeMappings = {};
    reciprocalMappings = {};
    document.querySelectorAll('.ratio-input').forEach(input => {
        const num = parseInt(input.dataset.num);
        const denom = parseInt(input.dataset.denom);
        const key = input.value.trim().toLowerCase();
        if (key.length === 1) {
            if (input.dataset.type === 'prime') primeMappings[key] = { num, denom };
            else reciprocalMappings[key] = { num, denom };
        }
    });
    updateAllMappings();

    // submitKey is set live by the key-capture button in init.js

    // Save grid movement keys
    const leftInput = document.getElementById('cg-move-left-input');
    const upInput = document.getElementById('cg-move-up-input');
    const downInput = document.getElementById('cg-move-down-input');
    const rightInput = document.getElementById('cg-move-right-input');
    if (leftInput && leftInput.value.length === 1) cgMoveLeft = leftInput.value.toLowerCase();
    if (upInput && upInput.value.length === 1) cgMoveUp = upInput.value.toLowerCase();
    if (downInput && downInput.value.length === 1) cgMoveDown = downInput.value.toLowerCase();
    if (rightInput && rightInput.value.length === 1) cgMoveRight = rightInput.value.toLowerCase();
    // cgCaptureKey is set live by the key-capture button in init.js

    saveSettings();
}

function resetHotkeysPanel() {
    primeMappings = { ...DEFAULT_PRIME_MAPPINGS };
    reciprocalMappings = { ...DEFAULT_RECIPROCAL_MAPPINGS };
    updateAllMappings();
    submitKey = '`';
    cgMoveLeft = 'a'; cgMoveUp = 's'; cgMoveDown = 'd'; cgMoveRight = 'f';
    cgCaptureKey = 'tab';
    renderHotkeysPanel();
    // Also reset any listening state on capture buttons
    const captureBtn = document.getElementById('cg-capture-key-btn');
    if (captureBtn) captureBtn.classList.remove('listening');
    const submitKeyBtn = document.getElementById('submit-key-btn');
    if (submitKeyBtn) submitKeyBtn.classList.remove('listening');
    saveSettings();
}

function updateAllMappings() {
    allMappings = { ...primeMappings, ...reciprocalMappings };
}

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
        cgMoveLeft: cgMoveLeft, cgMoveUp: cgMoveUp, cgMoveDown: cgMoveDown, cgMoveRight: cgMoveRight,
        cgCaptureKey: cgCaptureKey,
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
            if (settings.cgMoveLeft !== undefined) cgMoveLeft = settings.cgMoveLeft;
            if (settings.cgMoveUp !== undefined) cgMoveUp = settings.cgMoveUp;
            if (settings.cgMoveDown !== undefined) cgMoveDown = settings.cgMoveDown;
            if (settings.cgMoveRight !== undefined) cgMoveRight = settings.cgMoveRight;
            if (settings.cgCaptureKey !== undefined) cgCaptureKey = settings.cgCaptureKey;

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

// Mark an interval as correctly entered in a given container (green + wiggle animation)
function markIntervalCorrectInContainer(intervalKey, selector) {
    const spans = document.querySelectorAll(selector);
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

// Reset all interval highlights in a given container
function resetIntervalHighlightsInContainer(selector) {
    const spans = document.querySelectorAll(selector);
    spans.forEach(span => {
        span.style.color = '';
        span.style.fontWeight = '';
        span.classList.remove('wiggle');
    });
}

// Clear feedback element
function clearFeedback(el) {
    if (!el) return;
    el.textContent = '';
    el.className = 'feedback';
    el.style.background = '';
    el.style.color = '';
}

// Wrappers for the game panel's chord intervals
function markIntervalCorrect(intervalKey) {
    markIntervalCorrectInContainer(intervalKey, '.chord-interval');
}

function resetChordIntervalHighlights() {
    resetIntervalHighlightsInContainer('.chord-interval');
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

// Render piano roll SVG into a container
function renderPianoRollSVG({ containerId, intervals, enteredIntervals, arrowValue }) {
    const container = document.getElementById(containerId);
    if (!container || !intervals || intervals.length === 0) return;

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

    const enteredSet = enteredIntervals ? new Set(enteredIntervals.map(i => `${i.num}/${i.denom}`)) : null;

    intervals.forEach((interval, index) => {
        const pos = positions[index];
        const normalizedPos = (pos - paddedMin) / totalRange;
        const y = height - (normalizedPos * height) - barHeight / 2;
        const isEntered = enteredSet ? enteredSet.has(`${interval.num}/${interval.denom}`) : false;
        const color = isEntered ? '#4caf50' : '#999';

        svg += `<rect x="${arrowWidth}" y="${y}" width="${noteWidth}" height="${barHeight}"
                fill="${color}" stroke="#000" stroke-width="1" rx="2"/>`;
    });

    if (arrowValue) {
        const currentPos = Math.log2(arrowValue.num / arrowValue.denom);
        const normalizedPos = (currentPos - paddedMin) / totalRange;
        const arrowY = height - (normalizedPos * height);
        svg += `<path d="M ${arrowWidth - 5} ${arrowY} L 5 ${arrowY - 6} L 5 ${arrowY + 6} Z"
                fill="#4caf50" class="root-arrow"/>`;
    }

    svg += '</svg>';
    container.innerHTML = svg;
}

// Grid rendering
function renderGridInto(containerId, size, pRow, pCol, tRow, tCol, targetPianoRoll) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    container.tabIndex = 0;

    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';

            if (row === pRow && col === pCol) {
                cell.classList.add('player-cell');
                cell.textContent = '◆';
            } else if (row === tRow && col === tCol) {
                cell.classList.add('target-cell');
                if (targetPianoRoll) {
                    cell.classList.add('target-cell-piano');
                    cell.innerHTML = buildTargetCellSVG(targetPianoRoll);
                } else {
                    cell.textContent = '●';
                }
            }

            container.appendChild(cell);
        }
    }

    container.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
}

// Build an inline SVG for the target cell showing chord name + piano roll
function buildTargetCellSVG({ label, intervals, enteredIntervals, arrowValue }) {
    if (!intervals || intervals.length === 0) return label || '●';

    const positions = intervals.map(i => Math.log2(i.num / i.denom));
    const minPos = Math.min(...positions);
    const maxPos = Math.max(...positions);
    const padding = 0.3;
    const paddedMin = minPos - padding;
    const paddedMax = maxPos + padding;
    const totalRange = paddedMax - paddedMin;

    // Fixed viewBox coords — SVG scales to fill the cell via CSS
    const vbW = 60;
    const labelH = 22;
    const rollH = 80;
    const vbH = labelH + rollH;
    const arrowW = 12;
    const noteX = arrowW + 2;
    const noteW = vbW - noteX - 2;
    const barH = 5;

    const enteredSet = enteredIntervals ? new Set(enteredIntervals.map(i => `${i.num}/${i.denom}`)) : new Set();

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">`;

    // Chord name
    if (label) {
        svg += `<text x="${vbW / 2}" y="${labelH - 3}" text-anchor="middle" font-size="15" font-weight="bold" fill="white" font-family="sans-serif">${label}</text>`;
    }

    // Piano roll bars
    intervals.forEach((interval, idx) => {
        const pos = positions[idx];
        const norm = (pos - paddedMin) / totalRange;
        const y = labelH + rollH - (norm * rollH) - barH / 2;
        const isEntered = enteredSet.has(`${interval.num}/${interval.denom}`);
        const fill = isEntered ? '#4caf50' : 'rgba(255,255,255,0.5)';
        svg += `<rect x="${noteX}" y="${y}" width="${noteW}" height="${barH}" fill="${fill}" rx="1"/>`;
    });

    // Arrow
    if (arrowValue) {
        const pos = Math.log2(arrowValue.num / arrowValue.denom);
        const norm = (pos - paddedMin) / totalRange;
        const ay = labelH + rollH - (norm * rollH);
        svg += `<path d="M ${arrowW} ${ay} L 2 ${ay - 4} L 2 ${ay + 4} Z" fill="#4caf50"/>`;
    }

    svg += '</svg>';
    return svg;
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
    const itemSelector = '.game-stat-item[data-chord-key], .stat-item[data-chord-key]';

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

// Update level number and refresh detail panel if open
function updateLevelDisplayElements(numberElId, detailElId, level, chordsList) {
    const numberEl = document.getElementById(numberElId);
    if (numberEl) numberEl.textContent = level;
    const detailEl = document.getElementById(detailElId);
    if (detailEl && detailEl.style.display !== 'none') {
        detailEl.innerHTML = buildLevelDetailHTML(chordsList);
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

// Generic settings-panel stats display
function updateChordStatsGeneric(opts) {
    const statsEl = document.getElementById(opts.statsElId);
    if (!statsEl) return;

    opts.updateLevelFunc();

    if (opts.activeChords.length === 0) {
        if (!opts.loadFunc() || opts.activeChords.length === 0) {
            statsEl.innerHTML = '<p>Click "Start/Continue" to begin!</p>';
            return;
        }
    }

    initDefaultCollapsedState(opts.activeChords, opts.collapsedSet);

    let html = buildGroupedChordHTML({
        chordList: opts.activeChords,
        statsObj: opts.statsObj,
        disabledSet: opts.disabledSet,
        collapsedSet: opts.collapsedSet,
        cssPrefix: 'stat',
        masteryThreshold: opts.getMasteryThreshold(),
        minAttempts: opts.getMinAttempts(),
        rollingWindow: opts.getRollingWindow(),
        showIntervals: false,
        dataMode: opts.dataMode
    });

    const enabledCount = opts.activeChords.filter(c => !opts.disabledSet.has(c.key)).length;
    html += `<p class="progress-text">Active chords: ${enabledCount} / ${opts.allSorted.length} (${opts.activeChords.length} unlocked)</p>`;
    statsEl.innerHTML = html;

    attachChordGroupHandlers(statsEl, {
        chordList: opts.activeChords,
        disabledSet: opts.disabledSet,
        collapsedSet: opts.collapsedSet,
        saveFunc: opts.saveFunc,
        updateFunc: opts.updateFunc,
        dataMode: opts.dataMode
    });
}

// Generic in-game chord progress display
function updateGameChordProgressGeneric(opts) {
    const progressContainer = document.getElementById(opts.containerId);
    const progressStats = document.getElementById(opts.statsElId);
    if (!progressContainer || !progressStats) return;

    if (opts.guardFunc && !opts.guardFunc()) {
        progressContainer.style.display = 'none';
        return;
    }

    progressContainer.style.display = 'block';

    initDefaultCollapsedState(opts.activeChords, opts.collapsedSet);

    let html = buildGroupedChordHTML({
        chordList: opts.activeChords,
        statsObj: opts.statsObj,
        disabledSet: opts.disabledSet,
        collapsedSet: opts.collapsedSet,
        cssPrefix: 'game-stat',
        masteryThreshold: opts.getMasteryThreshold(),
        minAttempts: opts.getMinAttempts(),
        rollingWindow: opts.getRollingWindow(),
        showIntervals: true,
        dataMode: opts.dataMode
    });

    const newChordKey = opts.currentNewChord();
    if (newChordKey) {
        const newChord = opts.allSorted.find(c => c.key === newChordKey);
        if (newChord) {
            const intervalsDisplay = newChord.expectedIntervals.map(i => `${i.num}/${i.denom}`).join(', ');
            const posInfo = newChord.positionLabel ? ` <small>${newChord.positionLabel}</small>` : '';
            html += `
                <div class="game-stat-item drilling">
                    <div class="game-stat-interval">${newChord.name}${posInfo}</div>
                    <div class="game-stat-details">
                        <span class="game-stat-cents">${intervalsDisplay}</span>
                    </div>
                    <div class="game-stat-info">
                        <span class="game-stat-badge drilling">Drilling: ${opts.drillCount()}/${opts.drillTarget}</span>
                    </div>
                </div>
            `;
        }
    }

    progressStats.innerHTML = html;

    attachChordGroupHandlers(progressStats, {
        chordList: opts.activeChords,
        disabledSet: opts.disabledSet,
        collapsedSet: opts.collapsedSet,
        saveFunc: opts.saveFunc,
        updateFunc: opts.updateFunc,
        dataMode: opts.dataMode
    });
}
