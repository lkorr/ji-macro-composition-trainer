// Chord type definitions for just intonation

// Helper functions for fraction manipulation
function gcd(a, b) {
    while (b !== 0) {
        let temp = b;
        b = a % b;
        a = temp;
    }
    return a;
}

function reduceFraction(num, denom) {
    const g = gcd(num, denom);
    return { num: num / g, denom: denom / g };
}

// Base chord definitions (harmonic notation with 1:1 root)
const BASE_CHORD_TYPES = {
    '4:5:6': [{ num: 1, denom: 1 }, { num: 5, denom: 4 }, { num: 3, denom: 2 }],            // Major
    '10:12:15': [{ num: 1, denom: 1 }, { num: 6, denom: 5 }, { num: 3, denom: 2 }],         // Minor
    '5:6:7': [{ num: 1, denom: 1 }, { num: 6, denom: 5 }, { num: 7, denom: 5 }],            // Diminished
    '16:20:25': [{ num: 1, denom: 1 }, { num: 5, denom: 4 }, { num: 25, denom: 16 }],       // Augmented
    '6:8:9': [{ num: 1, denom: 1 }, { num: 4, denom: 3 }, { num: 3, denom: 2 }],            // Sus4
    '8:9:12': [{ num: 1, denom: 1 }, { num: 9, denom: 8 }, { num: 3, denom: 2 }],           // Sus2
    '6:7:9': [{ num: 1, denom: 1 }, { num: 7, denom: 6 }, { num: 3, denom: 2 }],            // Subminor
    '14:18:21': [{ num: 1, denom: 1 }, { num: 9, denom: 7 }, { num: 3, denom: 2 }],         // Supermajor
    '20:25:30:36': [{ num: 1, denom: 1 }, { num: 5, denom: 4 }, { num: 3, denom: 2 }, { num: 9, denom: 5 }],    // Dominant 7th
    '8:10:12:15': [{ num: 1, denom: 1 }, { num: 5, denom: 4 }, { num: 3, denom: 2 }, { num: 15, denom: 8 }],    // Major 7th
    '10:12:15:18': [{ num: 1, denom: 1 }, { num: 6, denom: 5 }, { num: 3, denom: 2 }, { num: 9, denom: 5 }],    // Minor 7th
    '4:5:6:7': [{ num: 1, denom: 1 }, { num: 5, denom: 4 }, { num: 3, denom: 2 }, { num: 7, denom: 4 }],        // Harmonic 7th
    '20:24:30:35': [{ num: 1, denom: 1 }, { num: 6, denom: 5 }, { num: 3, denom: 2 }, { num: 7, denom: 4 }],    // Subminor 7th
    '12:15:18:20': [{ num: 1, denom: 1 }, { num: 5, denom: 4 }, { num: 3, denom: 2 }, { num: 5, denom: 3 }],    // Major 6th
    '30:36:45:50': [{ num: 1, denom: 1 }, { num: 6, denom: 5 }, { num: 3, denom: 2 }, { num: 5, denom: 3 }]     // Minor 6th
};

// Traditional chord names mapping (for base chords; inversions will use harmonic notation if not listed)
const CHORD_NAMES = {
    // Base triads
    '4:5:6': 'Major',
    '10:12:15': 'Minor',
    '5:6:7': 'Diminished',
    '16:20:25': 'Augmented',
    '6:8:9': 'Sus4',
    '8:9:12': 'Sus2',
    '6:7:9': 'Subminor',
    '14:18:21': 'Supermajor',

    // 7th chords
    '20:25:30:36': 'Dominant 7th',
    '8:10:12:15': 'Major 7th',
    '10:12:15:18': 'Minor 7th',
    '4:5:6:7': 'Harmonic 7th',
    '20:24:30:35': 'Subminor 7th',

    // 6th chords
    '12:15:18:20': 'Major 6th',
    '30:36:45:50': 'Minor 6th'

    // Note: Inversion names will default to their reduced harmonic notation (e.g., "3:4:5")
    // unless explicitly defined here
};

// Generate chord inversions by moving the bottom N notes up an octave
// For 1st inversion: bottom note goes up an octave, rebase from new bass
// For 2nd inversion: bottom two notes go up an octave, rebase from new bass
// Uses exact fraction arithmetic throughout to avoid rounding errors
function generateInversion(baseChord, inversionIndex) {
    const intervals = BASE_CHORD_TYPES[baseChord];
    if (!intervals || inversionIndex >= intervals.length || inversionIndex === 0) {
        return null;
    }

    // Copy intervals as {num, denom} fractions
    let notes = intervals.map(i => ({ num: i.num, denom: i.denom }));

    // Move the bottom inversionIndex notes up an octave (multiply by 2)
    for (let i = 0; i < inversionIndex; i++) {
        notes[i] = { num: notes[i].num * 2, denom: notes[i].denom };
    }

    // Sort ascending by value
    notes.sort((a, b) => (a.num * b.denom) - (b.num * a.denom));

    // Rebase: divide everything by the new bass note so bass = 1/1
    const bass = notes[0];
    const invertedIntervals = notes.map(note => {
        // note / bass = (note.num / note.denom) / (bass.num / bass.denom)
        //             = (note.num * bass.denom) / (note.denom * bass.num)
        const newNum = note.num * bass.denom;
        const newDenom = note.denom * bass.num;
        return reduceFraction(newNum, newDenom);
    });

    return invertedIntervals;
}

