// ============================================================
// INITIALIZATION & EVENT WIRING
// ============================================================

// Load settings on page load
loadSettings();

// Initialize combined mappings
updateAllMappings();

// Event listeners - unified hotkeys panel
mappingConfigBtn.addEventListener('click', () => {
    if (gameActive) {
        gameActive = false;
        if (timerInterval) clearInterval(timerInterval);
    }
    showHotkeysPanel('adaptive-mode-panel');
});

const backFromHotkeysBtn = document.getElementById('back-from-hotkeys-btn');
if (backFromHotkeysBtn) {
    backFromHotkeysBtn.addEventListener('click', () => {
        if (hotkeysPanelOrigin === 'chord-grid-mode-panel') showChordGridMode();
        else showAdaptiveMode();
    });
}

const cgCaptureKeyBtn = document.getElementById('cg-capture-key-btn');
if (cgCaptureKeyBtn) {
    let captureListening = false;
    cgCaptureKeyBtn.addEventListener('click', () => {
        captureListening = true;
        cgCaptureKeyBtn.textContent = 'Press a key...';
        cgCaptureKeyBtn.classList.add('listening');
    });
    document.addEventListener('keydown', (e) => {
        if (!captureListening) return;
        e.preventDefault();
        captureListening = false;
        cgCaptureKeyBtn.classList.remove('listening');
        const label = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key : e.key;
        cgCaptureKey = e.key === ' ' ? ' ' : e.key.toLowerCase();
        cgCaptureKeyBtn.textContent = label;
    }, true); // useCapture to intercept before game handlers
}

const submitKeyBtn = document.getElementById('submit-key-btn');
if (submitKeyBtn) {
    let submitListening = false;
    submitKeyBtn.addEventListener('click', () => {
        submitListening = true;
        submitKeyBtn.textContent = 'Press a key...';
        submitKeyBtn.classList.add('listening');
    });
    document.addEventListener('keydown', (e) => {
        if (!submitListening) return;
        e.preventDefault();
        submitListening = false;
        submitKeyBtn.classList.remove('listening');
        const label = e.key === ' ' ? 'Space' : e.key;
        submitKey = e.key === ' ' ? ' ' : e.key.toLowerCase();
        submitKeyBtn.textContent = label;
    }, true);
}

const saveHotkeysBtn = document.getElementById('save-hotkeys-btn');
if (saveHotkeysBtn) {
    saveHotkeysBtn.addEventListener('click', () => {
        saveHotkeysPanel();
        if (hotkeysPanelOrigin === 'chord-grid-mode-panel') showChordGridMode();
        else showAdaptiveMode();
    });
}

const resetHotkeysBtn = document.getElementById('reset-hotkeys-btn');
if (resetHotkeysBtn) {
    resetHotkeysBtn.addEventListener('click', resetHotkeysPanel);
}

// Settings button in game panel
const settingsBtn = document.getElementById('settings-btn');
if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
        gameActive = false;
        if (timerInterval) clearInterval(timerInterval);
        showAdaptiveMode();
    });
}

// Configure Mappings button in game panel
const mappingConfigBtnGame = document.getElementById('mapping-config-btn-game');
if (mappingConfigBtnGame) {
    mappingConfigBtnGame.addEventListener('click', () => {
        gameActive = false;
        if (timerInterval) clearInterval(timerInterval);
        showHotkeysPanel('game-panel');
    });
}

// Main menu buttons
const selectIntervalModeBtn = document.getElementById('select-interval-mode-btn');
if (selectIntervalModeBtn) {
    selectIntervalModeBtn.addEventListener('click', showAdaptiveMode);
}

const selectOnslaughtModeBtn = document.getElementById('select-onslaught-mode-btn');
if (selectOnslaughtModeBtn) {
    selectOnslaughtModeBtn.addEventListener('click', () => {
        renderOnslaughtLevelCards();
        showOnslaughtMode();
    });
}

const backToMainFromOnslaughtBtn = document.getElementById('back-to-main-from-onslaught-btn');
if (backToMainFromOnslaughtBtn) {
    backToMainFromOnslaughtBtn.addEventListener('click', showMainMenu);
}

const startOnslaughtBtn = document.getElementById('start-onslaught-btn');
if (startOnslaughtBtn) {
    startOnslaughtBtn.addEventListener('click', () => {
        initAudio();
        startOnslaughtGame();
    });
}

// Custom chord textarea live validation
const onslaughtCustomTextarea = document.getElementById('onslaught-custom-chords-input');
if (onslaughtCustomTextarea) {
    onslaughtCustomTextarea.addEventListener('input', validateCustomChords);
}

