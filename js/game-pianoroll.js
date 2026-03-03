// ============================================================
// PIANO ROLL ONSLAUGHT MODE
// ============================================================

let prActive = false;
let prScore = 0;
let prStartTime = null;
let prTimerInterval = null;
let prSpawnTimeout = null;
let prAnimFrame = null;
let prTargetIdCounter = 0;

// Configurable settings
let prEdo = 12;
let prNumKeys = 127;
let prBeatColumns = 12;
let prKeyHeight = 20;

// Cursor state
let prCursorStep = 63;  // middle C
let prCursorCol = 0;
let prSavePointStep = 63;

// Timing
let prFadeTime = 15;
let prSpawnInterval = 10;
let prCurrentSpawnInterval = 10;

// Targets array. Each target:
// { id, cols: Set<int>, name,
//   ghostNotes: [{col, step}], placedKeys: Set<"col,step">,
//   spawnTime, expiryTime, timeoutId, isArp }
let prTargets = [];

// Placed notes: Map<"col,step", {col, step, targetId}>
let prPlacedNotes = new Map();

// Spawn range & interval spacing
let prSpawnOctaves = 2;
let prPoolIntervalSteps = [];
let prIncludeIntervals = false;
let prIntervalPool = [];

// Arpeggio settings
let prArpMode = 'off'; // 'off', 'ascending', 'descending', 'both'
let prArpChance = 0.3;  // probability a target spawns as arpeggio (0-1)

// Cursor label
let prShowCursorLabel = true; // show interval distance from nearest ghost note
let prLabelPrimeLimit = 13;   // only use primes ≤ this in BFS ratio calculator
let prActiveEntryTargetId = null; // suppress label while entering this target

// Custom pool & penalties
let prCustomPool = [];
let prMistakeExpires = false;
let prMistakePenalty = 0.2;
let prExpirePenalty = 0.5;

// Color palette for per-target coloring
const PR_TARGET_COLORS = [
    { border: '#4a90d9', bg: 'rgba(74, 144, 217, 0.15)',  text: '#4a90d9', placed: '#5a9fe8' },  // blue
    { border: '#d94a8a', bg: 'rgba(217, 74, 138, 0.15)',  text: '#d94a8a', placed: '#e85a9a' },  // pink
    { border: '#4ad98a', bg: 'rgba(74, 217, 138, 0.15)',   text: '#4ad98a', placed: '#5ae89a' },  // green
    { border: '#d9a04a', bg: 'rgba(217, 160, 74, 0.15)',  text: '#d9a04a', placed: '#e8b05a' },  // orange
    { border: '#8a4ad9', bg: 'rgba(138, 74, 217, 0.15)',  text: '#8a4ad9', placed: '#9a5ae8' },  // purple
    { border: '#4ad9d9', bg: 'rgba(74, 217, 217, 0.15)',  text: '#4ad9d9', placed: '#5ae8e8' },  // cyan
    { border: '#d9d94a', bg: 'rgba(217, 217, 74, 0.15)',  text: '#d9d94a', placed: '#e8e85a' },  // yellow
    { border: '#d95a4a', bg: 'rgba(217, 90, 74, 0.15)',   text: '#d95a4a', placed: '#e86a5a' },  // red
    { border: '#4a7dd9', bg: 'rgba(74, 125, 217, 0.15)',  text: '#4a7dd9', placed: '#5a8de8' },  // steel blue
    { border: '#d94ad9', bg: 'rgba(217, 74, 217, 0.15)',  text: '#d94ad9', placed: '#e85ae8' },  // magenta
];
let prColorIndex = 0;

// ===== HELPERS =====

function jiRatioToEdoSteps(num, denom) {
    return Math.round(prEdo * Math.log2(num / denom));
}

function prStepLabel(step) {
    const stepInOctave = ((step % prEdo) + prEdo) % prEdo;
    return stepInOctave + '\\' + prEdo;
}

// Return the largest prime factor of n
function largestPrimeFactor(n) {
    if (n <= 1) return 1;
    let largest = 1;
    let d = 2;
    while (d * d <= n) {
        while (n % d === 0) { largest = d; n /= d; }
        d++;
    }
    if (n > 1) largest = n;
    return largest;
}

