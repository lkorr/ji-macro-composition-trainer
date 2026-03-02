// ============================================================
// AUDIO SYSTEM
// ============================================================

// Initialize audio context on first user interaction
function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

// Play interval audio
function playIntervalAudio(num, denom) {
    if (!audioContext || !enableSound) return;

    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const now = audioContext.currentTime;

    // Base frequency with optional pitch variation
    let baseFreq = 220; // A3
    if (varyPitch) {
        // Random pitch shift from -500¢ to +1200¢
        const randomCents = -500 + Math.random() * 1700; // 1700 = 1200 - (-500)
        baseFreq = baseFreq * Math.pow(2, randomCents / 1200);
    }

    // Calculate interval frequency
    const cents = 1200 * Math.log2(num / denom);
    const intervalFreq = baseFreq * Math.pow(2, cents / 1200);

    // Play root note
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();

    osc1.type = synthType;
    osc1.frequency.value = baseFreq;
    osc1.connect(gain1);
    gain1.connect(audioContext.destination);

    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + releaseTime);

    osc1.start(now);
    osc1.stop(now + releaseTime);

    // Play interval note
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();

    osc2.type = synthType;
    osc2.frequency.value = intervalFreq;
    osc2.connect(gain2);
    gain2.connect(audioContext.destination);

    gain2.gain.setValueAtTime(0.15, now + 0.3);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3 + releaseTime);

    osc2.start(now + 0.3);
    osc2.stop(now + 0.3 + releaseTime);
}

// Play single tone for chord mode
function playSingleTone(num, denom) {
    if (!audioContext || !enableSound) return;

    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const now = audioContext.currentTime;

    // Base frequency (no pitch variation for chord mode)
    const baseFreq = 220; // A3

    // Calculate frequency for this interval
    const cents = 1200 * Math.log2(num / denom);
    const freq = baseFreq * Math.pow(2, cents / 1200);

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = 'sine'; // Always sine wave for chord mode
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(audioContext.destination);

    const sustainTime = 0.1;
    const relTime = 0.3;
    const totalDuration = sustainTime + relTime;

    // Envelope: instant attack (plucky), sustain, then release
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.setValueAtTime(0.3, now + sustainTime);
    gain.gain.exponentialRampToValueAtTime(0.001, now + totalDuration);

    osc.start(now);
    osc.stop(now + totalDuration);
}

// Play chord audio (all intervals together)
function playChordAudio(intervals) {
    if (!audioContext || !enableSound) return;

    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const now = audioContext.currentTime;

    // Base frequency (no pitch variation for chord mode)
    const baseFreq = 220; // A3

    const duration = 1.0; // Longer duration for chord

    // Play all intervals simultaneously as a chord
    intervals.forEach(interval => {
        const cents = 1200 * Math.log2(interval.num / interval.denom);
        const freq = baseFreq * Math.pow(2, cents / 1200);

        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.type = 'sine'; // Always sine wave for chord mode
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(audioContext.destination);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.start(now);
        osc.stop(now + duration);
    });
}

// Play sound
function playSound(type) {
    if (!audioContext) return;

    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const now = audioContext.currentTime;

    if (type === 'correct') {
        // Single pleasant tone for correct interval
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.frequency.value = 800; // Pleasant high tone
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        osc.start(now);
        osc.stop(now + 0.15);
    } else if (type === 'wrong') {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.linearRampToValueAtTime(140, now + 0.3);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'excellent') {
        // Major chord arpeggio for completing the chord
        const notes = [
            { freq: 523.25, start: 0, duration: 0.15 },
            { freq: 659.25, start: 0.08, duration: 0.15 },
            { freq: 783.99, start: 0.16, duration: 0.2 }
        ];

        notes.forEach(note => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);

            osc.frequency.value = note.freq;
            gain.gain.setValueAtTime(0.2, now + note.start);
            gain.gain.exponentialRampToValueAtTime(0.01, now + note.start + note.duration);

            osc.start(now + note.start);
            osc.stop(now + note.start + note.duration);
        });
    }
}