const onslaughtClearPoolBtn = document.getElementById('onslaught-clear-pool-btn');
if (onslaughtClearPoolBtn) {
    onslaughtClearPoolBtn.addEventListener('click', () => {
        const ta = document.getElementById('onslaught-custom-chords-input');
        if (ta) { ta.value = ''; validateCustomChords(); }
    });
}

// Initialize cards on load
renderOnslaughtLevelCards();
renderPianoRollLevelCards();

const onslaughtGridSizeInput = document.getElementById('onslaught-grid-size-input');
const onslaughtGridSizeDisplay = document.getElementById('onslaught-grid-size-display');
if (onslaughtGridSizeInput && onslaughtGridSizeDisplay) {
    onslaughtGridSizeInput.addEventListener('input', () => {
        onslaughtGridSizeDisplay.textContent = onslaughtGridSizeInput.value;
    });
}

const endOnslaughtBtn = document.getElementById('end-onslaught-btn');
if (endOnslaughtBtn) {
    endOnslaughtBtn.addEventListener('click', endOnslaughtGame);
}

const onslaughtArpeggioTagBtn = document.getElementById('onslaught-arpeggio-tag-btn');
if (onslaughtArpeggioTagBtn) {
    onslaughtArpeggioTagBtn.addEventListener('click', () => {
        const textarea = document.getElementById('onslaught-custom-chords-input');
        if (!textarea) return;

        const full = textarea.value;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        // Expand selection to cover full lines
        const lineStart = full.lastIndexOf('\n', start - 1) + 1;
        const lineEnd = full.indexOf('\n', end) === -1 ? full.length : full.indexOf('\n', end);
        const selectedText = full.slice(lineStart, lineEnd);

        const lines = selectedText.split('\n');
        const validLines = lines.filter(l => {
            const t = l.trim();
            return t && !t.startsWith('//') && !t.startsWith('#');
        });

        // If all valid selected lines already have : arp, remove; otherwise add
        const allTagged = validLines.length > 0 && validLines.every(l => /\s*:\s*arp\s*$/i.test(l));

        const newSelected = lines.map(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) return line;
            const hasArp = /\s*:\s*arp\s*$/i.test(trimmed);
            if (!allTagged && !hasArp) return line.trimEnd() + ' : arp';
            if (allTagged && hasArp) return line.replace(/\s*:\s*arp\s*$/i, '');
            return line;
        }).join('\n');

        textarea.value = full.slice(0, lineStart) + newSelected + full.slice(lineEnd);
        // Restore selection over the modified lines
        textarea.selectionStart = lineStart;
        textarea.selectionEnd = lineStart + newSelected.length;
        validateCustomChords();
    });
}

const onslaughtAddInversionsBtn = document.getElementById('onslaught-add-inversions-btn');
if (onslaughtAddInversionsBtn) {
    onslaughtAddInversionsBtn.addEventListener('click', () => {
        const textarea = document.getElementById('onslaught-custom-chords-input');
        if (!textarea) return;

        const full = textarea.value;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        // Expand selection to cover full lines
        const lineStart = full.lastIndexOf('\n', start - 1) + 1;
        const lineEnd = full.indexOf('\n', end) === -1 ? full.length : full.indexOf('\n', end);
        const selectedText = full.slice(lineStart, lineEnd);

        const newLines = [];
        for (const line of selectedText.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('#')) continue;
            const invLines = generateInversionLines(trimmed);
            newLines.push(...invLines);
        }

        if (!newLines.length) return;
        const toAppend = '\n' + newLines.join('\n');
        textarea.value = full + toAppend;
        validateCustomChords();
    });
}

// Piano Roll Onslaught mode
const selectPianoRollModeBtn = document.getElementById('select-pianoroll-mode-btn');
if (selectPianoRollModeBtn) {
    selectPianoRollModeBtn.addEventListener('click', () => {
        renderPianoRollLevelCards();
        showPanel('pianoroll-mode-panel');
    });
}

const backToMainFromPianoRollBtn = document.getElementById('back-to-main-from-pianoroll-btn');
if (backToMainFromPianoRollBtn) {
    backToMainFromPianoRollBtn.addEventListener('click', showMainMenu);
}

const startPianoRollBtn = document.getElementById('start-pianoroll-btn');
if (startPianoRollBtn) {
    startPianoRollBtn.addEventListener('click', () => {
        initAudio();
        startPianoRollGame();
    });
}

const endPianoRollBtn = document.getElementById('end-pianoroll-btn');
if (endPianoRollBtn) {
    endPianoRollBtn.addEventListener('click', endPianoRollGame);
}

