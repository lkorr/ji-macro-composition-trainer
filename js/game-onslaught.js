// ============================================================
// ONSLAUGHT MODE
// ============================================================

// Each card: { id, chordKey, name, expectedIntervals, progress, composition, spawnTime, expiryTime, timeoutId, animFrameId }
let onslaughtCards = [];
let onslaughtFocusedCardId = null;
let onslaughtScore = 0;
let onslaughtActive = false;
let onslaughtStartTime = null;
let onslaughtTimerInterval = null;
let onslaughtSpawnTimeout = null;
let onslaughtFadeTime = 15; // seconds per card
let onslaughtSpawnInterval = 10; // seconds between spawns (decreases over time)
let onslaughtCardIdCounter = 0;
let onslaughtAnimFrame = null;

// ===== HELPERS =====

function getOnslaughtChordPool() {
    // Use CG active chords (same adaptive pool as chord+grid)
    return cgActiveChords.length > 0 ? cgActiveChords : cgAllChordsSorted.slice(0, 1);
}

function pickOnslaughtChord() {
    const pool = getOnslaughtChordPool();
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
}

function currentSpawnInterval() {
    if (!onslaughtStartTime) return onslaughtSpawnInterval * 1000;
    const elapsed = (Date.now() - onslaughtStartTime) / 1000;
    // Halve the interval every 60 seconds, minimum 3 seconds
    const factor = Math.pow(0.5, elapsed / 60);
    return Math.max(3000, onslaughtSpawnInterval * 1000 * factor);
}

// ===== CARD DOM =====

function buildCardHTML(card) {
    const intervalsHTML = card.expectedIntervals.map(i =>
        `<span class="chord-interval onslaught-interval" data-interval="${i.num}/${i.denom}">${i.num}/${i.denom}</span>`
    ).join(', ');

    const pianoRollHTML = buildOnslaughtPianoRoll(card);

    return `
        <div class="onslaught-card" id="ocard-${card.id}" data-card-id="${card.id}">
            <div class="onslaught-card-header">
                <span class="onslaught-chord-name">${card.name}</span>
                <div class="onslaught-timer-bar-wrap">
                    <div class="onslaught-timer-bar" id="obar-${card.id}"></div>
                </div>
            </div>
            <div class="onslaught-card-body">
                <div class="onslaught-piano-roll" id="oproll-${card.id}">${pianoRollHTML}</div>
                <div class="onslaught-intervals" id="oints-${card.id}">${intervalsHTML}</div>
                <div class="onslaught-composition" id="ocomp-${card.id}">Press keys to build interval...</div>
            </div>
        </div>
    `;
}

function buildOnslaughtPianoRoll(card) {
    const intervals = card.expectedIntervals;
    if (!intervals || intervals.length === 0) return '';

    const positions = intervals.map(i => Math.log2(i.num / i.denom));
    const minPos = Math.min(...positions);
    const maxPos = Math.max(...positions);
    const padding = 0.25;
    const paddedMin = minPos - padding;
    const paddedMax = maxPos + padding;
    const totalRange = paddedMax - paddedMin;

    const pixelsPerOctave = 80;
    const height = Math.max(40, totalRange * pixelsPerOctave);
    const arrowWidth = 25;
    const noteWidth = 80;
    const barHeight = 10;
    const width = arrowWidth + noteWidth + 5;

    const enteredSet = new Set(card.progress.map(i => `${i.num}/${i.denom}`));
    const arrowValue = multiplyFractions(card.composition);

    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;

    intervals.forEach((interval, idx) => {
        const pos = positions[idx];
        const norm = (pos - paddedMin) / totalRange;
        const y = height - (norm * height) - barHeight / 2;
        const isEntered = enteredSet.has(`${interval.num}/${interval.denom}`);
        const color = isEntered ? '#4caf50' : '#999';
        svg += `<rect x="${arrowWidth}" y="${y}" width="${noteWidth}" height="${barHeight}" fill="${color}" stroke="#000" stroke-width="1" rx="2"/>`;
    });

    if (arrowValue) {
        const pos = Math.log2(arrowValue.num / arrowValue.denom);
        const norm = (pos - paddedMin) / totalRange;
        const ay = height - (norm * height);
        svg += `<path d="M ${arrowWidth - 5} ${ay} L 5 ${ay - 6} L 5 ${ay + 6} Z" fill="#4caf50"/>`;
    }

    svg += '</svg>';
    return svg;
}

// ===== SPAWN / EXPIRE =====

