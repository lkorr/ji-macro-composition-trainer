// ============================================================
// ONSLAUGHT MODE — Grid + multiple simultaneous timed targets
// ============================================================

let onslaughtActive = false;
let onslaughtPhase = 'grid'; // 'grid' or 'chord'
let onslaughtScore = 0;
let onslaughtStartTime = null;
let onslaughtTimerInterval = null;
let onslaughtSpawnTimeout = null;
let onslaughtAnimFrame = null;
let onslaughtFadeTime = 15;       // seconds before a target expires
let onslaughtSpawnInterval = 10;  // starting seconds between spawns
let onslaughtTargetIdCounter = 0;

// Player position (shared with grid)
let onslaughtPlayerRow = 0;
let onslaughtPlayerCol = 0;
let onslaughtGridSize = 5;

// All live targets: { id, row, col, chordKey, name, expectedIntervals,
//                     spawnTime, expiryTime, timeoutId,
//                     progress, composition }
let onslaughtTargets = [];

// The target currently being entered in chord phase
let onslaughtActiveTargetId = null;

// Current onslaught level (1-based; 0 = custom)
let onslaughtLevel = 1;

// Live-tracked current spawn delay (seconds), shrinks as player does well
let onslaughtCurrentSpawnInterval = 10;

// Custom level pool (when onslaughtLevel === 0)
let onslaughtCustomPool = [];

// ===== LEVEL DEFINITIONS =====
// Each level has a lines array of chord text (textarea format) that gets
// loaded into the custom pool when the card is selected.
const ONSLAUGHT_LEVELS = [
    {
        name: 'Triads',
        description: 'Major, Minor, Diminished, Augmented',
        lines: [
            '[4, 5, 6] : Major',
            '[10, 12, 15] : Minor',
            '[25, 30, 36] : Diminished',
            '[16, 20, 25] : Augmented',
        ]
    },
    {
        name: 'Seventh Chords',
        description: 'Major 7, Minor 7, Dom 7, Harmonic 7',
        lines: [
            '[8, 10, 12, 15] : Major 7th',
            '[10, 12, 15, 18] : Minor 7th',
            '[20, 25, 30, 36] : Dominant 7th',
            '[4, 5, 6, 7] : Harmonic 7th',
        ]
    },
    {
        name: 'Xen Triads',
        description: 'Neutral, Subminor, Supermajor, Tridecimal Inframinor, Tridecimal Ultramajor',
        lines: [
            '[1/1, 11/9, 3/2] : Neutral',
            '[6, 7, 9] : Subminor',
            '[14, 18, 21] : Supermajor',
            '[1/1, 15/13, 3/2] : Tridecimal Inframinor',
            '[1/1, 13/10, 3/2] : Tridecimal Ultramajor',
        ]
    },
    {
        name: 'Xen Seventh Chords',
        description: 'Seventh versions of all xen triads',
        lines: [
            '[1/1, 11/9, 3/2, 7/4] : Neutral 7th',
            '[12, 14, 18, 21] : Subminor 7th',
            '[14, 18, 21, 27] : Supermajor 7th',
            '[1/1, 15/13, 3/2, 7/4] : Tridecimal Inframinor 7th',
            '[1/1, 13/10, 3/2, 7/4] : Tridecimal Ultramajor 7th',
        ]
    },
];

// Append a level's lines to the custom textarea and re-validate
function loadLevelIntoTextarea(levelIdx) {
    const textarea = document.getElementById('onslaught-custom-chords-input');
    if (!textarea || levelIdx < 0 || levelIdx >= ONSLAUGHT_LEVELS.length) return;
    const existing = textarea.value.trim();
    const toAdd = ONSLAUGHT_LEVELS[levelIdx].lines.join('\n');
    textarea.value = existing ? existing + '\n' + toAdd : toAdd;
    validateCustomChords();
}

