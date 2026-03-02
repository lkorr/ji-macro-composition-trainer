// ============================================================
// CHORD + GRID COMBINED MODE
// ============================================================

// ===== CHORD+GRID MODE PERSISTENCE (delegates to generic) =====

function _cgModeParams() {
    return {
        expandFlag: chordGridRandomStart, inversionsFlag: chordGridIncludeInversions,
        setAllSorted: v => { cgAllChordsSorted = v; },
        setStats: v => { cgChordStats = v; }, getStats: () => cgChordStats,
        setActive: v => { cgActiveChords = v; },
        setDrillCount: v => { cgNewChordDrillCount = v; },
        setNewChord: v => { cgCurrentNewChord = v; },
        setTutorialActive: v => { cgTutorialActive = v; },
        setTutorialIndex: v => { cgTutorialIndex = v; },
        setTutorialSeq: v => { cgTutorialSequence = v; },
        setLevel: v => { cgAdaptiveLevel = v; },
        setDisabled: v => { cgDisabledChords = v; },
        saveFunc: () => saveCGAdaptiveProgress(),
        updateStatsFunc: updateCGStats,
        updateLevelFunc: updateCGLevelDisplay
    };
}

function initializeCGAdaptiveMode() {
    initializeChordAdaptive(_cgModeParams());
}

function loadCGAdaptiveProgress() {
    return loadChordAdaptive({
        ..._cgModeParams(),
        storageKey: 'ji_cg_adaptive_progress',
        savedExpandFlagKey: 'chordGridRandomStart',
        savedStatsKey: 'cgChordStats', savedActiveKey: 'cgActiveChords',
        savedLevelKey: 'cgAdaptiveLevel', savedTutIdxKey: 'cgTutorialIndex',
        savedTutActiveKey: 'cgTutorialActive', savedDrillCountKey: 'cgNewChordDrillCount',
        savedNewChordKey: 'cgCurrentNewChord', savedDisabledKey: 'cgDisabledChords'
    });
}

function saveCGAdaptiveProgress() {
    localStorage.setItem('ji_cg_adaptive_progress', JSON.stringify({
        cgChordStats, cgActiveChords: cgActiveChords.map(c => ({ key: c.key })),
        cgAdaptiveLevel, cgTutorialIndex, cgTutorialActive,
        cgNewChordDrillCount, cgCurrentNewChord, chordGridRandomStart, chordGridIncludeInversions,
        cgDisabledChords: [...cgDisabledChords]
    }));
}

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

