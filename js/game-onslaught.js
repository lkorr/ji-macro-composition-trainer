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

// ===== HELPERS =====

function currentOnslaughtSpawnDelay() {
    if (!onslaughtStartTime) return onslaughtSpawnInterval * 1000;
    const elapsed = (Date.now() - onslaughtStartTime) / 1000;
    // Halve interval every 60s, floor at 3s
    return Math.max(3000, onslaughtSpawnInterval * 1000 * Math.pow(0.5, elapsed / 60));
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

    const pool = cgActiveChords.length > 0 ? cgActiveChords : cgAllChordsSorted.slice(0, 1);
    const entry = pool[Math.floor(Math.random() * pool.length)];
    if (!entry) { scheduleOnslaughtSpawn(); return; }

    const cell = onslaughtRandomFreeCell();
    if (!cell) { scheduleOnslaughtSpawn(); return; }

    const id = ++onslaughtTargetIdCounter;
    const now = Date.now();
    const expiryMs = onslaughtFadeTime * 1000;

    const target = {
        id,
        row: cell[0], col: cell[1],
        chordKey: entry.key,
        name: entry.name,
        expectedIntervals: entry.expectedIntervals,
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

            if (row === onslaughtPlayerRow && col === onslaughtPlayerCol) {
                cell.classList.add('player-cell');
                cell.textContent = '◆';
            } else {
                const target = onslaughtTargets.find(t => t.row === row && t.col === col);
                if (target) {
                    const remaining = Math.max(0, target.expiryTime - now);
                    const frac = remaining / (onslaughtFadeTime * 1000);
                    // Fade from red toward dark as time runs out
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
        if (chordDisplay) chordDisplay.style.display = 'block';

        // Populate chord display
        updateOnslaughtChordDisplay(target);
        resetIntervalHighlightsInContainer('#onslaught-chord-intervals .chord-interval');

        // Show piano roll
        if (pianoRoll) pianoRoll.style.display = 'flex';
        renderOnslaughtPianoRoll(target);
        renderOnslaughtGrid();
    }
}

function updateOnslaughtChordDisplay(target) {
    const nameEl = document.getElementById('onslaught-chord-name');
    const notationEl = document.getElementById('onslaught-chord-notation');
    const intervalsEl = document.getElementById('onslaught-chord-intervals');

    if (nameEl) nameEl.textContent = target.name;
    const entry = cgAllChordsSorted.find(c => c.key === target.chordKey);
    if (notationEl) notationEl.textContent = entry ? entry.chordKey : target.chordKey;
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
                    updateOnslaughtScoreDisplay();
                    removeOnslaughtTarget(target.id);
                    onslaughtActiveTargetId = null;
                    setOnslaughtPhase('grid');
                }
            } else {
                // Wrong
                playSingleTone(product.num, product.denom);
                target.composition = [];
                target.progress = [];
                resetIntervalHighlightsInContainer('#onslaught-chord-intervals .chord-interval');
                updateOnslaughtCompositionDisplay(target);
                renderOnslaughtPianoRoll(target);
                renderOnslaughtGrid();
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
    if (cgActiveChords.length === 0) initializeCGAdaptiveMode();

    const sizeInput = document.getElementById('onslaught-grid-size-input');
    if (sizeInput) onslaughtGridSize = parseInt(sizeInput.value) || 5;

    const fadeInput = document.getElementById('onslaught-fade-time-input');
    if (fadeInput) onslaughtFadeTime = parseFloat(fadeInput.value) || 15;

    const spawnInput = document.getElementById('onslaught-spawn-interval-input');
    if (spawnInput) onslaughtSpawnInterval = parseFloat(spawnInput.value) || 10;

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