// Get a chord entry for onslaught, optionally with a random starting position
function onslaughtChordEntryForKey(baseKey) {
    const randomStart = document.getElementById('onslaught-random-start-checkbox')?.checked || false;
    const intervals = CHORD_TYPES[baseKey];
    if (!intervals) return null;

    // Pick a random starting position (0 = root always available; 1+ only when randomStart enabled)
    const maxSp = randomStart ? intervals.length : 1;
    const sp = Math.floor(Math.random() * maxSp);

    // Try to find a pre-computed entry in cgAllChordsSorted
    const allSorted = typeof cgAllChordsSorted !== 'undefined' ? cgAllChordsSorted : [];
    const found = allSorted.find(c => c.chordKey === baseKey && c.startingPosition === sp);
    if (found) return found;

    // Fallback: build entry directly
    const positionNames = ['root', '3rd', '5th', '7th', '9th'];
    return {
        key: baseKey + (sp > 0 ? '_sp' + sp : ''),
        chordKey: baseKey,
        startingPosition: sp,
        expectedIntervals: computeTransformedIntervals(baseKey, sp),
        intervals,
        name: CHORD_NAMES[baseKey] || baseKey,
        positionLabel: sp > 0 ? 'from ' + (positionNames[sp] || sp + 'th') : ''
    };
}

// ===== CUSTOM LEVEL PARSING =====

// Parse a single line like "[1/1, 5/4, 3/2] : Major" or "[4, 5, 6] : Major"
// Returns { intervals: [{num,denom},...], name } or null on error
function parseCustomChordLine(line) {
    line = line.trim();
    if (!line || line.startsWith('//') || line.startsWith('#')) return null;

    // Split on " : " or ":" separating ratios from name
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return null;

    // Find the bracket content
    const bracketOpen = line.indexOf('[');
    const bracketClose = line.indexOf(']');
    if (bracketOpen === -1 || bracketClose === -1 || bracketClose < bracketOpen) return null;

    const ratioStr = line.slice(bracketOpen + 1, bracketClose);
    // Name is everything after the first colon that comes after ']'
    const afterBracket = line.slice(bracketClose + 1);
    const nameColonIdx = afterBracket.indexOf(':');
    const name = nameColonIdx !== -1
        ? afterBracket.slice(nameColonIdx + 1).trim()
        : afterBracket.trim();
    if (!name) return null;

    const parts = ratioStr.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length < 2) return null;

    const intervals = [];
    // Check if all parts are plain integers (harmonic series notation like 4,5,6)
    const allIntegers = parts.every(p => /^\d+$/.test(p));

    if (allIntegers) {
        // Treat as harmonic series: divide all by the first
        const nums = parts.map(Number);
        const base = nums[0];
        for (const n of nums) {
            const g = gcd(n, base);
            intervals.push({ num: n / g, denom: base / g });
        }
    } else {
        // Treat as explicit fractions like "1/1", "5/4", etc.
        for (const p of parts) {
            if (p.includes('/')) {
                const [n, d] = p.split('/').map(Number);
                if (!n || !d || isNaN(n) || isNaN(d)) return null;
                const g = gcd(n, d);
                intervals.push({ num: n / g, denom: d / g });
            } else {
                // Plain number treated as N/1
                const n = Number(p);
                if (isNaN(n) || n <= 0) return null;
                intervals.push({ num: n, denom: 1 });
            }
        }
    }

    // Sort ascending by value
    intervals.sort((a, b) => (a.num / a.denom) - (b.num / b.denom));

    return { intervals, name };
}

// Parse entire custom textarea, return array of chord entries + status message
function parseCustomChordsText(text) {
    const lines = text.split('\n');
    const chords = [];
    const errors = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('//') || line.startsWith('#')) continue;
        const result = parseCustomChordLine(line);
        if (result) {
            chords.push({
                key: 'custom_' + i,
                chordKey: 'custom_' + i,
                startingPosition: 0,
                expectedIntervals: result.intervals,
                intervals: result.intervals,
                name: result.name,
                positionLabel: '',
                weight: 1
            });
        } else {
            errors.push(`Line ${i + 1}: "${line}"`);
        }
    }

    return { chords, errors };
}

// ===== LEVEL CARD RENDERING =====