function resumeFromCGLevel(targetLevel) {
    resumeFromChordLevelGeneric(targetLevel, _cgModeParams());
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

function updateCGLevelDisplay() {
    updateLevelDisplayElements('cg-level-number', 'cg-level-detail', cgAdaptiveLevel, cgActiveChords);
    updateLevelDisplayElements('cg-game-level-number', 'cg-game-level-detail', cgAdaptiveLevel, cgActiveChords);
}

function updateCGStats() {
    updateChordStatsGeneric({
        statsElId: 'cg-stats',
        activeChords: cgActiveChords, allSorted: cgAllChordsSorted, statsObj: cgChordStats,
        disabledSet: cgDisabledChords, collapsedSet: collapsedCGChordGroups,
        getMasteryThreshold: getCGMasteryThreshold, getMinAttempts: getCGMinAttempts,
        getRollingWindow: getCGRollingWindow,
        loadFunc: loadCGAdaptiveProgress, saveFunc: saveCGAdaptiveProgress,
        updateFunc: updateCGStats, updateLevelFunc: updateCGLevelDisplay,
        dataMode: 'cg'
    });
}

function updateCGGameProgress() {
    updateGameChordProgressGeneric({
        containerId: 'cg-game-interval-progress', statsElId: 'cg-game-progress-stats',
        activeChords: cgActiveChords, allSorted: cgAllChordsSorted, statsObj: cgChordStats,
        disabledSet: cgDisabledChords, collapsedSet: collapsedCGChordGroups,
        getMasteryThreshold: getCGMasteryThreshold, getMinAttempts: getCGMinAttempts,
        getRollingWindow: getCGRollingWindow,
        saveFunc: saveCGAdaptiveProgress, updateFunc: updateCGGameProgress,
        currentNewChord: () => cgCurrentNewChord, drillCount: () => cgNewChordDrillCount, drillTarget: cgNewChordDrillTarget,
        dataMode: 'cg', guardFunc: null
    });
}

function selectWeightedRandomCGChord() {
    return selectWeightedRandomChordFrom({
        chords: cgActiveChords,
        disabledSet: cgDisabledChords,
        statsObj: cgChordStats,
        questionCounter: cgGlobalQuestionCounter,
        getMasteryThreshold: getCGMasteryThreshold,
        getNonMasteredRate: getCGNonMasteredRate,
        getRollingWindow: getCGRollingWindow
    });
}

function checkAndUnlockNextCGChord() {
    checkAndUnlockNextChordGeneric({
        activeChords: cgActiveChords, allSorted: cgAllChordsSorted, statsObj: cgChordStats, disabledSet: cgDisabledChords,
        getMasteryThreshold: getCGMasteryThreshold, getMinAttempts: getCGMinAttempts,
        getRollingWindow: getCGRollingWindow,
        getCurrentNewChord: () => cgCurrentNewChord, setCurrentNewChord: v => { cgCurrentNewChord = v; },
        resetDrillCount: () => { cgNewChordDrillCount = 0; },
        getLevel: () => cgAdaptiveLevel, setLevel: v => { cgAdaptiveLevel = v; },
        updateLevelDisplay: updateCGLevelDisplay,
        feedbackEl: document.getElementById('chord-grid-feedback'),
        drillTarget: cgNewChordDrillTarget,
        saveFunc: saveCGAdaptiveProgress, periodicCounter: () => chordGridScore
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

    const cgChordEntry = cgAllChordsSorted.find(c => c.key === cgCurrentChord);

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
    const cgDisplayEntry = cgAllChordsSorted.find(c => c.key === cgCurrentChord);
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
        resetIntervalHighlightsInContainer('#chord-grid-chord-intervals .chord-interval');
        markIntervalCorrectInContainer('1/1', '#chord-grid-chord-intervals .chord-interval');
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

// Handle chord building keypress in chord-grid mode (uses generic handler)
function handleChordGridChordKeypress(event, key) {
    const cgFeedbackEl = document.getElementById('chord-grid-feedback');

    handleChordKeypressGeneric({
        event, key,
        getExpectedIntervals: () => cgCurrentExpectedIntervals,
        getComposition: () => cgCurrentComposition,
        setComposition: v => { cgCurrentComposition = v; },
        getProgress: () => cgChordProgress,
        setProgress: v => { cgChordProgress = v; },
        feedbackEl: cgFeedbackEl,
        intervalSpansSelector: '#chord-grid-chord-intervals .chord-interval',
        onUpdateComposition: () => updateChordGridCompositionDisplay(),
        onUpdatePianoRoll: () => renderChordGridPianoRoll(),
        onChordComplete: (targetTime) => {
            // Use chordGridTargetStartTime for CG mode timing (includes grid phase)
            const totalTargetTime = (Date.now() - chordGridTargetStartTime) / 1000;
            chordGridTotalTime += totalTargetTime;
            chordGridScore++;
            updateChordGridStats();

            // Record stats (skip during drill phase)
            const cgIsDrilling = cgCurrentNewChord && cgCurrentChord === cgCurrentNewChord && cgNewChordDrillCount < cgNewChordDrillTarget;
            if (!cgIsDrilling && cgChordStats[cgCurrentChord]) {
                cgChordStats[cgCurrentChord].attempts++;
                cgChordStats[cgCurrentChord].totalTime += totalTargetTime;
                cgChordStats[cgCurrentChord].recentTimes.push(totalTargetTime);
                if (cgChordStats[cgCurrentChord].recentTimes.length > 20) {
                    cgChordStats[cgCurrentChord].recentTimes = cgChordStats[cgCurrentChord].recentTimes.slice(-20);
                }
            }

            // Handle drill counting
            if (cgCurrentNewChord && cgCurrentChord === cgCurrentNewChord) {
                cgNewChordDrillCount++;

                if (cgNewChordDrillCount >= cgNewChordDrillTarget) {
                    const chordToAdd = cgAllChordsSorted.find(c => c.key === cgCurrentNewChord);
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
            updateCGGameProgress();

            // Show feedback
            let drillMsg = '';
            if (cgCurrentNewChord && cgCurrentChord === cgCurrentNewChord) {
                drillMsg = ` | Drill: ${cgNewChordDrillCount}/${cgNewChordDrillTarget}`;
            }

            setTimeout(() => {
                if (cgFeedbackEl) {
                    cgFeedbackEl.textContent = `Correct! (${totalTargetTime.toFixed(2)}s)${drillMsg}`;
                    cgFeedbackEl.className = 'feedback correct';
                }
                playChordAudio(cgCurrentExpectedIntervals);
            }, 300);

            // Transition back to grid phase
            setTimeout(() => {
                if (!chordGridGameActive) return;

                clearFeedback(cgFeedbackEl);

                selectNextChordGridChord();
                placeChordGridTarget();
                setChordGridPhase('grid');
                renderChordGrid();

                const container = document.getElementById('chord-grid-container');
                if (container) container.focus();
            }, 1300);
        },
        onWrongAnswer: (expectedSet, alreadyEnteredSet) => {
            // Reset drill count on wrong answer
            if (cgCurrentNewChord && cgCurrentChord === cgCurrentNewChord) {
                cgNewChordDrillCount = 0;
            }

            if (cgFeedbackEl) {
                cgFeedbackEl.textContent = `Wrong interval! Expected one of: ${[...expectedSet].filter(i => !alreadyEnteredSet.has(i)).join(', ')}`;
                cgFeedbackEl.className = 'feedback incorrect';
                cgFeedbackEl.style.background = '#f8d7da';
                cgFeedbackEl.style.color = '#721c24';
            }

            setTimeout(() => {
                clearFeedback(cgFeedbackEl);
            }, 2000);
        }
    });
}

// Render functions
function renderChordGrid() {
    renderGridInto('chord-grid-container', chordGridSize, chordGridPlayerRow, chordGridPlayerCol, chordGridTargetRow, chordGridTargetCol);
}

function renderChordGridPianoRoll() {
    if (!cgCurrentChord) return;
    renderPianoRollSVG({
        containerId: 'chord-grid-piano-roll',
        intervals: cgCurrentExpectedIntervals,
        enteredIntervals: cgChordProgress,
        arrowValue: multiplyFractions(cgCurrentComposition)
    });
}

function renderChordGridPianoRollPreview() {
    if (!cgCurrentChord) return;
    renderPianoRollSVG({
        containerId: 'chord-grid-piano-roll',
        intervals: cgCurrentExpectedIntervals,
        enteredIntervals: null,
        arrowValue: { num: 1, denom: 1 }
    });
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