// Build a lookup from signed EDO step offset → ratio string for cursor label.
// Uses BFS over allMappings: each key press adds its EDO step offset, and
// the ratio is the product of all pressed key ratios. The "simplest" ratio
// for a given step offset is the one reachable in the fewest key presses.
// Only includes keys whose ratio's prime factors are all ≤ prLabelPrimeLimit.
function prBuildStepToRatioMap() {
    // Collect unique EDO step moves from allMappings, filtered by prime limit
    const moves = []; // [{steps, num, denom}]
    const seenSteps = new Set();
    for (const key in allMappings) {
        const r = allMappings[key];
        // Skip if either num or denom has a prime factor above the limit
        if (largestPrimeFactor(r.num) > prLabelPrimeLimit) continue;
        if (largestPrimeFactor(r.denom) > prLabelPrimeLimit) continue;
        const s = jiRatioToEdoSteps(r.num, r.denom);
        if (s !== 0 && !seenSteps.has(s)) {
            seenSteps.add(s);
            moves.push({ steps: s, num: r.num, denom: r.denom });
        }
    }

    const maxRange = prEdo * 2; // cover ±2 octaves
    // map: step offset → { num, denom, presses }
    const map = {};
    map[0] = { num: 1, denom: 1, presses: 0 };

    // BFS queue: [stepOffset, num, denom, presses]
    const queue = [[0, 1, 1, 0]];
    const maxPresses = 6; // cap search depth

    while (queue.length > 0) {
        const [curStep, curNum, curDenom, presses] = queue.shift();
        if (presses >= maxPresses) continue;

        for (const move of moves) {
            const newStep = curStep + move.steps;
            if (newStep < -maxRange || newStep > maxRange) continue;

            const newNum = curNum * move.num;
            const newDenom = curDenom * move.denom;
            const newPresses = presses + 1;

            if (map[newStep] === undefined || newPresses < map[newStep].presses) {
                const g = gcd(newNum, newDenom);
                map[newStep] = { num: newNum / g, denom: newDenom / g, presses: newPresses };
                queue.push([newStep, newNum / g, newDenom / g, newPresses]);
            }
        }
    }

    // Convert to string labels
    const result = {};
    for (const step in map) {
        const entry = map[step];
        result[step] = entry.num + '/' + entry.denom;
    }
    return result;
}

let prStepToRatio = {};

// ===== GRID RENDERING =====

function renderPianoRollGrid() {
    const grid = document.getElementById('pr-grid');
    const sidebar = document.getElementById('pr-sidebar');
    if (!grid || !sidebar) return;

    grid.innerHTML = '';
    sidebar.innerHTML = '';

    // Set grid template
    grid.style.gridTemplateColumns = `repeat(${prBeatColumns}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${prNumKeys}, ${prKeyHeight}px)`;

    // Build cells: rows go from top (step 126) to bottom (step 0)
    for (let row = 0; row < prNumKeys; row++) {
        const step = prNumKeys - 1 - row;
        for (let col = 0; col < prBeatColumns; col++) {
            const cell = document.createElement('div');
            cell.className = 'pr-cell';
            cell.dataset.step = step;
            cell.dataset.col = col;

            if ((step - 63) % prEdo === 0) {
                cell.classList.add('pr-octave-row');
            }

            cell.classList.add(col % 2 === 0 ? 'pr-beat-even' : 'pr-beat-odd');
            grid.appendChild(cell);
        }
    }

    // Build sidebar labels (top = highest step)
    for (let row = 0; row < prNumKeys; row++) {
        const step = prNumKeys - 1 - row;
        const label = document.createElement('div');
        label.className = 'pr-sidebar-label';
        label.style.height = prKeyHeight + 'px';
        label.textContent = prStepLabel(step);

        if ((step - 63) % prEdo === 0) {
            label.classList.add('pr-sidebar-octave');
        }

        sidebar.appendChild(label);
    }

    // Sync sidebar scroll with wrapper
    const wrapper = document.getElementById('pr-wrapper');
    if (wrapper) {
        wrapper.addEventListener('scroll', () => {
            sidebar.scrollTop = wrapper.scrollTop;
        });
    }
}

