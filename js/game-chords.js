// ============================================================
// ADAPTIVE CHORD MODE + SHARED CHORD GENERICS
// ============================================================

// ===== GENERIC CHORD ADAPTIVE PERSISTENCE =====

// Generic: initialize chord adaptive mode
function initializeChordAdaptive(p) {
    const sorted = initializeChordsSorted(p.expandFlag, p.inversionsFlag);
    p.setAllSorted(sorted);

    const stats = {};
    for (const chord of sorted) {
        stats[chord.key] = { attempts: 0, totalTime: 0, recentTimes: [], mastered: false, lastSeenQuestion: -1, chord };
    }
    p.setStats(stats);

    const firstChords = sorted.length > 0 ? [sorted[0]] : [];
    p.setActive(firstChords);
    p.setDrillCount(0);
    p.setNewChord(null);
    p.setTutorialActive(true);
    p.setTutorialIndex(0);
    p.setTutorialSeq(sorted.length > 0 ? [sorted[0].key] : ['4:5:6']);
    p.setLevel(countBaseChords(firstChords));
    p.saveFunc();
}

// Generic: load chord adaptive progress from localStorage
function loadChordAdaptive(p) {
    const saved = localStorage.getItem(p.storageKey);
    if (!saved) return false;
    try {
        const data = JSON.parse(saved);
        const savedExpandFlag = data[p.savedExpandFlagKey] || false;
        const sorted = initializeChordsSorted(p.expandFlag, p.inversionsFlag);
        p.setAllSorted(sorted);
        p.setTutorialSeq(sorted.length > 0 ? [sorted[0].key] : ['4:5:6']);

        let stats, active, newChord;
        if (savedExpandFlag !== p.expandFlag) {
            // Migrate keys
            const migratedStats = {};
            const oldStats = data[p.savedStatsKey] || {};
            if (p.expandFlag && !savedExpandFlag) {
                for (const k in oldStats) migratedStats[k + '_sp0'] = oldStats[k];
            } else {
                for (const k in oldStats) { const nk = k.replace(/_sp\d+$/, ''); if (!migratedStats[nk]) migratedStats[nk] = oldStats[k]; }
            }
            stats = migratedStats;

            const migratedActive = [];
            for (const sc of (data[p.savedActiveKey] || [])) {
                const ok = sc.key || sc;
                const nk = (p.expandFlag && !savedExpandFlag) ? ok + '_sp0' : ok.replace(/_sp\d+$/, '');
                const c = sorted.find(x => x.key === nk);
                if (c && !migratedActive.find(x => x.key === c.key)) migratedActive.push(c);
            }
            active = migratedActive;

            let onc = data[p.savedNewChordKey] || null;
            if (onc) onc = (p.expandFlag && !savedExpandFlag) ? onc + '_sp0' : onc.replace(/_sp\d+$/, '');
            newChord = onc;
        } else {
            stats = data[p.savedStatsKey] || {};
            active = data[p.savedActiveKey] || [];
            newChord = data[p.savedNewChordKey] || null;
        }

        p.setStats(stats);
        p.setLevel(data[p.savedLevelKey] || 1);
        p.setTutorialIndex(data[p.savedTutIdxKey] !== undefined ? data[p.savedTutIdxKey] : 0);
        p.setTutorialActive(data[p.savedTutActiveKey] !== undefined ? data[p.savedTutActiveKey] : true);
        p.setDrillCount(data[p.savedDrillCountKey] || 0);
        p.setNewChord(newChord);

        // Restore chord references in stats
        const currentStats = p.getStats();
        for (const key in currentStats) {
            const c = sorted.find(x => x.key === key);
            if (c) currentStats[key].chord = c;
        }

        // Restore active with full chord objects
        if (!Array.isArray(active[0]?.intervals)) {
            active = active.map(sc => { const k = sc.key || sc; return sorted.find(x => x.key === k); }).filter(Boolean);
        }
        p.setActive(active);
        p.setDisabled(new Set(data[p.savedDisabledKey] || []));
        p.setLevel(countBaseChords(active));
        return true;
    } catch (e) {
        console.error('Failed to load chord progress:', e);
        return false;
    }
}

