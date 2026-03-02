// ============================================================
// PURE UTILITY FUNCTIONS (no DOM access)
// ============================================================

// Get interval name
function getIntervalName(num, denom) {
    const key = `${num}/${denom}`;
    const ratio = num / denom;

    // Check if it's a descending interval (below 1/1)
    if (ratio < 1) {
        // Find the ascending equivalent (reciprocal)
        const reciprocalKey = `${denom}/${num}`;
        const baseName = INTERVAL_NAMES[reciprocalKey] || INTERVAL_NAMES[key] || '';

        if (baseName) {
            return `DOWN a ${baseName}`;
        }
    }

    return INTERVAL_NAMES[key] || '';
}

// Format interval display based on display mode
function formatIntervalDisplay(num, denom) {
    const cents = (1200 * Math.log2(num / denom)).toFixed(2);
    const intervalName = getIntervalName(num, denom);

    // Determine what to display based on mode
    let displayContent = '';

    if (displayMode === 'all') {
        // Show all: cents, fraction, and name
        displayContent = `
            <div class="cents-display">${cents}¢</div>
            <span class="fraction"><span class="numerator">${num}</span><span class="denominator">${denom}</span></span>
            ${intervalName ? `<div class="interval-name">${intervalName}</div>` : ''}
        `;
    } else if (displayMode === 'fraction') {
        // Fraction only
        displayContent = `
            <span class="fraction"><span class="numerator">${num}</span><span class="denominator">${denom}</span></span>
        `;
    } else if (displayMode === 'cents') {
        // Cents only
        displayContent = `
            <div class="cents-display large">${cents}¢</div>
        `;
    } else if (displayMode === 'name') {
        // Name only (or fraction if no name)
        if (intervalName) {
            displayContent = `
                <div class="interval-name large">${intervalName}</div>
            `;
        } else {
            displayContent = `
                <span class="fraction"><span class="numerator">${num}</span><span class="denominator">${denom}</span></span>
                <div class="interval-name">(no name available)</div>
            `;
        }
    } else if (displayMode.startsWith('rotate-')) {
        // Rotation modes
        const rotationOptions = [];

        if (displayMode === 'rotate-fraction-cents') {
            rotationOptions.push(
                `<span class="fraction"><span class="numerator">${num}</span><span class="denominator">${denom}</span></span>`,
                `<div class="cents-display large">${cents}¢</div>`
            );
        } else if (displayMode === 'rotate-fraction-name') {
            rotationOptions.push(
                `<span class="fraction"><span class="numerator">${num}</span><span class="denominator">${denom}</span></span>`,
                intervalName ? `<div class="interval-name large">${intervalName}</div>` : `<div class="interval-name large">(no name available)</div>`
            );
        } else if (displayMode === 'rotate-cents-name') {
            rotationOptions.push(
                `<div class="cents-display large">${cents}¢</div>`,
                intervalName ? `<div class="interval-name large">${intervalName}</div>` : `<div class="interval-name large">(no name available)</div>`
            );
        } else if (displayMode === 'rotate-all') {
            rotationOptions.push(
                `<span class="fraction"><span class="numerator">${num}</span><span class="denominator">${denom}</span></span>`,
                `<div class="cents-display large">${cents}¢</div>`,
                intervalName ? `<div class="interval-name large">${intervalName}</div>` : `<div class="interval-name large">(no name available)</div>`
            );
        }

        // Use current rotation index
        displayContent = rotationOptions[currentRotationIndex % rotationOptions.length];
    }

    return displayContent;
}

// Octave reduce a fraction to [1/2, 2] range (includes reciprocals below 1/1)
function octaveReduce(num, denom) {
    let n = num;
    let d = denom;

    // Reduce to [1/2, 2] - inclusive of 2/1
    while (n / d > 2) {
        d *= 2;
    }
    while (n / d < 0.5) {
        n *= 2;
    }

    return reduceFraction(n, d);
}

// Get prime factorization of a number
function primeFactorization(n) {
    const factors = {};
    let num = n;

    // Handle 2
    while (num % 2 === 0) {
        factors[2] = (factors[2] || 0) + 1;
        num /= 2;
    }

    // Handle odd primes
    for (let i = 3; i <= Math.sqrt(num); i += 2) {
        while (num % i === 0) {
            factors[i] = (factors[i] || 0) + 1;
            num /= i;
        }
    }

    if (num > 2) {
        factors[num] = (factors[num] || 0) + 1;
    }

    return factors;
}