function renderPianoRollOverlays() {
    const grid = document.getElementById('pr-grid');
    if (!grid) return;

    // Clear cursor class from all cells
    grid.querySelectorAll('.pr-cursor').forEach(el => el.classList.remove('pr-cursor'));

    // Remove overlay elements
    grid.querySelectorAll('.pr-ghost-note, .pr-placed-note, .pr-col-header, .pr-cursor-label').forEach(el => el.remove());

    // Draw cursor
    const cursorCell = getCellAt(prCursorStep, prCursorCol);
    if (cursorCell) {
        cursorCell.classList.add('pr-cursor');
    }

    // Draw ghost notes for each target (labeled + per-target color)
    for (const target of prTargets) {
        const c = target.color;
        for (const gn of target.ghostNotes) {
            const cell = getCellAt(gn.step, gn.col);
            if (cell) {
                const ghost = document.createElement('div');
                ghost.className = 'pr-ghost-note pr-ghost-labeled';
                ghost.textContent = target.name;
                ghost.style.borderColor = c.border;
                ghost.style.background = c.bg;
                ghost.style.color = c.text;
                cell.appendChild(ghost);
            }
        }
    }

    // Draw placed notes (use matched target's color if correct)
    for (const [key, note] of prPlacedNotes) {
        const cell = getCellAt(note.step, note.col);
        if (cell) {
            const placed = document.createElement('div');
            placed.className = 'pr-placed-note';
            if (note.targetId !== null) {
                placed.classList.add('pr-placed-correct');
                const matchedTarget = prTargets.find(t => t.id === note.targetId);
                if (matchedTarget) {
                    placed.style.background = matchedTarget.color.placed;
                }
            }
            cell.appendChild(placed);
        }
    }

    // Draw column headers for targets (colored per target)
    for (const target of prTargets) {
        // Find highest ghost step and its column for the header
        let maxStep = -1;
        let headerCol = 0;
        for (const gn of target.ghostNotes) {
            if (gn.step > maxStep) { maxStep = gn.step; headerCol = gn.col; }
        }
        const headerCell = getCellAt(Math.min(maxStep + 1, prNumKeys - 1), headerCol);
        if (headerCell) {
            const header = document.createElement('div');
            header.className = 'pr-col-header';
            header.textContent = target.name;
            header.dataset.targetId = target.id;
            header.style.color = target.color.text;
            headerCell.appendChild(header);
        }
    }

    // Clear active entry if the target no longer exists or cursor left its columns
    if (prActiveEntryTargetId !== null) {
        const activeTarget = prTargets.find(t => t.id === prActiveEntryTargetId);
        if (!activeTarget || !activeTarget.cols.has(prCursorCol)) {
            prActiveEntryTargetId = null;
        }
    }

    // Draw cursor interval label: show distance from nearest unmatched ghost note
    // Suppress while actively entering a target
    if (prShowCursorLabel && cursorCell && prTargets.length > 0 && prActiveEntryTargetId === null) {
        let bestSigned = 0;
        let bestAbs = Infinity;
        let sameColBestAbs = Infinity;
        let sameColBestSigned = 0;

        for (const target of prTargets) {
            for (const gn of target.ghostNotes) {
                // Skip ghost notes that already have a placed note on them
                const gnKey = gn.col + ',' + gn.step;
                if (target.placedKeys.has(gnKey)) continue;

                const d = Math.abs(gn.step - prCursorStep);
                const signed = gn.step - prCursorStep;
                if (gn.col === prCursorCol && d < sameColBestAbs) {
                    sameColBestAbs = d;
                    sameColBestSigned = signed;
                }
                if (d < bestAbs) {
                    bestAbs = d;
                    bestSigned = signed;
                }
            }
        }

        // Prefer same-column match, fall back to any
        const finalSigned = sameColBestAbs < Infinity ? sameColBestSigned : bestSigned;
        const finalAbs = sameColBestAbs < Infinity ? sameColBestAbs : bestAbs;

        if (finalAbs > 1 && finalAbs < Infinity) {
            const ratioStr = prStepToRatio[finalSigned];
            const labelText = ratioStr
                || (finalSigned >= 0 ? '+' : '') + finalSigned + '\\' + prEdo;

            const label = document.createElement('div');
            label.className = 'pr-cursor-label';
            label.textContent = labelText;
            cursorCell.appendChild(label);
        }
    }
}

function getCellAt(step, col) {
    const grid = document.getElementById('pr-grid');
    if (!grid || step < 0 || step >= prNumKeys || col < 0 || col >= prBeatColumns) return null;
    const row = prNumKeys - 1 - step;
    const idx = row * prBeatColumns + col;
    return grid.children[idx] || null;
}

function scrollToCursor() {
    const wrapper = document.getElementById('pr-wrapper');
    if (!wrapper) return;
    const row = prNumKeys - 1 - prCursorStep;
    const targetTop = row * prKeyHeight;
    const viewHeight = wrapper.clientHeight;
    const desiredTop = targetTop - viewHeight * 0.5;
    wrapper.scrollTop = Math.max(0, desiredTop);
}

// ===== ZOOM =====

function setupPianoRollZoom() {
    const zoomBar = document.getElementById('pr-zoom-sidebar');
    if (!zoomBar) return;

    let dragging = false;
    let startY = 0;
    let startHeight = 0;

    zoomBar.addEventListener('mousedown', (e) => {
        dragging = true;
        startY = e.clientY;
        startHeight = prKeyHeight;
        zoomBar.classList.add('pr-zoom-dragging');
        document.body.style.cursor = 'ns-resize';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        e.preventDefault();
        const deltaY = startY - e.clientY;
        const newHeight = Math.max(8, Math.min(50, startHeight + deltaY * 0.2));
        if (newHeight !== prKeyHeight) {
            const wrapper = document.getElementById('pr-wrapper');
            const oldHeight = prKeyHeight;
            const scaleFactor = newHeight / oldHeight;
            const scrollCenter = wrapper.scrollTop + wrapper.clientHeight / 2;

            prKeyHeight = newHeight;
            applyPianoRollZoom();

            wrapper.scrollTop = scrollCenter * scaleFactor - wrapper.clientHeight / 2;
        }
    });

    document.addEventListener('mouseup', () => {
        if (dragging) {
            dragging = false;
            zoomBar.classList.remove('pr-zoom-dragging');
            document.body.style.cursor = '';
        }
    });
}