// Generic: resume from specific chord level
function resumeFromChordLevelGeneric(targetLevel, p) {
    if (targetLevel < 1) { alert('Level must be 1 or higher'); return; }
    const sorted = initializeChordsSorted(p.expandFlag, p.inversionsFlag);
    p.setAllSorted(sorted);

    let numBaseChords = targetLevel;
    if (numBaseChords > TOTAL_BASE_CHORDS) {
        alert(`Maximum is ${TOTAL_BASE_CHORDS} base chords. Setting to maximum.`);
        numBaseChords = TOTAL_BASE_CHORDS;
    }

    const stats = {};
    for (const chord of sorted) {
        stats[chord.key] = { attempts: 0, totalTime: 0, recentTimes: [], mastered: false, lastSeenQuestion: -1, chord };
    }

    const variantsToUnlock = getAllVariantsForFirstNBaseChords(numBaseChords, sorted);
    const active = [];
    for (let i = 0; i < variantsToUnlock.length; i++) {
        const chord = variantsToUnlock[i];
        active.push(chord);
        if (stats[chord.key]) {
            if (i < variantsToUnlock.length - 2) {
                stats[chord.key].mastered = true;
                stats[chord.key].attempts = 10;
                stats[chord.key].totalTime = 10;
                stats[chord.key].recentTimes = [1, 1, 1, 1, 1];
            } else {
                stats[chord.key].attempts = 3;
                stats[chord.key].totalTime = 12;
                stats[chord.key].recentTimes = [4, 4, 4];
            }
        }
    }

    p.setStats(stats);
    p.setActive(active);
    p.setDrillCount(0);
    p.setNewChord(null);
    p.setTutorialIndex(9999);
    p.setTutorialActive(false);
    const level = countBaseChords(active);
    p.setLevel(level);
    p.saveFunc();
    p.updateStatsFunc();
    p.updateLevelFunc();
    alert(`Level ${level} — ${active.length} chord variant${active.length !== 1 ? 's' : ''} unlocked.`);
}

// ===== CHORD MODE PERSISTENCE (delegates to generic) =====

function _chordModeParams() {
    return {
        expandFlag: randomStartingNote, inversionsFlag: includeInversions,
        setAllSorted: v => { allChordsSorted = v; },
        setStats: v => { chordStats = v; }, getStats: () => chordStats,
        setActive: v => { activeChords = v; },
        setDrillCount: v => { newChordDrillCount = v; },
        setNewChord: v => { currentNewChord = v; },
        setTutorialActive: v => { chordTutorialActive = v; },
        setTutorialIndex: v => { chordTutorialIndex = v; },
        setTutorialSeq: v => { chordTutorialSequence = v; },
        setLevel: v => { adaptiveChordLevel = v; },
        setDisabled: v => { disabledChords = v; },
        saveFunc: () => saveAdaptiveChordProgress(),
        updateStatsFunc: updateAdaptiveChordStats,
        updateLevelFunc: updateAdaptiveChordLevelDisplay
    };
}

function initializeAdaptiveChordMode() {
    initializeChordAdaptive(_chordModeParams());
}

function loadAdaptiveChordProgress() {
    return loadChordAdaptive({
        ..._chordModeParams(),
        storageKey: 'ji_adaptive_chord_progress',
        savedExpandFlagKey: 'randomStartingNote',
        savedStatsKey: 'chordStats', savedActiveKey: 'activeChords',
        savedLevelKey: 'adaptiveChordLevel', savedTutIdxKey: 'chordTutorialIndex',
        savedTutActiveKey: 'chordTutorialActive', savedDrillCountKey: 'newChordDrillCount',
        savedNewChordKey: 'currentNewChord', savedDisabledKey: 'disabledChords'
    });
}

function saveAdaptiveChordProgress() {
    localStorage.setItem('ji_adaptive_chord_progress', JSON.stringify({
        chordStats, activeChords: activeChords.map(c => ({ key: c.key })),
        adaptiveChordLevel, chordTutorialIndex, chordTutorialActive,
        newChordDrillCount, currentNewChord, randomStartingNote, includeInversions,
        disabledChords: [...disabledChords]
    }));
}

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