function renderOnslaughtLevelCards() {
    const container = document.getElementById('onslaught-level-cards');
    if (!container) return;
    container.innerHTML = '';

    ONSLAUGHT_LEVELS.forEach((lvl, idx) => {
        const card = document.createElement('div');
        card.className = 'onslaught-level-card';
        card.dataset.level = idx + 1;

        // Derive unique chord names from lines for pill display
        const seen = new Set();
        const pills = lvl.lines
            .map(l => { const m = l.match(/:\s*(.+)$/); return m ? m[1].trim() : null; })
            .filter(n => n && !seen.has(n) && seen.add(n))
            .map(n => `<span class="chord-pill">${n}</span>`)
            .join('');

        card.innerHTML = `
            <div class="level-card-header">
                <span class="level-card-number">+ Add</span>
                <span class="level-card-title">${lvl.name}</span>
            </div>
            <div class="level-card-desc">${lvl.description}</div>
            <div class="level-card-pills">${pills}</div>
        `;

        card.addEventListener('click', () => {
            loadLevelIntoTextarea(idx);
        });

        container.appendChild(card);
    });
}

function validateCustomChords() {
    const textarea = document.getElementById('onslaught-custom-chords-input');
    const status = document.getElementById('onslaught-custom-parse-status');
    if (!textarea || !status) return;

    const { chords, errors } = parseCustomChordsText(textarea.value);
    onslaughtCustomPool = chords;

    if (chords.length === 0 && errors.length === 0) {
        status.textContent = '';
        status.className = 'custom-parse-status';
    } else if (errors.length > 0) {
        status.textContent = `${chords.length} chord(s) parsed. Parse errors: ${errors.join('; ')}`;
        status.className = 'custom-parse-status parse-error';
    } else {
        status.textContent = `✓ ${chords.length} chord(s) ready: ${chords.map(c => c.name).join(', ')}`;
        status.className = 'custom-parse-status parse-ok';
    }
}

// ===== HELPERS =====

function currentOnslaughtSpawnDelay() {
    return Math.max(3000, onslaughtCurrentSpawnInterval * 1000);
}

// Decrease current spawn interval by 0.1s on correct note (floor at 3s)
function decreaseSpawnInterval() {
    onslaughtCurrentSpawnInterval = Math.max(3, onslaughtCurrentSpawnInterval - 0.1);
    updateOnslaughtSpawnDisplay();
}

// Increase current spawn interval by the given amount (no ceiling)
function increaseSpawnInterval(amount) {
    onslaughtCurrentSpawnInterval += amount;
    updateOnslaughtSpawnDisplay();
}

function getExpirePenalty() {
    return parseFloat(document.getElementById('onslaught-expire-penalty-input')?.value) || 0.5;
}

function getMistakePenalty() {
    return parseFloat(document.getElementById('onslaught-mistake-penalty-input')?.value) || 0.2;
}

function updateOnslaughtSpawnDisplay() {
    const el = document.getElementById('onslaught-spawn-display');
    if (el) el.textContent = onslaughtCurrentSpawnInterval.toFixed(1) + 's';
}

function onslaughtOccupied(row, col) {
    if (row === onslaughtPlayerRow && col === onslaughtPlayerCol) return true;
    return onslaughtTargets.some(t => t.row === row && t.col === col);
}

function onslaughtRandomFreeCell() {
    const cells = [];
    for (let r = 0; r < onslaughtGridSize; r++)
        for (let c = 0; c < onslaughtGridSize; c++)
            if (!onslaughtOccupied(r, c)) cells.push([r, c]);
    if (!cells.length) return null;
    return cells[Math.floor(Math.random() * cells.length)];
}

// ===== SPAWN / EXPIRE =====