function applyPianoRollZoom() {
    const grid = document.getElementById('pr-grid');
    const sidebar = document.getElementById('pr-sidebar');
    if (grid) {
        grid.style.gridTemplateRows = `repeat(${prNumKeys}, ${prKeyHeight}px)`;
    }
    if (sidebar) {
        sidebar.querySelectorAll('.pr-sidebar-label').forEach(label => {
            label.style.height = prKeyHeight + 'px';
        });
    }
}

// ===== AUDIO =====

function playPrStepTone(step) {
    if (!audioContext || !enableSound) return;
    if (audioContext.state === 'suspended') audioContext.resume();

    const now = audioContext.currentTime;
    const freq = 261.63 * Math.pow(2, (step - 63) / prEdo);

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(audioContext.destination);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.15);
}

// ===== KEYPRESS HANDLER =====

function handlePianoRollKeyPress(event) {
    if (!prActive) return;

    const key = event.key.toLowerCase();

    // Column movement: A/F (left/right)
    if (key === cgMoveLeft) {
        event.preventDefault();
        if (prCursorCol > 0) {
            prCursorCol--;
            playSound('move');
        }
        renderPianoRollOverlays();
        scrollToCursor();
        return;
    }
    if (key === cgMoveRight) {
        event.preventDefault();
        if (prCursorCol < prBeatColumns - 1) {
            prCursorCol++;
            playSound('move');
        }
        renderPianoRollOverlays();
        scrollToCursor();
        return;
    }

    // Pitch movement: S = up (step +1), D = down (step -1)
    if (key === cgMoveUp) {
        event.preventDefault();
        if (prCursorStep < prNumKeys - 1) {
            prCursorStep++;
            playPrStepTone(prCursorStep);
        }
        renderPianoRollOverlays();
        scrollToCursor();
        return;
    }
    if (key === cgMoveDown) {
        event.preventDefault();
        if (prCursorStep > 0) {
            prCursorStep--;
            playPrStepTone(prCursorStep);
        }
        renderPianoRollOverlays();
        scrollToCursor();
        return;
    }

    // Tab = place note + set save point
    if (event.key === 'Tab') {
        event.preventDefault();
        placeNoteAtCursor();
        prSavePointStep = prCursorStep;
        renderPianoRollOverlays();
        return;
    }

    // Backtick (submitKey) = place note + revert to save point
    if (key === submitKey.toLowerCase()) {
        event.preventDefault();
        placeNoteAtCursor();
        prCursorStep = prSavePointStep;
        renderPianoRollOverlays();
        scrollToCursor();
        return;
    }

    // Backspace = remove note at cursor
    if (key === 'backspace') {
        event.preventDefault();
        removeNoteAtCursor();
        renderPianoRollOverlays();
        return;
    }

    // JI interval keys: jump by EDO-mapped steps
    if (allMappings[key]) {
        event.preventDefault();
        const ratio = allMappings[key];
        const steps = jiRatioToEdoSteps(ratio.num, ratio.denom);
        const newStep = prCursorStep + steps;
        if (newStep >= 0 && newStep < prNumKeys) {
            prCursorStep = newStep;
            playPrStepTone(prCursorStep);
        }
        renderPianoRollOverlays();
        scrollToCursor();
        return;
    }
}

// ===== NOTE PLACEMENT =====

function placeNoteAtCursor() {
    const noteKey = prCursorCol + ',' + prCursorStep;

    // If already placed here, do nothing
    if (prPlacedNotes.has(noteKey)) return;

    // Check if this (col, step) matches a ghost note in any target
    let matchedTargetId = null;
    for (const target of prTargets) {
        if (!target.cols.has(prCursorCol)) continue;
        const isGhost = target.ghostNotes.some(
            gn => gn.col === prCursorCol && gn.step === prCursorStep
        );
        if (isGhost && !target.placedKeys.has(noteKey)) {
            matchedTargetId = target.id;
            target.placedKeys.add(noteKey);
            break;
        }
    }

    prPlacedNotes.set(noteKey, {
        col: prCursorCol,
        step: prCursorStep,
        targetId: matchedTargetId
    });

    playPrStepTone(prCursorStep);

    if (matchedTargetId !== null) {
        prActiveEntryTargetId = matchedTargetId;
        // Correct placement — speed up spawns
        prCurrentSpawnInterval = Math.max(1, prCurrentSpawnInterval - 0.1);
        updatePianoRollSpawnDisplay();

        // Check if target is now complete
        const target = prTargets.find(t => t.id === matchedTargetId);
        if (target && target.placedKeys.size === target.ghostNotes.length) {
            completeTarget(target.id);
        }
    } else {
        // Check if this is a wrong placement (in a column that belongs to a target)
        const colTarget = prTargets.find(t => t.cols.has(prCursorCol));
        if (colTarget && prMistakeExpires) {
            playSound('wrong');
            removeTarget(colTarget.id, true);
        }
    }
}