function spawnOnslaughtCard() {
    if (!onslaughtActive) return;

    const entry = pickOnslaughtChord();
    if (!entry) return;

    const id = ++onslaughtCardIdCounter;
    const now = Date.now();
    const expiryMs = onslaughtFadeTime * 1000;

    const card = {
        id,
        chordKey: entry.key,
        name: entry.name,
        expectedIntervals: entry.expectedIntervals,
        progress: [],
        composition: [],
        spawnTime: now,
        expiryTime: now + expiryMs,
        timeoutId: setTimeout(() => expireOnslaughtCard(id), expiryMs)
    };

    onslaughtCards.push(card);

    const container = document.getElementById('onslaught-cards-container');
    if (container) {
        const div = document.createElement('div');
        div.innerHTML = buildCardHTML(card);
        container.appendChild(div.firstElementChild);

        // Click to focus
        document.getElementById(`ocard-${id}`).addEventListener('click', () => focusOnslaughtCard(id));
    }

    // Auto-focus if nothing focused
    if (!onslaughtFocusedCardId) focusOnslaughtCard(id);

    scheduleNextSpawn();
}

function scheduleNextSpawn() {
    clearTimeout(onslaughtSpawnTimeout);
    const delay = currentSpawnInterval();
    onslaughtSpawnTimeout = setTimeout(spawnOnslaughtCard, delay);
}

function expireOnslaughtCard(id) {
    const idx = onslaughtCards.findIndex(c => c.id === id);
    if (idx === -1) return;
    onslaughtCards.splice(idx, 1);

    const el = document.getElementById(`ocard-${id}`);
    if (el) {
        el.classList.add('onslaught-card-expired');
        setTimeout(() => el.remove(), 400);
    }

    onslaughtScore = Math.max(0, onslaughtScore - 1);
    updateOnslaughtScore();

    if (onslaughtFocusedCardId === id) {
        onslaughtFocusedCardId = null;
        if (onslaughtCards.length > 0) focusOnslaughtCard(onslaughtCards[onslaughtCards.length - 1].id);
    }
}

function removeOnslaughtCard(id) {
    clearTimeout(onslaughtCards.find(c => c.id === id)?.timeoutId);
    const idx = onslaughtCards.findIndex(c => c.id === id);
    if (idx !== -1) onslaughtCards.splice(idx, 1);

    const el = document.getElementById(`ocard-${id}`);
    if (el) {
        el.classList.add('onslaught-card-complete');
        setTimeout(() => el.remove(), 500);
    }

    if (onslaughtFocusedCardId === id) {
        onslaughtFocusedCardId = null;
        if (onslaughtCards.length > 0) focusOnslaughtCard(onslaughtCards[onslaughtCards.length - 1].id);
    }
}

// ===== FOCUS =====

function focusOnslaughtCard(id) {
    // Unfocus previous
    if (onslaughtFocusedCardId !== null) {
        const prev = document.getElementById(`ocard-${onslaughtFocusedCardId}`);
        if (prev) prev.classList.remove('onslaught-card-focused');
    }
    onslaughtFocusedCardId = id;
    const el = document.getElementById(`ocard-${id}`);
    if (el) el.classList.add('onslaught-card-focused');
}

// ===== KEYPRESS =====

function handleOnslaughtKeyPress(event) {
    const key = event.key.toLowerCase();
    if (!onslaughtFocusedCardId) return;

    const card = onslaughtCards.find(c => c.id === onslaughtFocusedCardId);
    if (!card) return;

    // Backspace - reset this card
    if (key === 'backspace') {
        event.preventDefault();
        card.composition = [];
        card.progress = [];
        updateOnslaughtCardUI(card);
        return;
    }

    // Submit
    if (key === submitKey.toLowerCase()) {
        event.preventDefault();
        const product = multiplyFractions(card.composition);
        const intervalKey = `${product.num}/${product.denom}`;
        const expectedSet = new Set(card.expectedIntervals.map(i => `${i.num}/${i.denom}`));
        const alreadyEnteredSet = new Set(card.progress.map(i => `${i.num}/${i.denom}`));

        if (expectedSet.has(intervalKey) && !alreadyEnteredSet.has(intervalKey)) {
            card.progress.push(product);
            playSingleTone(product.num, product.denom);
            card.composition = [];
            updateOnslaughtCardUI(card);

            if (card.progress.length === card.expectedIntervals.length) {
                onslaughtScore += 1;
                updateOnslaughtScore();
                removeOnslaughtCard(card.id);
            }
        } else {
            // Wrong
            playSingleTone(product.num, product.denom);
            card.composition = [];
            card.progress = [];
            updateOnslaughtCardUI(card);
            const el = document.getElementById(`ocard-${card.id}`);
            if (el) {
                el.classList.add('onslaught-card-wrong');
                setTimeout(() => el.classList.remove('onslaught-card-wrong'), 400);
            }
        }
        return;
    }

    // Add to composition
    if (allMappings[key]) {
        event.preventDefault();
        card.composition.push(allMappings[key]);
        updateOnslaughtCardUI(card);
    }
}