function spawnOnslaughtTarget() {
    if (!onslaughtActive) return;

    if (!onslaughtCustomPool.length) { scheduleOnslaughtSpawn(); return; }
    const entry = onslaughtCustomPool[Math.floor(Math.random() * onslaughtCustomPool.length)];
    if (!entry) { scheduleOnslaughtSpawn(); return; }

    const cell = onslaughtRandomFreeCell();
    if (!cell) { scheduleOnslaughtSpawn(); return; }

    // Apply random starting position if enabled
    const randomStart = document.getElementById('onslaught-random-start-checkbox')?.checked || false;
    const baseIntervals = entry.intervals || entry.expectedIntervals;
    const maxSp = randomStart ? baseIntervals.length : 1;
    const sp = Math.floor(Math.random() * maxSp);

    let expectedIntervals = baseIntervals;
    let positionLabel = '';
    if (sp > 0) {
        const ref = baseIntervals[sp];
        expectedIntervals = baseIntervals.map(iv => {
            const n = iv.num * ref.denom;
            const d = iv.denom * ref.num;
            const g = gcd(Math.abs(n), Math.abs(d));
            return { num: n / g, denom: d / g };
        }).sort((a, b) => (a.num / a.denom) - (b.num / b.denom));
        const positionNames = ['root', '3rd', '5th', '7th', '9th'];
        positionLabel = 'from ' + (positionNames[sp] || sp + 'th');
    }

    const id = ++onslaughtTargetIdCounter;
    const now = Date.now();
    const expiryMs = onslaughtFadeTime * 1000;

    const target = {
        id,
        row: cell[0], col: cell[1],
        chordKey: entry.chordKey || entry.key,
        name: entry.name,
        positionLabel,
        expectedIntervals,
        spawnTime: now,
        expiryTime: now + expiryMs,
        timeoutId: setTimeout(() => expireOnslaughtTarget(id), expiryMs),
        progress: [],
        composition: []
    };

    onslaughtTargets.push(target);
    renderOnslaughtGrid();
    scheduleOnslaughtSpawn();
}

function scheduleOnslaughtSpawn() {
    clearTimeout(onslaughtSpawnTimeout);
    onslaughtSpawnTimeout = setTimeout(spawnOnslaughtTarget, currentOnslaughtSpawnDelay());
}

function expireOnslaughtTarget(id) {
    const idx = onslaughtTargets.findIndex(t => t.id === id);
    if (idx === -1) return;

    // If we're in chord phase for this target, abort back to grid
    if (onslaughtPhase === 'chord' && onslaughtActiveTargetId === id) {
        onslaughtActiveTargetId = null;
        setOnslaughtPhase('grid');
    }

    onslaughtTargets.splice(idx, 1);
    onslaughtScore = Math.max(0, onslaughtScore - 1);
    updateOnslaughtScoreDisplay();
    increaseSpawnInterval(getExpirePenalty());
    renderOnslaughtGrid();
}

function removeOnslaughtTarget(id) {
    const t = onslaughtTargets.find(t => t.id === id);
    if (t) clearTimeout(t.timeoutId);
    onslaughtTargets = onslaughtTargets.filter(t => t.id !== id);
}

// ===== GRID RENDERING =====

function renderOnslaughtGrid() {
    const container = document.getElementById('onslaught-grid-container');
    if (!container) return;
    container.innerHTML = '';
    container.tabIndex = 0;

    const now = Date.now();

    for (let row = 0; row < onslaughtGridSize; row++) {
        for (let col = 0; col < onslaughtGridSize; col++) {
            const cell = document.createElement('div');
            cell.className = 'grid-cell';

            const target = onslaughtTargets.find(t => t.row === row && t.col === col);
            if (target) {
                const remaining = Math.max(0, target.expiryTime - now);
                const frac = remaining / (onslaughtFadeTime * 1000);
                const lightness = Math.round(30 + frac * 20);
                const hue = Math.round(frac * 120); // green → red
                cell.classList.add('target-cell');
                cell.style.background = `hsl(${hue}, 70%, ${lightness}%)`;
                cell.style.boxShadow = `0 0 10px hsl(${hue}, 70%, ${lightness}%)`;
                cell.classList.add('target-cell-piano');

                const isActive = onslaughtPhase === 'chord' && onslaughtActiveTargetId === target.id;
                const pianoRoll = {
                    label: target.name,
                    intervals: target.expectedIntervals,
                    enteredIntervals: isActive ? target.progress : null,
                    arrowValue: isActive ? multiplyFractions(target.composition) : { num: 1, denom: 1 }
                };
                cell.innerHTML = buildTargetCellSVG(pianoRoll);
            }

            if (row === onslaughtPlayerRow && col === onslaughtPlayerCol) {
                cell.classList.add('player-cell');
            }

            // In chord phase, dim everything except the active target cell
            if (onslaughtPhase === 'chord') {
                const activeTarget = onslaughtTargets.find(t => t.id === onslaughtActiveTargetId);
                if (activeTarget && !(row === activeTarget.row && col === activeTarget.col)) {
                    cell.classList.add('cell-dimmed');
                }
            }

            container.appendChild(cell);
        }
    }

    container.style.gridTemplateColumns = `repeat(${onslaughtGridSize}, 1fr)`;
}