function removeNoteAtCursor() {
    const noteKey = prCursorCol + ',' + prCursorStep;
    const note = prPlacedNotes.get(noteKey);
    if (!note) return;

    // Un-mark from target if applicable
    if (note.targetId !== null) {
        const target = prTargets.find(t => t.id === note.targetId);
        if (target) {
            target.placedKeys.delete(noteKey);
        }
    }

    prPlacedNotes.delete(noteKey);
}

// ===== TARGET MANAGEMENT =====

// Extract all unique intervals (as EDO step offsets) from the chord pool.
// For a chord [1/1, 5/4, 3/2] this produces intervals between consecutive
// tones (5/4, 6/5) plus each tone vs root (5/4, 3/2), both up and down.
// Also builds prIntervalPool: 2-note entries that can spawn as targets.
function prBuildPoolIntervals() {
    const stepSet = new Set();
    const seenRatios = new Set();
    const intervalEntries = [];

    function addRatio(num, denom) {
        const g = gcd(num, denom);
        const rn = num / g, rd = denom / g;
        const key = rn + '/' + rd;
        if (!seenRatios.has(key) && rn !== rd) {
            seenRatios.add(key);
            intervalEntries.push({
                intervals: [{ num: 1, denom: 1 }, { num: rn, denom: rd }],
                name: key
            });
        }
    }

    for (const entry of prCustomPool) {
        const ivs = entry.intervals || entry.expectedIntervals;
        if (!ivs || ivs.length < 2) continue;

        const sorted = [...ivs].sort((a, b) => (a.num / a.denom) - (b.num / b.denom));

        // Intervals between consecutive tones
        for (let i = 0; i < sorted.length - 1; i++) {
            const lo = sorted[i], hi = sorted[i + 1];
            const num = hi.num * lo.denom;
            const den = hi.denom * lo.num;
            const steps = Math.round(prEdo * Math.log2(num / den));
            if (steps !== 0) { stepSet.add(steps); stepSet.add(-steps); }
            addRatio(num, den);
        }

        // Each tone vs the root (first element)
        for (let i = 1; i < sorted.length; i++) {
            const num = sorted[i].num * sorted[0].denom;
            const den = sorted[i].denom * sorted[0].num;
            const steps = jiRatioToEdoSteps(num, den);
            if (steps !== 0) { stepSet.add(steps); stepSet.add(-steps); }
            addRatio(num, den);
        }
    }

    prPoolIntervalSteps = Array.from(stepSet).sort((a, b) => a - b);
    prIntervalPool = intervalEntries;
}

// Build ghost notes for a target. Returns [{col, step}].
// For chords (non-arp): all notes share startCol.
// For arpeggios: notes are spread across consecutive columns, one per beat,
// ordered ascending or descending by pitch.
function prBuildGhostNotes(entry, root, startCol, asArp) {
    const ivs = entry.intervals || entry.expectedIntervals;
    const rawSteps = [];
    for (const iv of ivs) {
        const offset = jiRatioToEdoSteps(iv.num, iv.denom);
        const absStep = root + offset;
        if (absStep >= 0 && absStep < prNumKeys) {
            rawSteps.push(absStep);
        }
    }
    // Deduplicate
    const uniqueSteps = [...new Set(rawSteps)].sort((a, b) => a - b);

    if (!asArp) {
        // Chord mode: all notes in one column
        return uniqueSteps.map(step => ({ col: startCol, step }));
    }

    // Arpeggio mode: pick direction
    let ordered;
    if (prArpMode === 'descending') {
        ordered = [...uniqueSteps].reverse();
    } else if (prArpMode === 'both') {
        ordered = Math.random() < 0.5 ? [...uniqueSteps] : [...uniqueSteps].reverse();
    } else {
        // ascending (default)
        ordered = [...uniqueSteps];
    }

    // Spread across columns starting at startCol
    return ordered.map((step, i) => ({ col: startCol + i, step }));
}

// How many columns does this entry need?
function prEntryColumnSpan(entry, asArp) {
    if (!asArp) return 1;
    const ivs = entry.intervals || entry.expectedIntervals;
    // Count unique EDO steps
    const steps = new Set();
    for (const iv of ivs) {
        steps.add(jiRatioToEdoSteps(iv.num, iv.denom));
    }
    return Math.max(1, steps.size);
}

// Compute the allowed root range so the full chord fits within prSpawnOctaves
// centered on step 63
function prSpawnRange(entry) {
    const ivs = entry.intervals || entry.expectedIntervals;
    let minOffset = 0, maxOffset = 0;
    for (const iv of ivs) {
        const offset = jiRatioToEdoSteps(iv.num, iv.denom);
        if (offset < minOffset) minOffset = offset;
        if (offset > maxOffset) maxOffset = offset;
    }
    const halfRange = Math.floor(prSpawnOctaves * prEdo / 2);
    const center = 63;
    const lo = Math.max(0, center - halfRange - minOffset);
    const hi = Math.min(prNumKeys - 1, center + halfRange - maxOffset);
    return { lo, hi };
}

