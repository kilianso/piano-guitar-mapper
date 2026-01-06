// Display settings
let showOctaveNumbers = false;
let showFlats = false;

// Sharp to flat conversion map
const sharpToFlat = {
    'C#': 'Db',
    'D#': 'Eb',
    'F#': 'Gb',
    'G#': 'Ab',
    'A#': 'Bb'
};

// Function to get display note based on settings
function getDisplayNote(note) {
    if (showFlats && sharpToFlat[note]) {
        return sharpToFlat[note];
    }
    return note;
}

// Note frequency mapping (A4 = 440Hz)
const noteFrequencies = {
    'C': [65.41, 130.81, 261.63, 523.25, 1046.50, 2093.00],
    'C#': [69.30, 138.59, 277.18, 554.37, 1108.73, 2217.46],
    'D': [73.42, 146.83, 293.66, 587.33, 1174.66, 2349.32],
    'D#': [77.78, 155.56, 311.13, 622.25, 1244.51, 2489.02],
    'E': [82.41, 164.81, 329.63, 659.25, 1318.51, 2637.02],
    'F': [87.31, 174.61, 349.23, 698.46, 1396.91, 2793.83],
    'F#': [92.50, 185.00, 369.99, 739.99, 1479.98, 2959.96],
    'G': [98.00, 196.00, 392.00, 783.99, 1567.98, 3135.96],
    'G#': [103.83, 207.65, 415.30, 830.61, 1661.22, 3322.44],
    'A': [110.00, 220.00, 440.00, 880.00, 1760.00, 3520.00],
    'A#': [116.54, 233.08, 466.16, 932.33, 1864.66, 3729.31],
    'B': [123.47, 246.94, 493.88, 987.77, 1975.53, 3951.07]
};

// Piano notes from C2 to B6
const pianoNotes = [];
for (let octave = 2; octave <= 6; octave++) {
    ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].forEach(note => {
        pianoNotes.push({ note, octave });
    });
}

// Guitar strings (standard tuning) with their open note positions
// Ordered from high E (top) to low E (bottom)
const guitarStrings = [
    { name: 'e', openNote: 'E', openOctave: 4 },   // High E (1st string)
    { name: 'B', openNote: 'B', openOctave: 3 },   // 2nd string
    { name: 'G', openNote: 'G', openOctave: 3 },   // 3rd string
    { name: 'D', openNote: 'D', openOctave: 3 },   // 4th string
    { name: 'A', openNote: 'A', openOctave: 2 },   // 5th string
    { name: 'E', openNote: 'E', openOctave: 2 }    // Low E (6th string)
];

const numFrets = 24;
const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Audio context for sound generation
let audioContext = null;
let currentSources = [];

function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function stopCurrentNote() {
    if (!currentSources.length || !audioContext) return;
    const now = audioContext.currentTime;
    currentSources.forEach(source => {
        try {
            source.stop(now + 0.01);
        } catch (e) {
            /* no-op */
        }
    });
    currentSources = [];
}

function playNote(note, octave, instrument = 'piano') {
    initAudio();
    stopCurrentNote();

    const frequency = noteFrequencies[note][octave - 2];
    const now = audioContext.currentTime;
    const duration = 0.9;

    // Shared nodes
    const masterGain = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();
    const panner = audioContext.createStereoPanner ? audioContext.createStereoPanner() : null;

    filter.type = 'lowpass';
    filter.Q.value = 0.8;
    filter.frequency.setValueAtTime(9000, now);

    masterGain.connect(filter);
    if (panner) {
        filter.connect(panner);
        panner.pan.value = instrument === 'guitar' ? 0.08 : -0.08;
        panner.connect(audioContext.destination);
    } else {
        filter.connect(audioContext.destination);
    }

    const oscillators = [];
    const gains = [];

    function addOsc(type, freq, gainValue, detune = 0) {
        const osc = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        if (detune) osc.detune.value = detune;
        gainNode.gain.value = gainValue;
        osc.connect(gainNode).connect(masterGain);
        oscillators.push(osc);
        gains.push(gainNode);
    }

    // Piano-ish blend: triangle + soft sine harmonics with tiny detune
    addOsc('triangle', frequency, 0.55, Math.random() * 4 - 2);
    addOsc('sine', frequency * 2, 0.22);
    addOsc('sine', frequency * 3, 0.14);

    // Felt-piano style envelope
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(0.6, now + 0.003);
    masterGain.gain.exponentialRampToValueAtTime(0.24, now + 0.18);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    filter.frequency.exponentialRampToValueAtTime(3200, now + duration * 0.7);

    oscillators.forEach(osc => osc.start(now));
    oscillators.forEach(osc => osc.stop(now + duration));

    currentSources = oscillators;

    // Cleanup after note ends
    const cleanupTime = now + duration + 0.05;
    masterGain.gain.setValueAtTime(masterGain.gain.value, cleanupTime);
    masterGain.gain.linearRampToValueAtTime(0.00001, cleanupTime + 0.02);
    setTimeout(() => {
        masterGain.disconnect();
        filter.disconnect();
        if (panner) panner.disconnect();
    }, (duration + 0.1) * 1000);
}