// Animate countdown colours on targets
function animateOnslaughtGrid() {
    if (!onslaughtActive) return;
    renderOnslaughtGrid();
    onslaughtAnimFrame = requestAnimationFrame(animateOnslaughtGrid);
}

// ===== MOVEMENT / CAPTURE =====

function moveOnslaughtPlayer(dRow, dCol) {
    if (!onslaughtActive || onslaughtPhase !== 'grid') return;
    const nr = onslaughtPlayerRow + dRow;
    const nc = onslaughtPlayerCol + dCol;
    if (nr >= 0 && nr < onslaughtGridSize && nc >= 0 && nc < onslaughtGridSize) {
        onslaughtPlayerRow = nr;
        onslaughtPlayerCol = nc;
        renderOnslaughtGrid();
    }
}

function captureOnslaughtTarget() {
    if (!onslaughtActive || onslaughtPhase !== 'grid') return;
    const target = onslaughtTargets.find(
        t => t.row === onslaughtPlayerRow && t.col === onslaughtPlayerCol
    );
    if (!target) return;

    onslaughtActiveTargetId = target.id;
    target.progress = [];
    target.composition = [];
    setOnslaughtPhase('chord');
}

// ===== CHORD PHASE =====

function setOnslaughtPhase(phase) {
    onslaughtPhase = phase;

    const showInfoCheckbox = document.getElementById('onslaught-show-chord-info-checkbox');
    const showChordInfo = !showInfoCheckbox || showInfoCheckbox.checked;

    const phaseIndicator = document.getElementById('onslaught-phase-indicator');
    const gridContainer = document.getElementById('onslaught-grid-container');
    const pianoRoll = document.getElementById('onslaught-piano-roll');
    const keyboardLegend = document.getElementById('onslaught-keyboard-legend');
    const compositionDisplay = document.getElementById('onslaught-composition-display');
    const controlsInfo = document.getElementById('onslaught-controls-info');
    const chordDisplay = document.getElementById('onslaught-chord-display');

    if (phase === 'grid') {
        if (phaseIndicator) {
            phaseIndicator.className = 'chord-grid-phase-indicator grid-phase';
            phaseIndicator.textContent = 'Grid Phase - Navigate to a target';
        }
        if (gridContainer) gridContainer.classList.remove('chord-phase-dimmed');
        if (pianoRoll) pianoRoll.style.display = 'none';
        if (keyboardLegend) keyboardLegend.style.display = 'none';
        if (compositionDisplay) compositionDisplay.style.display = 'none';
        if (controlsInfo) controlsInfo.style.display = 'block';
        if (chordDisplay) chordDisplay.style.display = 'none';
    } else {
        const target = onslaughtTargets.find(t => t.id === onslaughtActiveTargetId);
        if (!target) return;

        if (phaseIndicator) {
            phaseIndicator.className = 'chord-grid-phase-indicator chord-phase';
            phaseIndicator.textContent = 'Chord Phase - Build the chord!';
        }
        if (gridContainer) gridContainer.classList.add('chord-phase-dimmed');
        if (keyboardLegend) keyboardLegend.style.display = 'block';
        if (compositionDisplay) compositionDisplay.style.display = 'flex';
        if (controlsInfo) controlsInfo.style.display = 'none';
        if (chordDisplay) chordDisplay.style.display = showChordInfo ? 'block' : 'none';

        // Populate chord display and piano roll only if enabled
        if (showChordInfo) {
            updateOnslaughtChordDisplay(target);
            if (pianoRoll) pianoRoll.style.display = 'flex';
            renderOnslaughtPianoRoll(target);
        }
        resetIntervalHighlightsInContainer('#onslaught-chord-intervals .chord-interval');
        renderOnslaughtGrid();
    }
}