// Find a contiguous run of `span` free columns. Returns start col or -1.
function findFreeColumns(span) {
    const usedCols = new Set();
    for (const t of prTargets) {
        for (const c of t.cols) usedCols.add(c);
    }

    // Collect all valid start positions
    const candidates = [];
    for (let c = 0; c <= prBeatColumns - span; c++) {
        let free = true;
        for (let j = 0; j < span; j++) {
            if (usedCols.has(c + j)) { free = false; break; }
        }
        if (free) candidates.push(c);
    }
    if (candidates.length === 0) return -1;
    return candidates[Math.floor(Math.random() * candidates.length)];
}

function spawnPianoRollTarget() {
    if (!prActive || prCustomPool.length === 0) return;

    // Pick from chords, or chords + intervals if enabled
    const pool = prIncludeIntervals && prIntervalPool.length > 0
        ? prCustomPool.concat(prIntervalPool)
        : prCustomPool;
    const entry = pool[Math.floor(Math.random() * pool.length)];

    // Decide if this target is an arpeggio (roll the dice)
    const asArp = prArpMode !== 'off' && Math.random() < prArpChance;
    const span = prEntryColumnSpan(entry, asArp);

    const startCol = findFreeColumns(span);
    if (startCol === -1) {
        schedulePianoRollSpawn();
        return;
    }

    const { lo, hi } = prSpawnRange(entry);
    if (lo > hi) {
        schedulePianoRollSpawn();
        return;
    }

    let root;

    // If targets exist and we have pool intervals, offset from an existing target
    if (prTargets.length > 0 && prPoolIntervalSteps.length > 0) {
        const anchor = prTargets[Math.floor(Math.random() * prTargets.length)];
        // Use the lowest step of the anchor as its root
        const anchorRoot = Math.min(...anchor.ghostNotes.map(gn => gn.step));

        const shuffled = [...prPoolIntervalSteps].sort(() => Math.random() - 0.5);
        let found = false;
        for (const offset of shuffled) {
            const candidate = anchorRoot + offset;
            if (candidate >= lo && candidate <= hi) {
                root = candidate;
                found = true;
                break;
            }
        }
        if (!found) {
            root = lo + Math.floor(Math.random() * (hi - lo + 1));
        }
    } else {
        root = lo + Math.floor(Math.random() * (hi - lo + 1));
    }

    const ghostNotes = prBuildGhostNotes(entry, root, startCol, asArp);

    if (ghostNotes.length < 2) {
        schedulePianoRollSpawn();
        return;
    }

    // Verify all ghost note columns are in bounds
    if (ghostNotes.some(gn => gn.col < 0 || gn.col >= prBeatColumns)) {
        schedulePianoRollSpawn();
        return;
    }

    const id = ++prTargetIdCounter;
    const now = Date.now();

    const cols = new Set(ghostNotes.map(gn => gn.col));
    const color = PR_TARGET_COLORS[prColorIndex % PR_TARGET_COLORS.length];
    prColorIndex++;
    const target = {
        id,
        cols,
        name: entry.name,
        ghostNotes,
        placedKeys: new Set(),
        spawnTime: now,
        expiryTime: now + prFadeTime * 1000,
        timeoutId: setTimeout(() => expirePianoRollTarget(id), prFadeTime * 1000),
        isArp: asArp && span > 1,
        color
    };

    prTargets.push(target);
    renderPianoRollOverlays();
    schedulePianoRollSpawn();
}

function schedulePianoRollSpawn() {
    if (prSpawnTimeout) clearTimeout(prSpawnTimeout);
    const delay = Math.max(3000, prCurrentSpawnInterval * 1000);
    prSpawnTimeout = setTimeout(spawnPianoRollTarget, delay);
}

function expirePianoRollTarget(id) {
    const idx = prTargets.findIndex(t => t.id === id);
    if (idx === -1) return;

    if (prActiveEntryTargetId === id) prActiveEntryTargetId = null;

    const target = prTargets[idx];
    removePlacedNotesForTarget(target);

    prTargets.splice(idx, 1);
    prScore--;
    prCurrentSpawnInterval += prExpirePenalty;
    updatePianoRollScoreDisplay();
    updatePianoRollSpawnDisplay();
    renderPianoRollOverlays();
}

