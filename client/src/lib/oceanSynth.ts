// Synthesizes authentic tropical ocean wave soundscape using Web Audio API
// Fully bounded & leak-proof: disconnects all nodes, cancels timers & closes audio contexts

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let noiseSrc: AudioBufferSourceNode | null = null;
let filter: BiquadFilterNode | null = null;
let isPlaying = false;
let waveTimer: any = null;
let fadeTimeout: any = null;

export function toggleOceanSound(onStateChange?: (active: boolean) => void): boolean {
  if (isPlaying) {
    stopOceanSound();
    if (onStateChange) onStateChange(false);
    return false;
  } else {
    startOceanSound();
    if (onStateChange) onStateChange(true);
    return true;
  }
}

export function isOceanPlaying(): boolean {
  return isPlaying;
}

export function startOceanSound(): void {
  try {
    // 1. Teardown any existing active session immediately to guarantee single instance
    stopOceanSound(true);

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    audioCtx = new AudioContextClass();

    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.18, audioCtx.currentTime);
    masterGain.connect(audioCtx.destination);

    // Pink noise buffer generator for deep ocean rumble
    const bufferSize = audioCtx.sampleRate * 4;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      output[i] *= 0.11;
      b6 = white * 0.115926;
    }

    noiseSrc = audioCtx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;
    noiseSrc.loop = true;

    // Lowpass filter modulating like rolling ocean surf
    filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, audioCtx.currentTime);

    noiseSrc.connect(filter);
    filter.connect(masterGain);
    noiseSrc.start();

    isPlaying = true;

    // Modulate filter frequency rhythmically (wave cycle every 5 seconds)
    let up = true;
    waveTimer = setInterval(() => {
      if (!audioCtx || audioCtx.state === 'closed' || !filter) return;
      try {
        const t = audioCtx.currentTime;
        const targetFreq = up ? 850 : 260;
        filter.frequency.exponentialRampToValueAtTime(targetFreq, t + 4.5);
        up = !up;
      } catch {}
    }, 5000);
  } catch (err) {
    console.warn('Web Audio playback initialization error:', err);
    stopOceanSound(true);
  }
}

export function stopOceanSound(immediate = false): void {
  isPlaying = false;

  // Clear recurring wave modulation timer immediately
  if (waveTimer) {
    clearInterval(waveTimer);
    waveTimer = null;
  }

  // Clear any existing fade timeout
  if (fadeTimeout) {
    clearTimeout(fadeTimeout);
    fadeTimeout = null;
  }

  const cleanupNodes = () => {
    try {
      if (noiseSrc) {
        try { noiseSrc.stop(); } catch {}
        try { noiseSrc.disconnect(); } catch {}
        noiseSrc = null;
      }
      if (filter) {
        try { filter.disconnect(); } catch {}
        filter = null;
      }
      if (masterGain) {
        try { masterGain.disconnect(); } catch {}
        masterGain = null;
      }
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
        audioCtx = null;
      }
    } catch (err) {
      console.warn('Audio cleanup warning:', err);
    }
  };

  if (immediate || !masterGain || !audioCtx || audioCtx.state === 'closed') {
    cleanupNodes();
    return;
  }

  try {
    masterGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    fadeTimeout = setTimeout(() => {
      cleanupNodes();
      fadeTimeout = null;
    }, 450);
  } catch {
    cleanupNodes();
  }
}