function updateOnslaughtChordDisplay(target) {
    const nameEl = document.getElementById('onslaught-chord-name');
    const notationEl = document.getElementById('onslaught-chord-notation');
    const intervalsEl = document.getElementById('onslaught-chord-intervals');

    if (nameEl) nameEl.textContent = target.name;
    if (notationEl) notationEl.textContent = target.chordKey;
    if (intervalsEl) {
        intervalsEl.innerHTML = target.expectedIntervals.map(i =>
            `<span class="chord-interval" data-interval="${i.num}/${i.denom}">${i.num}/${i.denom}</span>`
        ).join(', ');
    }
}

function renderOnslaughtPianoRoll(target) {
    renderPianoRollSVG({
        containerId: 'onslaught-piano-roll',
        intervals: target.expectedIntervals,
        enteredIntervals: target.progress,
        arrowValue: multiplyFractions(target.composition)
    });
}

function updateOnslaughtCompositionDisplay(target) {
    const el = document.getElementById('onslaught-composition');
    if (!el) return;
    if (target.composition.length === 0) {
        el.textContent = 'Press keys to build interval...';
        el.style.color = '#999';
    } else {
        const product = multiplyFractions(target.composition);
        if (target.composition.length === 1) {
            el.innerHTML = `<strong>${product.num}/${product.denom}</strong>`;
        } else {
            const parts = target.composition.map(c => `${c.num}/${c.denom}`).join(' × ');
            el.innerHTML = `${parts} = <strong>${product.num}/${product.denom}</strong>`;
        }
        el.style.color = '#333';
    }
}

// ===== KEYPRESS =====

function handleOnslaughtKeyPress(event) {
    if (!onslaughtActive) return;
    const key = event.key.toLowerCase();

    if (onslaughtPhase === 'grid') {
        if (event.key === 'Tab') event.preventDefault();
        if (key === cgMoveLeft)        { event.preventDefault(); moveOnslaughtPlayer(0, -1); }
        else if (key === cgMoveUp)     { event.preventDefault(); moveOnslaughtPlayer(-1, 0); }
        else if (key === cgMoveDown)   { event.preventDefault(); moveOnslaughtPlayer(1, 0); }
        else if (key === cgMoveRight)  { event.preventDefault(); moveOnslaughtPlayer(0, 1); }
        else if (key === cgCaptureKey) { event.preventDefault(); captureOnslaughtTarget(); }
    } else {
        // Chord phase
        const target = onslaughtTargets.find(t => t.id === onslaughtActiveTargetId);
        if (!target) return;

        if (key === 'backspace') {
            event.preventDefault();
            target.composition = [];
            target.progress = [];
            resetIntervalHighlightsInContainer('#onslaught-chord-intervals .chord-interval');
            updateOnslaughtCompositionDisplay(target);
            renderOnslaughtPianoRoll(target);
            renderOnslaughtGrid();
            return;
        }

        if (key === submitKey.toLowerCase()) {
            event.preventDefault();
            const product = multiplyFractions(target.composition);
            const intervalKey = `${product.num}/${product.denom}`;
            const expectedSet = new Set(target.expectedIntervals.map(i => `${i.num}/${i.denom}`));
            const alreadyEntered = new Set(target.progress.map(i => `${i.num}/${i.denom}`));

            if (expectedSet.has(intervalKey) && !alreadyEntered.has(intervalKey)) {
                target.progress.push(product);
                playSingleTone(product.num, product.denom);
                markIntervalCorrectInContainer(intervalKey, '#onslaught-chord-intervals .chord-interval');
                target.composition = [];
                updateOnslaughtCompositionDisplay(target);
                renderOnslaughtPianoRoll(target);
                renderOnslaughtGrid();

                if (target.progress.length === target.expectedIntervals.length) {
                    // Chord complete
                    onslaughtScore++;
                    decreaseSpawnInterval();
                    updateOnslaughtScoreDisplay();
                    removeOnslaughtTarget(target.id);
                    onslaughtActiveTargetId = null;
                    setOnslaughtPhase('grid');
                }
            } else {
                // Wrong
                playSound('wrong');
                const mistakeExpires = document.getElementById('onslaught-mistake-expires-checkbox')?.checked;
                if (mistakeExpires) {
                    onslaughtActiveTargetId = null;
                    setOnslaughtPhase('grid');
                    removeOnslaughtTarget(target.id);
                    onslaughtScore = Math.max(0, onslaughtScore - 1);
                    updateOnslaughtScoreDisplay();
                    increaseSpawnInterval(getMistakePenalty());
                    renderOnslaughtGrid();
                } else {
                    target.composition = [];
                    target.progress = [];
                    resetIntervalHighlightsInContainer('#onslaught-chord-intervals .chord-interval');
                    updateOnslaughtCompositionDisplay(target);
                    renderOnslaughtPianoRoll(target);
                    renderOnslaughtGrid();
                }
            }
            return;
        }

        if (allMappings[key]) {
            event.preventDefault();
            target.composition.push(allMappings[key]);
            updateOnslaughtCompositionDisplay(target);
            renderOnslaughtPianoRoll(target);
            renderOnslaughtGrid();
        }
    }
}