function getNoteAtFret(stringNote, stringOctave, fret) {
    const startIndex = noteNames.indexOf(stringNote);
    const totalSemitones = fret;
    const newIndex = (startIndex + totalSemitones) % 12;
    const octaveShift = Math.floor((startIndex + totalSemitones) / 12);
    
    return {
        note: noteNames[newIndex],
        octave: stringOctave + octaveShift
    };
}

function highlightNote(targetNote, targetOctave) {
    // Clear existing note highlights without touching toggle active states
    document.querySelectorAll('.piano-key.active, .fret.active').forEach(el => el.classList.remove('active'));

    // Highlight piano keys
    document.querySelectorAll('.piano-key').forEach(key => {
        const note = key.dataset.note;
        const octave = parseInt(key.dataset.octave);
        if (note === targetNote && octave === targetOctave) {
            key.classList.add('active');
        }
    });

    // Highlight guitar frets
    document.querySelectorAll('.fret').forEach(fret => {
        const note = fret.dataset.note;
        const octave = parseInt(fret.dataset.octave);
        if (note === targetNote && octave === targetOctave) {
            fret.classList.add('active');
        }
    });

    // Show info
    showNoteInfo(targetNote, targetOctave);
}

function showNoteInfo(note, octave) {
    const infoTitle = document.getElementById('infoTitle');
    const noteInfo = document.getElementById('noteInfo');

    infoTitle.textContent = `Selected Note: ${note}${octave}`;
    
    // Find all positions on guitar
    const positions = [];
    guitarStrings.forEach((string, stringIndex) => {
        for (let fret = 0; fret <= numFrets; fret++) {
            const fretNote = getNoteAtFret(string.openNote, string.openOctave, fret);
            if (fretNote.note === note && fretNote.octave === octave) {
                positions.push(`${string.name} string, fret ${fret}`);
            }
        }
    });

    noteInfo.textContent = positions.length > 0 
        ? `Found on guitar: ${positions.join(' • ')}`
        : 'Note is outside standard guitar range';
}

// Create piano
function createPiano() {
    const piano = document.getElementById('piano');
    const whiteKeyPattern = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
    
    pianoNotes.forEach((noteData, index) => {
        const { note, octave } = noteData;
        const isBlackKey = note.includes('#');
        
        if (!isBlackKey) {
            const key = document.createElement('div');
            key.className = `piano-key white-key octave-${octave}`;
            key.dataset.note = note;
            key.dataset.octave = octave;
            
            const label = document.createElement('div');
            label.className = 'key-label';
            label.textContent = showOctaveNumbers ? `${note}${octave}` : note;
            key.appendChild(label);
            
            key.addEventListener('click', () => {
                playNote(note, octave, 'piano');
                highlightNote(note, octave);
            });
            
            piano.appendChild(key);
        }
    });

    // Add black keys
    const whiteKeys = piano.querySelectorAll('.white-key');
    pianoNotes.forEach((noteData, index) => {
        const { note, octave } = noteData;
        if (note.includes('#')) {
            const baseNote = note.replace('#', '');
            const whiteKeyIndex = pianoNotes.slice(0, index).filter(n => !n.note.includes('#')).length;
            
            if (whiteKeyIndex > 0 && whiteKeys[whiteKeyIndex - 1]) {
                const key = document.createElement('div');
                key.className = `piano-key black-key octave-${octave}`;
                key.dataset.note = note;
                key.dataset.octave = octave;
                key.style.left = `${(whiteKeyIndex * 53) - 18}px`;
                
                const label = document.createElement('div');
                label.className = 'key-label';
                const displayNote = getDisplayNote(note);
                label.textContent = showOctaveNumbers ? `${displayNote}${octave}` : displayNote;
                key.appendChild(label);
                
                key.addEventListener('click', () => {
                    playNote(note, octave, 'piano');
                    highlightNote(note, octave);
                });
                
                piano.appendChild(key);
            }
        }
    });
}