// Generate inversion name
function getInversionName(baseChord, inversionIndex) {
    if (inversionIndex === 0) return baseChord; // Root position

    // Parse base chord notation
    const parts = baseChord.split(':').map(Number);
    const intervals = BASE_CHORD_TYPES[baseChord];

    if (!intervals || inversionIndex >= intervals.length) return baseChord;

    // Rotate: move first N elements to end
    const rotated = [...parts.slice(inversionIndex), ...parts.slice(0, inversionIndex)];

    // Adjust octaves: any number smaller than the first should be doubled until it's >= first
    const first = rotated[0];
    const adjusted = rotated.map(n => {
        let adjustedN = n;
        while (adjustedN < first) {
            adjustedN *= 2;
        }
        return adjustedN;
    });

    // Reduce to lowest terms (find GCD and divide)
    const gcdOfArray = (arr) => arr.reduce((a, b) => gcd(a, b));
    const divisor = gcdOfArray(adjusted);
    const reduced = adjusted.map(n => n / divisor);

    // Sort in ascending order
    reduced.sort((a, b) => a - b);

    // Generate new notation
    return reduced.join(':');
}

// Full CHORD_TYPES including inversions
let CHORD_TYPES = { ...BASE_CHORD_TYPES };

// Map from inversion key -> { baseChord, inversionIndex } for lookup
const INVERSION_INFO = {};

// Add inversions for all chords and auto-generate names (same name as base chord)
for (const [baseName, intervals] of Object.entries(BASE_CHORD_TYPES)) {
    const baseLabel = CHORD_NAMES[baseName] || baseName;
    for (let inv = 1; inv < intervals.length; inv++) {
        const invertedIntervals = generateInversion(baseName, inv);
        const inversionName = getInversionName(baseName, inv);
        if (invertedIntervals && inversionName !== baseName) {
            CHORD_TYPES[inversionName] = invertedIntervals;
            INVERSION_INFO[inversionName] = { baseChord: baseName, inversionIndex: inv };
            // Name inversions as "Major 1st inversion", "Minor 2nd inversion", etc.
            if (!CHORD_NAMES[inversionName]) {
                const ordinals = ['', '1st', '2nd', '3rd', '4th', '5th', '6th'];
                CHORD_NAMES[inversionName] = `${baseLabel} ${ordinals[inv]} inversion`;
            }
        }
    }
}

// Resolve any chord key to its ultimate base chord for grouping purposes
function getBaseChordForGrouping(chordKey) {
    // Strip starting position suffix if present (e.g., "4:5:6_sp1" -> "4:5:6")
    const bareKey = chordKey.includes('_sp') ? chordKey.split('_sp')[0] : chordKey;
    return INVERSION_INFO[bareKey] ? INVERSION_INFO[bareKey].baseChord : bareKey;
}

// Note: Custom "from 3rd/5th" voicings removed - these are now handled by "Random Starting Note" setting

// Custom pedagogical order of base chords (module-level constant)
const CUSTOM_ORDER = [
    '4:5:6',        // Major
    '10:12:15',     // Minor
    '6:7:9',        // Subminor
    '14:18:21',     // Supermajor
    '5:6:7',        // Diminished
    '16:20:25',     // Augmented
    '6:8:9',        // Sus4
    '8:9:12',       // Sus2
    '20:25:30:36',  // Dominant 7th
    '8:10:12:15',   // Major 7th
    '10:12:15:18',  // Minor 7th
    '4:5:6:7',      // Harmonic 7th
    '20:24:30:35',  // Subminor 7th
    '12:15:18:20',  // Major 6th
    '30:36:45:50'   // Minor 6th
];

const TOTAL_BASE_CHORDS = CUSTOM_ORDER.length; // 15

// Count how many unique base chords are represented in a chord list
function countBaseChords(chordList) {
    const seen = new Set();
    for (const chord of chordList) seen.add(getBaseChordForGrouping(chord.key));
    return seen.size;
}

// Get the set of unique base chord keys represented in a chord list
function getUniqueBaseChords(chordList) {
    const seen = new Set();
    for (const chord of chordList) seen.add(getBaseChordForGrouping(chord.key));
    return seen;
}

// Get all variants (inversions, starting positions) for the first N base chords
function getAllVariantsForFirstNBaseChords(n, sortedChords) {
    const targetBases = new Set(CUSTOM_ORDER.slice(0, n));
    return sortedChords.filter(c => targetBases.has(getBaseChordForGrouping(c.key)));
}