// ===== HUD =====

function updateOnslaughtScoreDisplay() {
    const el = document.getElementById('onslaught-score');
    if (el) el.textContent = onslaughtScore;
}

function updateOnslaughtTimer() {
    if (!onslaughtActive || !onslaughtStartTime) return;
    const el = document.getElementById('onslaught-timer');
    if (el) el.textContent = formatElapsedTime(onslaughtStartTime);
}

// ===== START / END =====

function startOnslaughtGame() {
    const sizeInput = document.getElementById('onslaught-grid-size-input');
    if (sizeInput) onslaughtGridSize = parseInt(sizeInput.value) || 5;

    const fadeInput = document.getElementById('onslaught-fade-time-input');
    if (fadeInput) onslaughtFadeTime = parseFloat(fadeInput.value) || 15;

    const spawnInput = document.getElementById('onslaught-spawn-interval-input');
    if (spawnInput) onslaughtSpawnInterval = parseFloat(spawnInput.value) || 10;

    // Validate pool before starting
    validateCustomChords();
    if (!onslaughtCustomPool.length) {
        alert('No valid chords in pool. Select a level or add custom chords.');
        return;
    }

    onslaughtCurrentSpawnInterval = onslaughtSpawnInterval;
    onslaughtActive = true;
    onslaughtPhase = 'grid';
    onslaughtTargets = [];
    onslaughtActiveTargetId = null;
    onslaughtScore = 0;
    onslaughtTargetIdCounter = 0;
    onslaughtStartTime = Date.now();

    onslaughtPlayerRow = Math.floor(onslaughtGridSize / 2);
    onslaughtPlayerCol = Math.floor(onslaughtGridSize / 2);

    showPanel('onslaught-game-panel');
    updateOnslaughtScoreDisplay();
    updateOnslaughtSpawnDisplay();
    const lvlDisplay = document.getElementById('onslaught-level-display');
    if (lvlDisplay) {
        lvlDisplay.textContent = onslaughtLevel === 0
            ? 'Custom'
            : ONSLAUGHT_LEVELS[onslaughtLevel - 1]?.name || onslaughtLevel;
    }
    setOnslaughtPhase('grid');
    updateChordGridControlsDisplay(); // reuse same key label updater

    // Spawn first target immediately then schedule
    spawnOnslaughtTarget();

    onslaughtTimerInterval = setInterval(updateOnslaughtTimer, 100);
    onslaughtAnimFrame = requestAnimationFrame(animateOnslaughtGrid);

    renderKeyboardLegendInto(document.getElementById('onslaught-legend-grid'));

    const container = document.getElementById('onslaught-grid-container');
    if (container) container.focus();
}

function endOnslaughtGame() {
    onslaughtActive = false;
    clearTimeout(onslaughtSpawnTimeout);
    clearInterval(onslaughtTimerInterval);
    if (onslaughtAnimFrame) cancelAnimationFrame(onslaughtAnimFrame);
    for (const t of onslaughtTargets) clearTimeout(t.timeoutId);
    onslaughtTargets = [];
    onslaughtActiveTargetId = null;
    showPanel('onslaught-mode-panel');
}