// ===== UI UPDATES =====

function updateOnslaughtCardUI(card) {
    // Update composition display
    const compEl = document.getElementById(`ocomp-${card.id}`);
    if (compEl) {
        if (card.composition.length === 0) {
            compEl.textContent = 'Press keys to build interval...';
            compEl.style.color = '#999';
        } else {
            const product = multiplyFractions(card.composition);
            if (card.composition.length === 1) {
                compEl.innerHTML = `<strong>${product.num}/${product.denom}</strong>`;
            } else {
                const parts = card.composition.map(c => `${c.num}/${c.denom}`).join(' × ');
                compEl.innerHTML = `${parts} = <strong>${product.num}/${product.denom}</strong>`;
            }
            compEl.style.color = '#333';
        }
    }

    // Update interval highlights
    const enteredSet = new Set(card.progress.map(i => `${i.num}/${i.denom}`));
    const spans = document.querySelectorAll(`#oints-${card.id} .onslaught-interval`);
    spans.forEach(span => {
        const key = span.dataset.interval;
        span.classList.toggle('interval-correct', enteredSet.has(key));
    });

    // Update piano roll
    const rollEl = document.getElementById(`oproll-${card.id}`);
    if (rollEl) rollEl.innerHTML = buildOnslaughtPianoRoll(card);
}

function updateOnslaughtScore() {
    const el = document.getElementById('onslaught-score');
    if (el) el.textContent = onslaughtScore;
}

// Animate countdown bars
function animateOnslaughtBars() {
    if (!onslaughtActive) return;
    const now = Date.now();
    for (const card of onslaughtCards) {
        const bar = document.getElementById(`obar-${card.id}`);
        if (!bar) continue;
        const remaining = Math.max(0, card.expiryTime - now);
        const pct = (remaining / (onslaughtFadeTime * 1000)) * 100;
        bar.style.width = `${pct}%`;
        // Colour shifts red as time runs out
        const hue = Math.round(pct * 1.2); // 120=green → 0=red
        bar.style.background = `hsl(${hue}, 80%, 45%)`;
    }
    onslaughtAnimFrame = requestAnimationFrame(animateOnslaughtBars);
}

function updateOnslaughtTimer() {
    if (!onslaughtActive || !onslaughtStartTime) return;
    const el = document.getElementById('onslaught-timer');
    if (el) el.textContent = formatElapsedTime(onslaughtStartTime);
}

// ===== START / END =====

function startOnslaughtGame() {
    if (cgActiveChords.length === 0) {
        initializeCGAdaptiveMode();
    }

    onslaughtActive = true;
    onslaughtCards = [];
    onslaughtFocusedCardId = null;
    onslaughtScore = 0;
    onslaughtCardIdCounter = 0;
    onslaughtStartTime = Date.now();

    // Read settings
    const fadeInput = document.getElementById('onslaught-fade-time-input');
    if (fadeInput) onslaughtFadeTime = parseFloat(fadeInput.value) || 15;
    const spawnInput = document.getElementById('onslaught-spawn-interval-input');
    if (spawnInput) onslaughtSpawnInterval = parseFloat(spawnInput.value) || 10;

    const container = document.getElementById('onslaught-cards-container');
    if (container) container.innerHTML = '';

    updateOnslaughtScore();

    showPanel('onslaught-game-panel');

    // Spawn first card immediately, then schedule
    spawnOnslaughtCard();

    onslaughtTimerInterval = setInterval(updateOnslaughtTimer, 100);
    onslaughtAnimFrame = requestAnimationFrame(animateOnslaughtBars);
}

function endOnslaughtGame() {
    onslaughtActive = false;

    clearTimeout(onslaughtSpawnTimeout);
    clearInterval(onslaughtTimerInterval);
    if (onslaughtAnimFrame) cancelAnimationFrame(onslaughtAnimFrame);

    for (const card of onslaughtCards) clearTimeout(card.timeoutId);
    onslaughtCards = [];
    onslaughtFocusedCardId = null;

    showPanel('onslaught-mode-panel');
}
