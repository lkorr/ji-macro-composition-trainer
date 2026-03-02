// ============================================================
// ADAPTIVE INTERVAL MODE
// ============================================================

// Initialize adaptive mode with all intervals sorted by complexity
function initializeAdaptiveMode() {
    allIntervalsSorted = buildSortedIntervals();

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

            // Reconstruct interval objects with proper ordering
            allIntervalsSorted = buildSortedIntervals();

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

    allIntervalsSorted = buildSortedIntervals();

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

// Handle correct answer (interval mode)
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
        if (gameMode === 'adaptive') {
            nextAdaptiveQuestion();
        }
    }, 800);
}

// Get correct factorization as string
function getCorrectFactorization() {
    // This is complex - for now just show the target
    return `(see factorization of ${currentInterval.display})`;
}

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