function resumeFromChordLevel(targetLevel) {
    resumeFromChordLevelGeneric(targetLevel, _chordModeParams());
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

// Select weighted random chord from a pool
function selectWeightedRandomChordFrom(opts) {
    const enabledChords = opts.chords.filter(c => !opts.disabledSet.has(c.key));
    if (enabledChords.length === 0) return null;

    const n = enabledChords.length;
    const guaranteedWindow = 3 * n;

    const mustAppearChords = [];
    for (const chord of enabledChords) {
        const stats = opts.statsObj[chord.key];
        if (stats) {
            const questionsSinceLastSeen = opts.questionCounter - stats.lastSeenQuestion;
            if (stats.lastSeenQuestion === -1 || questionsSinceLastSeen >= guaranteedWindow) {
                mustAppearChords.push(chord);
            }
        }
    }

    if (mustAppearChords.length > 0) {
        return mustAppearChords[Math.floor(Math.random() * mustAppearChords.length)];
    }

    const chordWeights = [];
    let totalWeight = 0;
    const threshold = opts.getMasteryThreshold();
    const nmRate = opts.getNonMasteredRate();
    const window = opts.getRollingWindow();

    let masteredCount = 0;
    let nonMasteredCount = 0;
    for (const chord of enabledChords) {
        const stats = opts.statsObj[chord.key];
        if (stats && stats.mastered) masteredCount++;
        else nonMasteredCount++;
    }

    const masteredBaseWeight = nonMasteredCount > 0 ? (100 - nmRate) / masteredCount : 1;
    const nonMasteredBaseWeight = nonMasteredCount > 0 ? nmRate / nonMasteredCount : 1;

    for (const chord of enabledChords) {
        const stats = opts.statsObj[chord.key];
        let weight;
        if (stats && stats.mastered) {
            weight = masteredBaseWeight;
        } else if (stats && stats.recentTimes.length > 0) {
            const recentTimesWindow = stats.recentTimes.slice(-window);
            const avgTime = recentTimesWindow.reduce((a, b) => a + b, 0) / recentTimesWindow.length;
            weight = nonMasteredBaseWeight * (1 + avgTime / threshold);
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

function selectWeightedRandomChord() {
    return selectWeightedRandomChordFrom({
        chords: activeChords,
        disabledSet: disabledChords,
        statsObj: chordStats,
        questionCounter: globalChordQuestionCounter,
        getMasteryThreshold: getCurrentMasteryThreshold,
        getNonMasteredRate: getCurrentNonMasteredRate,
        getRollingWindow: getCurrentRollingAverageWindow
    });
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

    // Reset composition — player must enter all intervals including 1/1
    currentComposition = [];
    chordProgress = [];
    updateCompositionDisplay();

    // Render piano roll with nothing placed yet
    renderChordPianoRoll(harmonicNotation, chordProgress, { num: 1, denom: 1 });

    // Clear feedback
    clearFeedback(feedbackEl);

    // Start question timer
    questionStartTime = Date.now();

    // Play chord audio
    playChordAudio(expectedIntervals);
}

// Check mastery and unlock next chord (generic)
function checkAndUnlockNextChordGeneric(opts) {
    const threshold = opts.getMasteryThreshold();
    const minAttempts = opts.getMinAttempts();
    const window = opts.getRollingWindow();

    let allMastered = true;
    for (const chord of opts.activeChords) {
        if (opts.disabledSet.has(chord.key)) continue;
        const stats = opts.statsObj[chord.key];
        if (!stats) continue;

        const recentTimesWindow = stats.recentTimes.slice(-window);
        const avgRecent = recentTimesWindow.length > 0
            ? recentTimesWindow.reduce((a, b) => a + b, 0) / recentTimesWindow.length
            : 999;

        const isMastered = stats.attempts >= minAttempts && avgRecent < threshold;
        stats.mastered = isMastered;
        if (!isMastered) allMastered = false;
    }

    if (allMastered && opts.activeChords.length < opts.allSorted.length && !opts.getCurrentNewChord()) {
        const activeKeys = new Set(opts.activeChords.map(c => c.key));
        const nextChord = opts.allSorted.find(c => !activeKeys.has(c.key));

        if (nextChord) {
            opts.setCurrentNewChord(nextChord.key);
            opts.resetDrillCount();

            const nextBaseKey = getBaseChordForGrouping(nextChord.key);
            const currentBases = getUniqueBaseChords(opts.activeChords);
            const isNewBaseChord = !currentBases.has(nextBaseKey);

            if (isNewBaseChord) {
                opts.setLevel(currentBases.size + 1);
            }
            opts.updateLevelDisplay();

            const fb = opts.feedbackEl;
            if (fb) {
                const posInfo = nextChord.positionLabel ? ` ${nextChord.positionLabel}` : '';
                if (isNewBaseChord) {
                    const baseName = CHORD_NAMES[nextBaseKey] || nextBaseKey;
                    fb.innerHTML = `<strong>🎉 Level ${opts.getLevel()}! New chord unlocked: ${baseName}!</strong><br>${nextChord.name}${posInfo} (${nextChord.chordKey})<br><em>Practice this chord ${opts.drillTarget} times before it's added to the mix</em>`;
                } else {
                    fb.innerHTML = `<strong>New variant unlocked: ${nextChord.name}${posInfo}!</strong><br>(${nextChord.chordKey})<br><em>Practice ${opts.drillTarget} times before it's added to the mix</em>`;
                }
                fb.className = 'feedback';
                fb.style.background = '#d1ecf1';
                fb.style.color = '#0c5460';
            }

            opts.saveFunc();
        }
    }

    if (opts.periodicCounter() % 5 === 0) {
        opts.saveFunc();
    }
}

function checkAndUnlockNextChord() {
    checkAndUnlockNextChordGeneric({
        activeChords, allSorted: allChordsSorted, statsObj: chordStats, disabledSet: disabledChords,
        getMasteryThreshold: getCurrentMasteryThreshold, getMinAttempts: getCurrentMinAttemptsForMastery,
        getRollingWindow: getCurrentRollingAverageWindow,
        getCurrentNewChord: () => currentNewChord, setCurrentNewChord: v => { currentNewChord = v; },
        resetDrillCount: () => { newChordDrillCount = 0; },
        getLevel: () => adaptiveChordLevel, setLevel: v => { adaptiveChordLevel = v; },
        updateLevelDisplay: updateGameChordLevelDisplay,
        feedbackEl, drillTarget: newChordDrillTarget,
        saveFunc: saveAdaptiveChordProgress, periodicCounter: () => questionCount
    });
}

function updateAdaptiveChordLevelDisplay() {
    updateLevelDisplayElements('adaptive-chord-level-number', 'adaptive-chord-level-detail', adaptiveChordLevel, activeChords);
}

function updateGameChordLevelDisplay() {
    updateLevelDisplayElements('game-level-number', 'game-level-detail', adaptiveChordLevel, activeChords);
}

function updateGameChordProgress() {
    updateGameChordProgressGeneric({
        containerId: 'game-interval-progress', statsElId: 'game-progress-stats',
        activeChords, allSorted: allChordsSorted, statsObj: chordStats,
        disabledSet: disabledChords, collapsedSet: collapsedChordGroups,
        getMasteryThreshold: getCurrentMasteryThreshold, getMinAttempts: getCurrentMinAttemptsForMastery,
        getRollingWindow: getCurrentRollingAverageWindow,
        saveFunc: saveAdaptiveChordProgress, updateFunc: updateGameChordProgress,
        currentNewChord: () => currentNewChord, drillCount: () => newChordDrillCount, drillTarget: newChordDrillTarget,
        dataMode: 'chord', guardFunc: () => gameMode === 'adaptive-chord'
    });
}

function updateAdaptiveChordStats() {
    updateChordStatsGeneric({
        statsElId: 'adaptive-chord-stats',
        activeChords, allSorted: allChordsSorted, statsObj: chordStats,
        disabledSet: disabledChords, collapsedSet: collapsedChordGroups,
        getMasteryThreshold: getCurrentMasteryThreshold, getMinAttempts: getCurrentMinAttemptsForMastery,
        getRollingWindow: getCurrentRollingAverageWindow,
        loadFunc: loadAdaptiveChordProgress, saveFunc: saveAdaptiveChordProgress,
        updateFunc: updateAdaptiveChordStats, updateLevelFunc: updateAdaptiveChordLevelDisplay,
        dataMode: 'chord'
    });
}

// Piano roll wrappers
function renderChordPianoRoll(chordKey, enteredIntervals = [], currentCompositionValue = null) {
    const intervals = currentExpectedIntervals.length > 0 ? currentExpectedIntervals : CHORD_TYPES[chordKey];
    renderPianoRollSVG({
        containerId: 'chord-piano-roll',
        intervals,
        enteredIntervals,
        arrowValue: currentCompositionValue
    });
}

function updateChordPianoRoll() {
    if (gameMode !== 'adaptive-chord') return;
    const currentValue = multiplyFractions(currentComposition);
    renderChordPianoRoll(currentChord, chordProgress, currentValue);
}

// ===== SHARED CHORD KEYPRESS HANDLER =====
// Handles chord building keypress for both chord mode and chord+grid mode.
// opts: {
//   event, key,
//   getExpectedIntervals, getComposition, setComposition, getProgress, setProgress,
//   feedbackEl, intervalSpansSelector,
//   onUpdateComposition, onUpdatePianoRoll,
//   onChordComplete(timeTaken), onWrongAnswer(expectedSet, alreadyEnteredSet)
// }
function handleChordKeypressGeneric(opts) {
    const { event, key } = opts;
    const expectedIntervals = opts.getExpectedIntervals();
    const fb = opts.feedbackEl;

    // Backspace - reset chord
    if (key === 'backspace') {
        event.preventDefault();
        opts.setComposition([]);
        opts.setProgress([]);
        opts.onUpdateComposition();
        opts.onUpdatePianoRoll();
        resetIntervalHighlightsInContainer(opts.intervalSpansSelector);
        clearFeedback(fb);
        return;
    }

    // Submit key - check interval
    if (key === submitKey.toLowerCase()) {
        event.preventDefault();

        const composition = opts.getComposition();
        const product = multiplyFractions(composition);
        const intervalKey = `${product.num}/${product.denom}`;

        const expectedSet = new Set(expectedIntervals.map(i => `${i.num}/${i.denom}`));
        const alreadyEnteredSet = new Set(opts.getProgress().map(i => `${i.num}/${i.denom}`));

        if (expectedSet.has(intervalKey) && !alreadyEnteredSet.has(intervalKey)) {
            // CORRECT interval
            const progress = opts.getProgress();
            progress.push(product);
            opts.setProgress(progress);

            markIntervalCorrectInContainer(intervalKey, opts.intervalSpansSelector);
            playSingleTone(product.num, product.denom);

            // Reset composition for next interval
            opts.setComposition([]);
            opts.onUpdateComposition();
            opts.onUpdatePianoRoll();

            // Check if chord is complete
            if (progress.length === expectedIntervals.length) {
                const timeTaken = (Date.now() - questionStartTime) / 1000;
                opts.onChordComplete(timeTaken);
            }
        } else {
            // WRONG interval
            playSingleTone(product.num, product.denom);

            opts.setComposition([]);
            opts.setProgress([]);
            opts.onUpdateComposition();
            opts.onUpdatePianoRoll();
            resetIntervalHighlightsInContainer(opts.intervalSpansSelector);

            opts.onWrongAnswer(expectedSet, alreadyEnteredSet);
        }
        return;
    }

    // Add to composition
    if (allMappings[key]) {
        event.preventDefault();
        opts.getComposition().push(allMappings[key]);
        opts.onUpdateComposition();
        opts.onUpdatePianoRoll();
    }
}

// Chord mode keypress handler (thin wrapper around generic)
function handleChordKeypress(e, key) {
    const expectedIntervals = currentExpectedIntervals.length > 0 ? currentExpectedIntervals : CHORD_TYPES[currentChord];

    handleChordKeypressGeneric({
        event: e, key,
        getExpectedIntervals: () => expectedIntervals,
        getComposition: () => currentComposition,
        setComposition: v => { currentComposition = v; },
        getProgress: () => chordProgress,
        setProgress: v => { chordProgress = v; },
        feedbackEl,
        intervalSpansSelector: '.chord-interval',
        onUpdateComposition: () => updateCompositionDisplay(),
        onUpdatePianoRoll: () => updateChordPianoRoll(),
        onChordComplete: (timeTaken) => {
            questionCount++;
            totalTime += timeTaken;

            // Track stats
            if (chordStats[currentChord]) {
                chordStats[currentChord].attempts++;
                chordStats[currentChord].totalTime += timeTaken;
                chordStats[currentChord].recentTimes.push(timeTaken);
                const currentWindow = getCurrentRollingAverageWindow();
                if (chordStats[currentChord].recentTimes.length > currentWindow) {
                    chordStats[currentChord].recentTimes.shift();
                }
            }

            // Update score display
            questionCountEl.textContent = questionCount;
            avgTimeEl.textContent = (totalTime / questionCount).toFixed(2) + 's';

            // Show feedback after 300ms
            setTimeout(() => {
                feedbackEl.textContent = `Correct! (${timeTaken.toFixed(2)}s)`;
                feedbackEl.className = 'feedback correct';
                playChordAudio(expectedIntervals);
            }, 300);

            // Handle drill / mastery / tutorial
            if (chordTutorialActive && chordTutorialIndex < chordTutorialSequence.length) {
                chordTutorialIndex++;
                saveAdaptiveChordProgress();
            }

            if (currentNewChord && currentChord === currentNewChord) {
                newChordDrillCount++;

                if (newChordDrillCount >= newChordDrillTarget) {
                    const chordToAdd = allChordsSorted.find(c => c.key === currentNewChord);
                    if (chordToAdd) {
                        activeChords.push(chordToAdd);
                        const addedPosInfo = chordToAdd.positionLabel ? ` ${chordToAdd.positionLabel}` : '';
                        setTimeout(() => {
                            feedbackEl.innerHTML = `<strong>✓ Drill complete!</strong><br>${chordToAdd.name}${addedPosInfo} has been added to the mix!`;
                            feedbackEl.className = 'feedback';
                            feedbackEl.style.background = '#d4edda';
                            feedbackEl.style.color = '#155724';
                        }, 1400);
                    }
                    currentNewChord = null;
                    newChordDrillCount = 0;
                    adaptiveChordLevel = countBaseChords(activeChords);
                    updateGameChordLevelDisplay();
                    saveAdaptiveChordProgress();
                    updateGameChordProgress();
                } else {
                    setTimeout(() => {
                        feedbackEl.innerHTML = `Drill progress: ${newChordDrillCount}/${newChordDrillTarget}`;
                        feedbackEl.className = 'feedback';
                        feedbackEl.style.background = '#fff3cd';
                        feedbackEl.style.color = '#856404';
                    }, 1400);
                    updateGameChordProgress();
                }
            } else {
                checkAndUnlockNextChord();
                updateGameChordProgress();
            }

            // Move to next question
            setTimeout(() => {
                nextAdaptiveChordQuestion();
            }, 1300);
        },
        onWrongAnswer: (expectedSet, alreadyEnteredSet) => {
            // Reset drill count if wrong answer during drilling
            if (currentNewChord && currentChord === currentNewChord) {
                newChordDrillCount = 0;
                saveAdaptiveChordProgress();
                feedbackEl.textContent = `Wrong interval! Drill reset - you need ${newChordDrillTarget} correct in a row. Expected one of: ${[...expectedSet].filter(i => !alreadyEnteredSet.has(i)).join(', ')}`;
            } else {
                feedbackEl.textContent = `Wrong interval! Expected one of: ${[...expectedSet].filter(i => !alreadyEnteredSet.has(i)).join(', ')}`;
            }

            feedbackEl.className = 'feedback incorrect';
            feedbackEl.style.background = '#f8d7da';
            feedbackEl.style.color = '#721c24';

            setTimeout(() => {
                clearFeedback(feedbackEl);
            }, 2000);
        }
    });
}