const pianorollCustomTextarea = document.getElementById('pianoroll-custom-chords-input');
if (pianorollCustomTextarea) {
    pianorollCustomTextarea.addEventListener('input', validatePianoRollCustomChords);
}

const pianorollClearPoolBtn = document.getElementById('pianoroll-clear-pool-btn');
if (pianorollClearPoolBtn) {
    pianorollClearPoolBtn.addEventListener('click', () => {
        const ta = document.getElementById('pianoroll-custom-chords-input');
        if (ta) { ta.value = ''; validatePianoRollCustomChords(); }
    });
}

const selectChordModeBtn = document.getElementById('select-chord-mode-btn');
if (selectChordModeBtn) {
    selectChordModeBtn.addEventListener('click', showAdaptiveChordMode);
}

const selectChordGridModeBtn = document.getElementById('select-chord-grid-mode-btn');
if (selectChordGridModeBtn) {
    selectChordGridModeBtn.addEventListener('click', showChordGridMode);
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

// Adaptive chord mode buttons
const startAdaptiveChordBtn = document.getElementById('start-adaptive-chord-btn');
if (startAdaptiveChordBtn) {
    startAdaptiveChordBtn.addEventListener('click', () => {
        initAudio();
        startAdaptiveChordGame();
    });
}

const resetAdaptiveChordBtn = document.getElementById('reset-adaptive-chord-btn');
if (resetAdaptiveChordBtn) {
    resetAdaptiveChordBtn.addEventListener('click', resetAdaptiveChordProgress);
}

const chordResumeLevelBtn = document.getElementById('chord-resume-level-btn');
if (chordResumeLevelBtn) {
    chordResumeLevelBtn.addEventListener('click', () => {
        const chordResumeLevelInput = document.getElementById('chord-resume-level-input');
        if (chordResumeLevelInput) {
            const targetLevel = parseInt(chordResumeLevelInput.value);
            if (targetLevel >= 1) {
                resumeFromChordLevel(targetLevel);
            } else {
                alert('Please enter a valid level number (1 or higher)');
            }
        }
    });
}

// Chord mode level detail panel
const adaptiveChordLevelDisplay = document.getElementById('adaptive-chord-level-display');
if (adaptiveChordLevelDisplay) {
    adaptiveChordLevelDisplay.addEventListener('click', () => {
        const detail = document.getElementById('adaptive-chord-level-detail');
        const arrow = document.getElementById('adaptive-chord-level-arrow');
        if (detail) toggleLevelDetail(adaptiveChordLevelDisplay, detail, arrow, activeChords);
    });
}

const adaptiveLevelIndicator = document.getElementById('adaptive-level-indicator');
if (adaptiveLevelIndicator) {
    adaptiveLevelIndicator.addEventListener('click', () => {
        const detail = document.getElementById('game-level-detail');
        const arrow = document.getElementById('game-level-arrow');
        if (detail) toggleLevelDetail(adaptiveLevelIndicator, detail, arrow, activeChords);
    });
}

// Adaptive interval mode buttons
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

// Skip button
skipBtn.addEventListener('click', () => {
    feedbackEl.textContent = `Skipped. The answer was: ${getCorrectFactorization()}`;
    feedbackEl.className = 'feedback';
    feedbackEl.style.background = '#fff3cd';
    feedbackEl.style.color = '#856404';

    setTimeout(() => {
        if (gameMode === 'adaptive') {
            nextAdaptiveQuestion();
        } else if (gameMode === 'adaptive-chord') {
            nextAdaptiveChordQuestion();
        }
    }, 2000);
});

// End game button
endBtn.addEventListener('click', endGame);

// Interval/chord mode keydown listener
document.addEventListener('keydown', (e) => {
    if (!gameActive) return;

    const key = e.key.toLowerCase();

    // Handle chord mode separately
    if (gameMode === 'adaptive-chord') {
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

    // Submit key (or Tab) - check answer
    if (key === submitKey.toLowerCase() || e.key === 'Tab') {
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
        currentComposition.push(allMappings[key]);
        updateCompositionDisplay();
    }
});

// Chord-Grid keydown listener
document.addEventListener('keydown', (event) => {
    if (chordGridGameActive) {
        if (event.key === 'Tab') event.preventDefault();
        handleChordGridKeyPress(event);
    }
});

// Onslaught keydown listener
document.addEventListener('keydown', (event) => {
    if (onslaughtActive) {
        handleOnslaughtKeyPress(event);
    }
});

// Piano Roll keydown listener
document.addEventListener('keydown', (event) => {
    if (prActive) {
        if (event.key === 'Tab') event.preventDefault();
        handlePianoRollKeyPress(event);
    }
});


// Chord-Grid event listeners
const chordGridSizeInput = document.getElementById('chord-grid-size-input');
const chordGridSizeDisplay = document.getElementById('chord-grid-size-display');
if (chordGridSizeInput && chordGridSizeDisplay) {
    chordGridSizeInput.addEventListener('input', () => {
        const newSize = parseInt(chordGridSizeInput.value);
        chordGridSize = newSize;
        chordGridSizeDisplay.textContent = newSize;
    });
}

const backToMainFromChordGridBtn = document.getElementById('back-to-main-from-chord-grid-btn');
if (backToMainFromChordGridBtn) {
    backToMainFromChordGridBtn.addEventListener('click', () => {
        if (chordGridGameActive) {
            endChordGridGame();
        }
        showMainMenu();
    });
}

const cgHotkeysConfigBtn = document.getElementById('cg-hotkeys-config-btn');
if (cgHotkeysConfigBtn) {
    cgHotkeysConfigBtn.addEventListener('click', () => showHotkeysPanel('chord-grid-mode-panel'));
}

const startChordGridBtn = document.getElementById('start-chord-grid-btn');
if (startChordGridBtn) {
    startChordGridBtn.addEventListener('click', () => {
        initAudio();
        startChordGridGame();
    });
}

const resetChordGridBtn = document.getElementById('reset-chord-grid-btn');
if (resetChordGridBtn) {
    resetChordGridBtn.addEventListener('click', () => {
        resetChordGridGame();
    });
}

const endChordGridBtn = document.getElementById('end-chord-grid-btn');
if (endChordGridBtn) {
    endChordGridBtn.addEventListener('click', () => {
        endChordGridGame();
        showChordGridMode();
        updateCGStats();
    });
}

const cgResumeLevelBtn = document.getElementById('cg-resume-level-btn');
if (cgResumeLevelBtn) {
    cgResumeLevelBtn.addEventListener('click', () => {
        const input = document.getElementById('cg-resume-level-input');
        if (input) {
            const targetLevel = parseInt(input.value);
            if (targetLevel >= 1) {
                resumeFromCGLevel(targetLevel);
            } else {
                alert('Please enter a valid level number (1 or higher)');
            }
        }
    });
}

// CG level detail panels
const cgLevelDisplay = document.getElementById('cg-level-display');
if (cgLevelDisplay) {
    cgLevelDisplay.addEventListener('click', () => {
        const detail = document.getElementById('cg-level-detail');
        const arrow = document.getElementById('cg-level-arrow');
        if (detail) toggleLevelDetail(cgLevelDisplay, detail, arrow, cgActiveChords);
    });
}

const cgLevelIndicator = document.getElementById('cg-level-indicator');
if (cgLevelIndicator) {
    cgLevelIndicator.addEventListener('click', () => {
        const detail = document.getElementById('cg-game-level-detail');
        const arrow = document.getElementById('cg-game-level-arrow');
        if (detail) toggleLevelDetail(cgLevelIndicator, detail, arrow, cgActiveChords);
    });
}

// DOMContentLoaded: auto-save settings, load progress
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
        // Chord-specific settings
        'random-starting-note-checkbox',
        'include-inversions-checkbox',
        'chord-mastery-threshold-input',
        'chord-min-attempts-input',
        'chord-rolling-average-window-input',
        'chord-non-mastered-rate-input',
        // Chord-Grid specific settings
        'chord-grid-random-start-checkbox',
        'chord-grid-include-inversions-checkbox',
        'cg-mastery-threshold-input',
        'cg-min-attempts-input',
        'cg-rolling-average-window-input',
        'cg-non-mastered-rate-input',
        'chord-grid-show-chord-info-checkbox',
        'onslaught-random-start-checkbox',
        'onslaught-mistake-expires-checkbox',
        'onslaught-mistake-penalty-input',
        'onslaught-expire-penalty-input',
        'onslaught-show-chord-info-checkbox',
        'onslaught-arpeggio-direction',
        // Piano Roll settings
        'pianoroll-edo-input',
        'pianoroll-spawn-octaves-input',
        'pianoroll-columns-input',
        'pianoroll-fade-time-input',
        'pianoroll-spawn-interval-input',
        'pianoroll-arp-mode-select',
        'pianoroll-arp-chance-input',
        'pianoroll-include-intervals-checkbox',
        'pianoroll-cursor-label-checkbox',
        'pianoroll-prime-limit-select',
        'pianoroll-mistake-expires-checkbox',
        'pianoroll-mistake-penalty-input',
        'pianoroll-expire-penalty-input'
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

    // Load chord-grid adaptive progress and display stats on page load
    if (!loadCGAdaptiveProgress()) {
        initializeCGAdaptiveMode();
    }
    updateCGStats();
});
