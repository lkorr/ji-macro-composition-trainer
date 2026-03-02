// ============================================================
// STANDALONE GRID MODE
// ============================================================

function startGridGame() {
    gridGameActive = true;
    gridScore = 0;
    gridTotalTime = 0;
    gridStartTime = Date.now();

    // Initialize player in center
    playerRow = Math.floor(gridSize / 2);
    playerCol = Math.floor(gridSize / 2);

    // Place first target
    placeNewTarget();

    // Start timer
    if (gridTimerInterval) {
        clearInterval(gridTimerInterval);
    }
    gridTimerInterval = setInterval(updateGridTimer, 10);

    // Render grid
    renderGrid();
    updateGridStats();

    // Focus on the grid container to capture key events
    document.getElementById('grid-container').focus();
}

function endGridGame() {
    gridGameActive = false;
    if (gridTimerInterval) {
        clearInterval(gridTimerInterval);
        gridTimerInterval = null;
    }
}

function resetGridGame() {
    endGridGame();
    gridScore = 0;
    gridTotalTime = 0;
    updateGridStats();
    renderGrid();
}

function placeNewTarget() {
    gridTargetStartTime = Date.now();

    // Place target at random position (different from player)
    let newRow, newCol;
    do {
        newRow = Math.floor(Math.random() * gridSize);
        newCol = Math.floor(Math.random() * gridSize);
    } while (newRow === playerRow && newCol === playerCol);

    targetRow = newRow;
    targetCol = newCol;
}

function movePlayer(dRow, dCol) {
    if (!gridGameActive) return;

    const newRow = playerRow + dRow;
    const newCol = playerCol + dCol;

    // Check bounds
    if (newRow >= 0 && newRow < gridSize && newCol >= 0 && newCol < gridSize) {
        playerRow = newRow;
        playerCol = newCol;
        renderGrid();
    }
}

function captureTarget() {
    if (!gridGameActive) return;

    // Check if player is on target
    if (playerRow === targetRow && playerCol === targetCol) {
        const targetTime = (Date.now() - gridTargetStartTime) / 1000;
        gridTotalTime += targetTime;
        gridScore++;
        updateGridStats();

        // Place new target at different location
        let newRow, newCol;
        do {
            newRow = Math.floor(Math.random() * gridSize);
            newCol = Math.floor(Math.random() * gridSize);
        } while (newRow === playerRow && newCol === playerCol);

        targetRow = newRow;
        targetCol = newCol;
        gridTargetStartTime = Date.now();

        playSound('correct');

        // Force re-render
        renderGrid();
    }
}

function renderGrid() {
    renderGridInto('grid-container', gridSize, playerRow, playerCol, targetRow, targetCol);
}

function updateGridTimer() {
    if (!gridGameActive || !gridStartTime) return;
    document.getElementById('grid-timer').textContent = formatElapsedTime(gridStartTime);
}

function updateGridStats() {
    document.getElementById('grid-score').textContent = gridScore;

    if (gridScore > 0) {
        const avgTime = gridTotalTime / gridScore;
        document.getElementById('grid-avg-time').textContent = avgTime.toFixed(2) + 's';
    } else {
        document.getElementById('grid-avg-time').textContent = '0.00s';
    }
}

// Handle grid game keyboard input
function handleGridKeyPress(event) {
    if (!gridGameActive) return;

    const key = event.key.toLowerCase();

    // ASDF movement: a=left, s=up, d=down, f=right
    switch (key) {
        case 'a':
            event.preventDefault();
            movePlayer(0, -1);
            break;
        case 's':
            event.preventDefault();
            movePlayer(-1, 0);
            break;
        case 'd':
            event.preventDefault();
            movePlayer(1, 0);
            break;
        case 'f':
            event.preventDefault();
            movePlayer(0, 1);
            break;
        case 'tab':
            event.preventDefault();
            captureTarget();
            break;
    }
}