// Calculate chord complexity (similar to interval complexity)
function getChordComplexity(chordKey) {
    const intervals = CHORD_TYPES[chordKey];
    if (!intervals) return 0;

    // Complexity = sum of (numerator × denominator) for all intervals in chord
    let complexity = 0;
    for (const interval of intervals) {
        complexity += interval.num * interval.denom;
    }

    // Add bonus complexity for number of notes (larger chords are harder)
    complexity += intervals.length * 10;

    return complexity;
}

// Compute transformed intervals for a chord starting from a given position
// When startingPosition > 0, rebase all intervals relative to that note
function computeTransformedIntervals(chordKey, startingPosition) {
    const baseIntervals = CHORD_TYPES[chordKey];
    if (!baseIntervals) return baseIntervals;
    if (startingPosition === 0) return baseIntervals;

    const referenceInterval = baseIntervals[startingPosition];
    const transformed = baseIntervals.map(interval => {
        const newNum = interval.num * referenceInterval.denom;
        const newDenom = interval.denom * referenceInterval.num;
        const gcdVal = gcd(newNum, newDenom);
        return { num: newNum / gcdVal, denom: newDenom / gcdVal };
    });

    // Sort by value (ascending)
    transformed.sort((a, b) => (a.num / a.denom) - (b.num / b.denom));
    return transformed;
}

// Get position label for a given starting position within a chord
function getPositionLabel(chordKey, startingPosition) {
    if (startingPosition === 0) return '';
    const intervals = CHORD_TYPES[chordKey];
    if (!intervals) return '';
    const positionNames = ['root', '3rd', '5th', '7th', '9th', '11th', '13th'];
    return 'from ' + (positionNames[startingPosition] || (startingPosition + 1) + 'th');
}

// Initialize all chords in custom pedagogical order
// When expandStartingPositions=true, each chord becomes N entries (one per note in the chord),
// with compound keys like "4:5:6_sp0", "4:5:6_sp1", etc.
// When withInversions=false, only base (root position) chords are included.
function initializeChordsSorted(expandStartingPositions, withInversions) {
    if (withInversions === undefined) withInversions = true;

    // Build a flat list of chord keys in order (base + inversions interleaved)
    const orderedChordKeys = [];
    const addedKeys = new Set();

    function collectChordWithInversions(baseKey) {
        if (addedKeys.has(baseKey)) return;
        if (!CHORD_TYPES[baseKey] || !CHORD_NAMES[baseKey]) return;

        orderedChordKeys.push(baseKey);
        addedKeys.add(baseKey);

        if (withInversions) {
            const baseIntervals = BASE_CHORD_TYPES[baseKey];
            if (baseIntervals) {
                for (let inv = 1; inv < baseIntervals.length; inv++) {
                    const invKey = getInversionName(baseKey, inv);
                    if (invKey && invKey !== baseKey && !addedKeys.has(invKey) && CHORD_TYPES[invKey] && CHORD_NAMES[invKey]) {
                        orderedChordKeys.push(invKey);
                        addedKeys.add(invKey);
                    }
                }
            }
        }
    }

    for (const key of CUSTOM_ORDER) {
        collectChordWithInversions(key);
    }

    // Add any remaining chords not yet added
    for (const key of Object.keys(CHORD_TYPES)) {
        if (!addedKeys.has(key) && CHORD_NAMES[key]) {
            // Skip inversions when withInversions is false
            if (!withInversions && INVERSION_INFO[key]) continue;
            orderedChordKeys.push(key);
            addedKeys.add(key);
        }
    }

    // Build allChordsSorted from ordered keys
    allChordsSorted = [];

    for (const chordKey of orderedChordKeys) {
        if (expandStartingPositions) {
            // Create one entry per starting position
            const intervals = CHORD_TYPES[chordKey];
            for (let sp = 0; sp < intervals.length; sp++) {
                const compoundKey = chordKey + '_sp' + sp;
                const posLabel = getPositionLabel(chordKey, sp);
                allChordsSorted.push({
                    key: compoundKey,
                    chordKey: chordKey,
                    startingPosition: sp,
                    expectedIntervals: computeTransformedIntervals(chordKey, sp),
                    intervals: CHORD_TYPES[chordKey],
                    complexity: getChordComplexity(chordKey),
                    name: CHORD_NAMES[chordKey],
                    positionLabel: posLabel
                });
            }
        } else {
            // Single entry per chord (no starting position expansion)
            allChordsSorted.push({
                key: chordKey,
                chordKey: chordKey,
                startingPosition: 0,
                expectedIntervals: CHORD_TYPES[chordKey],
                intervals: CHORD_TYPES[chordKey],
                complexity: getChordComplexity(chordKey),
                name: CHORD_NAMES[chordKey],
                positionLabel: ''
            });
        }
    }

    return allChordsSorted;
}