// Create guitar
function createGuitar() {
    const guitar = document.getElementById('guitar');
    const fretNumbers = document.getElementById('fretNumbers');

    // Create fret numbers
    for (let i = 0; i <= numFrets; i++) {
        const num = document.createElement('div');
        num.className = 'fret-number';
        num.textContent = i;
        fretNumbers.appendChild(num);
    }

    // Create strings
    guitarStrings.forEach((string, stringIndex) => {
        const stringDiv = document.createElement('div');
        stringDiv.className = 'string';

        const label = document.createElement('div');
        label.className = 'string-label';
        label.textContent = string.name;
        stringDiv.appendChild(label);

        for (let fret = 0; fret <= numFrets; fret++) {
            const fretNote = getNoteAtFret(string.openNote, string.openOctave, fret);
            const fretDiv = document.createElement('div');
            fretDiv.className = `fret octave-${fretNote.octave}`;
            fretDiv.dataset.note = fretNote.note;
            fretDiv.dataset.octave = fretNote.octave;
            const displayNote = getDisplayNote(fretNote.note);
            fretDiv.textContent = showOctaveNumbers ? `${displayNote}${fretNote.octave}` : displayNote;

            fretDiv.addEventListener('click', () => {
                playNote(fretNote.note, fretNote.octave, 'guitar');
                highlightNote(fretNote.note, fretNote.octave);
            });

            stringDiv.appendChild(fretDiv);
        }

        guitar.appendChild(stringDiv);
    });
}

// Initialize
createPiano();
createGuitar();

// Get container references
const pianoContainer = document.querySelector('.piano-container');
const guitarContainer = document.querySelector('.guitar-container');

// Synchronized scrolling between piano and guitar
let syncScrollFrame = null;
let isSyncingScroll = false;

function syncScroll(source, target) {
    if (isSyncingScroll) return;

    if (syncScrollFrame) {
        cancelAnimationFrame(syncScrollFrame);
    }

    syncScrollFrame = requestAnimationFrame(() => {
        const sourceMaxScroll = source.scrollWidth - source.clientWidth;
        const targetMaxScroll = target.scrollWidth - target.clientWidth;

        if (sourceMaxScroll > 0 && targetMaxScroll > 0) {
            isSyncingScroll = true;
            const scrollRatio = source.scrollLeft / sourceMaxScroll;
            target.scrollLeft = Math.round(scrollRatio * targetMaxScroll);

            // Give Safari a moment to settle to avoid re-entrancy from mirrored scroll
            setTimeout(() => {
                isSyncingScroll = false;
            }, 0);
        } else {
            isSyncingScroll = false;
        }

        syncScrollFrame = null;
    });
}

pianoContainer.addEventListener('scroll', () => {
    syncScroll(pianoContainer, guitarContainer);
});

guitarContainer.addEventListener('scroll', () => {
    syncScroll(guitarContainer, pianoContainer);
});

// Scroll slider for horizontal scrolling
const scrollSlider = document.getElementById('scrollSlider');
let isSliderChanging = false;
let sliderUpdateFrame = null;

// Update slider when containers scroll (throttled with rAF)
function updateSliderFromScroll() {
    if (isSliderChanging) return;
    if (sliderUpdateFrame) return; // Already scheduled
    
    sliderUpdateFrame = requestAnimationFrame(() => {
        const maxScroll = pianoContainer.scrollWidth - pianoContainer.clientWidth;
        if (maxScroll > 0) {
            const scrollPercentage = (pianoContainer.scrollLeft / maxScroll) * 100;
            scrollSlider.value = scrollPercentage;
        }
        sliderUpdateFrame = null;
    });
}