function completeTarget(id) {
    const idx = prTargets.findIndex(t => t.id === id);
    if (idx === -1) return;

    if (prActiveEntryTargetId === id) prActiveEntryTargetId = null;

    const target = prTargets[idx];
    clearTimeout(target.timeoutId);
    removePlacedNotesForTarget(target);

    prTargets.splice(idx, 1);
    prScore++;
    playSound('correct');
    updatePianoRollScoreDisplay();

    // Board clear bonus
    if (prTargets.length === 0) {
        prCurrentSpawnInterval *= 0.9;
        playSound('board-clear');
    }

    updatePianoRollSpawnDisplay();
    renderPianoRollOverlays();
}

function removeTarget(id, isMistake) {
    const idx = prTargets.findIndex(t => t.id === id);
    if (idx === -1) return;

    if (prActiveEntryTargetId === id) prActiveEntryTargetId = null;

    const target = prTargets[idx];
    clearTimeout(target.timeoutId);
    removePlacedNotesForTarget(target);

    prTargets.splice(idx, 1);
    prScore--;
    prCurrentSpawnInterval += isMistake ? prMistakePenalty : prExpirePenalty;
    updatePianoRollScoreDisplay();
    updatePianoRollSpawnDisplay();
    renderPianoRollOverlays();
}

function removePlacedNotesForTarget(target) {
    for (const [key, note] of prPlacedNotes) {
        if (target.cols.has(note.col)) {
            prPlacedNotes.delete(key);
        }
    }
}

// ===== GAME LIFECYCLE =====

function startPianoRollGame() {
    // Read settings from DOM
    const edoInput = document.getElementById('pianoroll-edo-input');
    const colsInput = document.getElementById('pianoroll-columns-input');
    const fadeInput = document.getElementById('pianoroll-fade-time-input');
    const spawnInput = document.getElementById('pianoroll-spawn-interval-input');
    const mistakeCheck = document.getElementById('pianoroll-mistake-expires-checkbox');
    const mistakePenInput = document.getElementById('pianoroll-mistake-penalty-input');
    const expirePenInput = document.getElementById('pianoroll-expire-penalty-input');
    const octavesInput = document.getElementById('pianoroll-spawn-octaves-input');
    const includeIntervalsCheck = document.getElementById('pianoroll-include-intervals-checkbox');
    const arpSelect = document.getElementById('pianoroll-arp-mode-select');
    const arpChanceInput = document.getElementById('pianoroll-arp-chance-input');

    prEdo = edoInput ? parseInt(edoInput.value) || 12 : 12;
    prBeatColumns = colsInput ? parseInt(colsInput.value) || 12 : 12;
    prFadeTime = fadeInput ? parseInt(fadeInput.value) || 15 : 15;
    prSpawnInterval = spawnInput ? parseInt(spawnInput.value) || 10 : 10;
    prMistakeExpires = mistakeCheck ? mistakeCheck.checked : false;
    prMistakePenalty = mistakePenInput ? parseFloat(mistakePenInput.value) || 0.2 : 0.2;
    prExpirePenalty = expirePenInput ? parseFloat(expirePenInput.value) || 0.5 : 0.5;
    prSpawnOctaves = octavesInput ? parseInt(octavesInput.value) || 2 : 2;
    prIncludeIntervals = includeIntervalsCheck ? includeIntervalsCheck.checked : false;
    prArpMode = arpSelect ? arpSelect.value : 'off';
    prArpChance = arpChanceInput ? parseFloat(arpChanceInput.value) / 100 : 0.3;
    const cursorLabelCheck = document.getElementById('pianoroll-cursor-label-checkbox');
    prShowCursorLabel = cursorLabelCheck ? cursorLabelCheck.checked : true;
    const primeLimitSelect = document.getElementById('pianoroll-prime-limit-select');
    prLabelPrimeLimit = primeLimitSelect ? parseInt(primeLimitSelect.value) || 13 : 13;

    // Validate pool
    validatePianoRollCustomChords();
    if (prCustomPool.length === 0) {
        alert('No chords in pool. Add chords first.');
        return;
    }

    // Build the set of EDO-step intervals derived from the chord pool
    prBuildPoolIntervals();

    // Build reverse lookup for cursor label
    prStepToRatio = prBuildStepToRatioMap();

    // Reset state
    prActive = true;
    prScore = 0;
    prStartTime = Date.now();
    prTargetIdCounter = 0;
    prColorIndex = 0;
    prCurrentSpawnInterval = prSpawnInterval;
    prTargets = [];
    prPlacedNotes = new Map();
    prActiveEntryTargetId = null;
    prCursorStep = 63;
    prCursorCol = Math.floor(prBeatColumns / 2);
    prSavePointStep = 63;

    showPanel('pianoroll-game-panel');

    renderPianoRollGrid();
    setupPianoRollZoom();
    renderPianoRollOverlays();
    scrollToCursor();

    updatePianoRollScoreDisplay();
    updatePianoRollSpawnDisplay();

    // Start timer
    prTimerInterval = setInterval(updatePianoRollTimer, 100);

    // Spawn first target immediately
    spawnPianoRollTarget();

    // Start animation loop
    animatePianoRollTargets();
}