// Get prime factorization of a fraction
function fractionFactorization(num, denom) {
    const numFactors = primeFactorization(num);
    const denomFactors = primeFactorization(denom);

    // Combine: numerator primes are positive, denominator primes are negative
    const combined = {};

    for (const [prime, count] of Object.entries(numFactors)) {
        combined[prime] = count;
    }

    for (const [prime, count] of Object.entries(denomFactors)) {
        combined[prime] = (combined[prime] || 0) - count;
    }

    return combined;
}

// Generate all intervals for a level
function generateIntervals(complexityMin, complexityMax) {
    const intervals = [];
    const limit = 30;

    for (let num = 1; num <= limit; num++) {
        for (let denom = 1; denom <= limit; denom++) {
            if (gcd(num, denom) !== 1) continue; // Only reduced fractions

            // Octave reduce first
            const reduced = octaveReduce(num, denom);

            // Skip unison only
            if (reduced.num === 1 && reduced.denom === 1) continue;

            // Calculate complexity AFTER octave reduction
            const complexity = reduced.num * reduced.denom;
            if (complexity <= complexityMin || complexity > complexityMax) continue;

            // Get prime factorization
            const factorization = fractionFactorization(reduced.num, reduced.denom);

            intervals.push({
                num: reduced.num,
                denom: reduced.denom,
                complexity: complexity,
                factorization: factorization,
                display: `${reduced.num}/${reduced.denom}`
            });
        }
    }

    // Remove duplicates
    const uniqueIntervals = [];
    const seen = new Set();

    for (const interval of intervals) {
        const key = `${interval.num}/${interval.denom}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueIntervals.push(interval);
        }
    }

    return uniqueIntervals;
}

// Shuffle array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Format elapsed time as M:SS.CC
function formatElapsedTime(startTimeMs) {
    const elapsed = (Date.now() - startTimeMs) / 1000;
    const minutes = Math.floor(elapsed / 60);
    const seconds = Math.floor(elapsed % 60);
    const centiseconds = Math.floor((elapsed % 1) * 100);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

// Multiply array of fractions
function multiplyFractions(fractions) {
    if (fractions.length === 0) return { num: 1, denom: 1 };

    let num = 1;
    let denom = 1;

    for (const frac of fractions) {
        num *= frac.num;
        denom *= frac.denom;
    }

    return reduceFraction(num, denom);
}

// Check if composition matches target
function checkAnswer() {
    const product = multiplyFractions(currentComposition);
    return product.num === currentInterval.num && product.denom === currentInterval.denom;
}

// Check if two interval sets match (unordered)
function intervalsMatch(entered, expected) {
    // Both arrays should have the same length
    if (entered.length !== expected.length) return false;

    // Create copies to avoid modifying originals
    const enteredCopy = entered.map(e => `${e.num}/${e.denom}`);
    const expectedCopy = expected.map(e => `${e.num}/${e.denom}`);

    // Sort both arrays
    enteredCopy.sort();
    expectedCopy.sort();

    // Compare element by element
    for (let i = 0; i < enteredCopy.length; i++) {
        if (enteredCopy[i] !== expectedCopy[i]) return false;
    }

    return true;
}

// Build sorted intervals: ascending by complexity, each followed by its descending counterpart
function buildSortedIntervals() {
    const allIntervals = generateIntervals(0, 900);
    const ascending = allIntervals.filter(i => i.num / i.denom >= 1);
    const descending = allIntervals.filter(i => i.num / i.denom < 1);
    ascending.sort((a, b) => a.complexity - b.complexity);

    const result = [];
    const descMap = new Map();
    for (const desc of descending) {
        descMap.set(`${desc.denom}/${desc.num}`, desc);
    }
    for (const asc of ascending) {
        const ascKey = `${asc.num}/${asc.denom}`;
        result.push(asc);
        if (descMap.has(ascKey)) {
            result.push(descMap.get(ascKey));
            descMap.delete(ascKey);
        }
    }
    for (const desc of descMap.values()) {
        result.push(desc);
    }
    return result;
}