pianoContainer.addEventListener('scroll', updateSliderFromScroll);
guitarContainer.addEventListener('scroll', updateSliderFromScroll);

// Update containers when slider moves
scrollSlider.addEventListener('input', (e) => {
    isSliderChanging = true;
    
    const percentage = e.target.value / 100;
    const maxScroll = pianoContainer.scrollWidth - pianoContainer.clientWidth;
    pianoContainer.scrollLeft = percentage * maxScroll;
    
    // Reset flag after a short delay
    setTimeout(() => {
        isSliderChanging = false;
    }, 50);
});

// Update all note displays based on settings
function updateNoteDisplay() {
    // Update piano keys
    document.querySelectorAll('.piano-key').forEach(key => {
        const note = key.dataset.note;
        const octave = key.dataset.octave;
        const label = key.querySelector('.key-label');
        const displayNote = getDisplayNote(note);
        label.textContent = showOctaveNumbers ? `${displayNote}${octave}` : displayNote;
    });

    // Update guitar frets
    document.querySelectorAll('.fret').forEach(fret => {
        const note = fret.dataset.note;
        const octave = fret.dataset.octave;
        const displayNote = getDisplayNote(note);
        fret.textContent = showOctaveNumbers ? `${displayNote}${octave}` : displayNote;
    });
}

// Toggle helpers
const octaveToggle = document.getElementById('octaveToggle');
const flatToggle = document.getElementById('flatToggle');

function setToggleActive(toggleEl, active) {
    if (toggleEl) {
        toggleEl.classList.toggle('active', active);
        if (toggleEl.parentElement?.classList.contains('toggle-container')) {
            toggleEl.parentElement.classList.toggle('active', active);
        }
    }
}

const octaveContainer = octaveToggle ? octaveToggle.parentElement : null;
const flatContainer = flatToggle ? flatToggle.parentElement : null;

octaveContainer?.addEventListener('click', () => {
    showOctaveNumbers = !showOctaveNumbers;
    setToggleActive(octaveToggle, showOctaveNumbers);
    updateNoteDisplay();
});

flatContainer?.addEventListener('click', () => {
    showFlats = !showFlats;
    setToggleActive(flatToggle, showFlats);
    updateNoteDisplay();
});

// Clear selection and reset info box
const defaultInfoTitle = 'Play a note';
const defaultInfoText = 'Click a note to hear and see where it appears.';

function clearSelection() {
    document.querySelectorAll('.piano-key.active, .fret.active').forEach(el => el.classList.remove('active'));
    const infoTitle = document.getElementById('infoTitle');
    const noteInfo = document.getElementById('noteInfo');
    if (infoTitle) infoTitle.textContent = defaultInfoTitle;
    if (noteInfo) noteInfo.textContent = defaultInfoText;
}

document.addEventListener('click', (event) => {
    const insidePiano = event.target.closest('.piano-container');
    const insideGuitar = event.target.closest('.guitar-container');
    const insideToggle = event.target.closest('.toggle-container');
    if (!insidePiano && !insideGuitar && !insideToggle) {
        clearSelection();
    }
});

// Theme toggle (light/dark) - prefers-color-scheme handled via CSS; JS only applies overrides and syncs toggle
const themeToggle = document.getElementById('themeToggle');
const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
let userTheme = null; // null = follow system/CSS

function applyTheme(theme) {
    document.documentElement.classList.remove('theme-dark', 'theme-light');
    if (theme === 'dark') {
        document.documentElement.classList.add('theme-dark');
    } else if (theme === 'light') {
        document.documentElement.classList.add('theme-light');
    }
    const isDark = theme === 'dark' || (theme === null && systemPrefersDark);
    setToggleActive(themeToggle, isDark);
}

// Initialize (follow system unless user toggles)
applyTheme(userTheme);

if (themeToggle) {
    const themeContainer = themeToggle.parentElement;
    themeContainer?.addEventListener('click', () => {
        const currentIsDark = themeToggle.classList.contains('active');
        userTheme = currentIsDark ? 'light' : 'dark';
        applyTheme(userTheme);
    });
}