function endPianoRollGame() {
    prActive = false;

    if (prTimerInterval) { clearInterval(prTimerInterval); prTimerInterval = null; }
    if (prSpawnTimeout) { clearTimeout(prSpawnTimeout); prSpawnTimeout = null; }
    if (prAnimFrame) { cancelAnimationFrame(prAnimFrame); prAnimFrame = null; }

    // Clear target timeouts
    for (const target of prTargets) {
        clearTimeout(target.timeoutId);
    }
    prTargets = [];
    prPlacedNotes = new Map();

    showPanel('pianoroll-mode-panel');
}

// ===== DISPLAY UPDATES =====

function updatePianoRollScoreDisplay() {
    const el = document.getElementById('pianoroll-score');
    if (el) el.textContent = prScore;
}

function updatePianoRollSpawnDisplay() {
    const el = document.getElementById('pianoroll-spawn-display');
    if (el) el.textContent = prCurrentSpawnInterval.toFixed(1) + 's';
}

function updatePianoRollTimer() {
    const el = document.getElementById('pianoroll-timer');
    if (el && prStartTime) {
        el.textContent = formatElapsedTime(prStartTime);
    }
}

// ===== ANIMATION =====

function animatePianoRollTargets() {
    if (!prActive) return;

    const now = Date.now();

    document.querySelectorAll('.pr-col-header').forEach(header => {
        const targetId = parseInt(header.dataset.targetId);
        const target = prTargets.find(t => t.id === targetId);
        if (!target) return;

        const remaining = (target.expiryTime - now) / 1000;
        const total = prFadeTime;
        const ratio = Math.max(0, Math.min(1, remaining / total));

        const r = Math.round(255 * (1 - ratio));
        const g = Math.round(200 * ratio);
        header.style.color = `rgb(${r}, ${g}, 50)`;
        header.textContent = target.name + ' ' + Math.ceil(remaining) + 's';
    });

    prAnimFrame = requestAnimationFrame(animatePianoRollTargets);
}

// ===== CHORD POOL MANAGEMENT =====

function validatePianoRollCustomChords() {
    const textarea = document.getElementById('pianoroll-custom-chords-input');
    const status = document.getElementById('pianoroll-custom-parse-status');
    if (!textarea || !status) return;

    const { chords, errors } = parseCustomChordsText(textarea.value);
    prCustomPool = chords;

    if (chords.length === 0 && errors.length === 0) {
        status.textContent = '';
        status.className = 'custom-parse-status';
    } else if (errors.length > 0) {
        status.textContent = `${chords.length} chord(s) parsed. Parse errors: ${errors.join('; ')}`;
        status.className = 'custom-parse-status parse-error';
    } else {
        status.textContent = `${chords.length} chord(s) ready: ${chords.map(c => c.name).join(', ')}`;
        status.className = 'custom-parse-status parse-ok';
    }
}

function renderPianoRollLevelCards() {
    const container = document.getElementById('pianoroll-level-cards');
    if (!container) return;
    container.innerHTML = '';

    ONSLAUGHT_LEVELS.forEach((lvl, idx) => {
        const card = document.createElement('div');
        card.className = 'onslaught-level-card';
        card.dataset.level = idx + 1;

        card.innerHTML = `
            <div class="level-card-header">
                <span class="level-card-number">+ Add</span>
                <span class="level-card-title">${lvl.name}</span>
            </div>
            <div class="level-card-desc">${lvl.description}</div>
            <div class="level-card-pills"></div>
        `;

        const pillsContainer = card.querySelector('.level-card-pills');
        const seen = new Set();
        lvl.lines.forEach(line => {
            const m = line.match(/:\s*(.+)$/);
            const name = m ? m[1].trim() : null;
            if (!name || seen.has(name)) return;
            seen.add(name);
            const pill = document.createElement('span');
            pill.className = 'chord-pill chord-pill-clickable';
            pill.textContent = name;
            pill.addEventListener('click', e => {
                e.stopPropagation();
                const textarea = document.getElementById('pianoroll-custom-chords-input');
                if (!textarea) return;
                const existing = textarea.value.trim();
                textarea.value = existing ? existing + '\n' + line : line;
                validatePianoRollCustomChords();
            });
            pillsContainer.appendChild(pill);
        });

        card.addEventListener('click', () => {
            loadPianoRollLevelIntoTextarea(idx);
        });

        container.appendChild(card);
    });
}

function loadPianoRollLevelIntoTextarea(levelIdx) {
    const textarea = document.getElementById('pianoroll-custom-chords-input');
    if (!textarea || levelIdx < 0 || levelIdx >= ONSLAUGHT_LEVELS.length) return;
    const existing = textarea.value.trim();
    const toAdd = ONSLAUGHT_LEVELS[levelIdx].lines.join('\n');
    textarea.value = existing ? existing + '\n' + toAdd : toAdd;
    validatePianoRollCustomChords();
}
