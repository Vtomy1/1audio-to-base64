import { AudioFileItem, AudioSamplePreset, SnippetFormat } from '../types/audio';

/**
 * Format bytes to human readable format (KB, MB, etc.)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Format duration in seconds to mm:ss or s.ms
 */
export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  if (mins === 0) {
    return `${secs}.${ms}s`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Downsample audio buffer to 70-100 peak bars for waveform visualization
 */
export function extractPeaks(audioBuffer: AudioBuffer, targetPeaks = 80): number[] {
  const channelData = audioBuffer.getChannelData(0);
  const totalLength = channelData.length;
  const blockSize = Math.floor(totalLength / targetPeaks);
  const peaks: number[] = [];

  for (let i = 0; i < targetPeaks; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, totalLength);
    let max = 0;
    for (let j = start; j < end; j++) {
      const val = Math.abs(channelData[j]);
      if (val > max) max = val;
    }
    // Floor at 0.08 for clean visual presentation
    peaks.push(Math.max(0.08, Math.min(1, max)));
  }

  return peaks;
}

/**
 * Extract audio metadata (duration, sample rate, channels, waveform peaks)
 * using the Web Audio API AudioContext
 */
export async function decodeAudioMetadata(
  arrayBuffer: ArrayBuffer
): Promise<{
  duration: number;
  sampleRate: number;
  numberOfChannels: number;
  peaks: number[];
}> {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    // Clone arrayBuffer because decodeAudioData detaches it
    const clonedBuffer = arrayBuffer.slice(0);
    const decoded = await ctx.decodeAudioData(clonedBuffer);
    const peaks = extractPeaks(decoded);
    return {
      duration: decoded.duration,
      sampleRate: decoded.sampleRate,
      numberOfChannels: decoded.numberOfChannels,
      peaks,
    };
  } catch (err) {
    console.warn('Audio decodeAudioData metadata parse failed:', err);
    // Return graceful fallback
    return {
      duration: 0,
      sampleRate: 44100,
      numberOfChannels: 2,
      peaks: Array.from({ length: 60 }, (_, i) => 0.2 + 0.6 * Math.abs(Math.sin(i * 0.2))),
    };
  } finally {
    ctx.close().catch(() => {});
  }
}

/**
 * Convert a File object to an AudioFileItem
 */
export async function processAudioFile(file: File): Promise<AudioFileItem> {
  const arrayBuffer = await file.arrayBuffer();
  const metadata = await decodeAudioMetadata(arrayBuffer);

  // Convert arrayBuffer to Base64
  let binary = '';
  const bytes = new Uint8Array(arrayBuffer);
  const len = bytes.byteLength;
  const chunkSize = 0x8000;
  for (let i = 0; i < len; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, Math.min(i + chunkSize, len)) as unknown as number[]
    );
  }
  const rawBase64 = window.btoa(binary);
  const mimeType = file.type || 'audio/mpeg';
  const dataUrl = `data:${mimeType};base64,${rawBase64}`;

  return {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    name: file.name,
    originalSize: file.size,
    mimeType,
    base64: rawBase64,
    dataUrl,
    base64Size: rawBase64.length,
    duration: metadata.duration,
    sampleRate: metadata.sampleRate,
    numberOfChannels: metadata.numberOfChannels,
    createdAt: Date.now(),
    waveformPeaks: metadata.peaks,
  };
}

/**
 * Encode an AudioBuffer into standard 16-bit or 8-bit PCM WAV Blob
 */
export function audioBufferToWavBlob(buffer: AudioBuffer, bitDepth: 16 | 8 = 16): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const length = buffer.length * blockAlign;
  const wavBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(wavBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  /* RIFF identifier */
  writeString(0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + length, true);
  /* RIFF type */
  writeString(8, 'WAVE');
  /* format chunk identifier */
  writeString(12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw PCM) */
  view.setUint16(20, format, true);
  /* channel count */
  view.setUint16(22, numChannels, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * blockAlign, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, blockAlign, true);
  /* bits per sample */
  view.setUint16(34, bitDepth, true);
  /* data chunk identifier */
  writeString(36, 'data');
  /* data chunk length */
  view.setUint32(40, length, true);

  // Interleave channels & write samples
  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = channels[ch][i];
      // clamp
      sample = Math.max(-1, Math.min(1, sample));

      if (bitDepth === 8) {
        // 8-bit unsigned PCM: 0..255 with 128 as silence
        const uintSample = Math.max(0, Math.min(255, Math.floor((sample + 1) * 127.5)));
        view.setUint8(offset, uintSample);
        offset += 1;
      } else {
        // 16-bit signed PCM
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

/**
 * Resample and/or downmix an AudioBuffer using OfflineAudioContext
 */
export async function resampleAndDownmixBuffer(
  audioBuffer: AudioBuffer,
  targetSampleRate: number,
  targetChannels: 1 | 2
): Promise<AudioBuffer> {
  const targetLength = Math.max(1, Math.ceil(audioBuffer.duration * targetSampleRate));
  const offlineCtx = new OfflineAudioContext(
    targetChannels,
    targetLength,
    targetSampleRate
  );

  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  return await offlineCtx.startRendering();
}

/**
 * Encode an AudioBuffer into compressed WebM/Opus Blob using MediaRecorder
 */
export async function compressToOpusBlob(
  audioBuffer: AudioBuffer,
  bitrateKbps = 48
): Promise<Blob> {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  const dest = ctx.createMediaStreamDestination();
  const source = ctx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(dest);

  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
    ? 'audio/ogg;codecs=opus'
    : 'audio/webm';

  const recorder = new MediaRecorder(dest.stream, {
    mimeType,
    audioBitsPerSecond: bitrateKbps * 1000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      ctx.close().catch(() => {});
      resolve(new Blob(chunks, { type: mimeType }));
    };
    recorder.onerror = (e) => {
      ctx.close().catch(() => {});
      reject(e);
    };

    recorder.start(10);
    source.start(0);
    source.onended = () => {
      setTimeout(() => {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      }, 70);
    };
  });
}

/**
 * Compress an existing AudioFileItem based on user compression settings
 */
export async function compressAudioItem(
  item: AudioFileItem,
  settings: import('../types/audio').CompressionSettings
): Promise<AudioFileItem> {
  // Decode original or current dataUrl
  const response = await fetch(item.dataUrl);
  const arrayBuffer = await response.arrayBuffer();

  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  const originalAudioBuffer = await ctx.decodeAudioData(arrayBuffer);
  await ctx.close().catch(() => {});

  let targetChannels: 1 | 2 = 1;
  if (settings.channels === 'stereo') {
    targetChannels = 2;
  } else if (settings.channels === 'mono') {
    targetChannels = 1;
  } else {
    targetChannels = originalAudioBuffer.numberOfChannels > 1 ? 2 : 1;
  }

  // Resample and downmix
  const resampledBuffer = await resampleAndDownmixBuffer(
    originalAudioBuffer,
    settings.sampleRate,
    targetChannels
  );

  let outputBlob: Blob;
  let filename = item.name.replace(/\.[^/.]+$/, '');

  if (settings.format === 'webm') {
    outputBlob = await compressToOpusBlob(resampledBuffer, settings.bitrateKbps);
    filename += `_compressed_${settings.bitrateKbps}k.webm`;
  } else {
    outputBlob = audioBufferToWavBlob(resampledBuffer, settings.bitDepth);
    const bitLabel = settings.bitDepth === 8 ? '8bit' : '16bit';
    const rateLabel = Math.round(settings.sampleRate / 1000) + 'k';
    const chLabel = targetChannels === 1 ? 'mono' : 'stereo';
    filename += `_${rateLabel}_${chLabel}_${bitLabel}.wav`;
  }

  const file = new File([outputBlob], filename, { type: outputBlob.type });
  const processed = await processAudioFile(file);

  return {
    ...processed,
    id: item.id,
    isCompressed: true,
    originalVersion: item.originalVersion || {
      name: item.name,
      originalSize: item.originalSize,
      base64Size: item.base64Size,
      sampleRate: item.sampleRate,
      numberOfChannels: item.numberOfChannels,
      mimeType: item.mimeType,
      dataUrl: item.dataUrl,
    },
  };
}

/**
 * Built-in Synthesized Audio Samples (Glass Bell, UI Pop, 808 Kick, Poly Synth Chord, Success Chime)
 */
export const SAMPLE_PRESETS: AudioSamplePreset[] = [
  {
    id: 'preset-glass-bell',
    name: 'Glass Notification Bell',
    description: 'Crisp, high-pitched metallic ping suitable for push alerts',
    category: 'chime',
    durationSeconds: 1.2,
    generator: (ctx: AudioContext) => {
      const sampleRate = ctx.sampleRate;
      const duration = 1.2;
      const buffer = ctx.createBuffer(2, sampleRate * duration, sampleRate);
      const ch0 = buffer.getChannelData(0);
      const ch1 = buffer.getChannelData(1);

      for (let i = 0; i < buffer.length; i++) {
        const t = i / sampleRate;
        const decay = Math.exp(-t * 4.5);
        // Harmonic frequencies
        const s1 = Math.sin(2 * Math.PI * 1760 * t) * 0.5;
        const s2 = Math.sin(2 * Math.PI * 3520 * t) * 0.25;
        const s3 = Math.sin(2 * Math.PI * 5280 * t) * 0.12;
        const sample = (s1 + s2 + s3) * decay * 0.8;
        ch0[i] = sample;
        ch1[i] = sample * 0.95;
      }
      return buffer;
    },
  },
  {
    id: 'preset-ui-pop',
    name: 'Modern UI Pop',
    description: 'Subtle, tactile sound effect for button clicks and toggles',
    category: 'ui',
    durationSeconds: 0.18,
    generator: (ctx: AudioContext) => {
      const sampleRate = ctx.sampleRate;
      const duration = 0.18;
      const buffer = ctx.createBuffer(2, sampleRate * duration, sampleRate);
      const ch0 = buffer.getChannelData(0);
      const ch1 = buffer.getChannelData(1);

      for (let i = 0; i < buffer.length; i++) {
        const t = i / sampleRate;
        const freq = 650 - t * 2400; // rapid drop
        const decay = Math.exp(-t * 28);
        const sample = Math.sin(2 * Math.PI * Math.max(80, freq) * t) * decay * 0.7;
        ch0[i] = sample;
        ch1[i] = sample;
      }
      return buffer;
    },
  },
  {
    id: 'preset-success-chime',
    name: 'Ascending Success Chime',
    description: 'Uplifting two-note harmonious completion cue (C6 to G6)',
    category: 'chime',
    durationSeconds: 0.8,
    generator: (ctx: AudioContext) => {
      const sampleRate = ctx.sampleRate;
      const duration = 0.8;
      const buffer = ctx.createBuffer(2, sampleRate * duration, sampleRate);
      const ch0 = buffer.getChannelData(0);
      const ch1 = buffer.getChannelData(1);

      for (let i = 0; i < buffer.length; i++) {
        const t = i / sampleRate;
        let note = 0;
        if (t < 0.18) {
          const dt = t;
          const decay = Math.exp(-dt * 6);
          note = Math.sin(2 * Math.PI * 1046.5 * dt) * decay * 0.6; // C6
        } else {
          const dt = t - 0.18;
          const decay = Math.exp(-dt * 4);
          note = Math.sin(2 * Math.PI * 1567.98 * dt) * decay * 0.6; // G6
        }
        ch0[i] = note;
        ch1[i] = note;
      }
      return buffer;
    },
  },
  {
    id: 'preset-808-kick',
    name: '808 Sub Kick',
    description: 'Deep punchy bass impulse for games and interactive audio',
    category: 'synth',
    durationSeconds: 0.6,
    generator: (ctx: AudioContext) => {
      const sampleRate = ctx.sampleRate;
      const duration = 0.6;
      const buffer = ctx.createBuffer(2, sampleRate * duration, sampleRate);
      const ch0 = buffer.getChannelData(0);
      const ch1 = buffer.getChannelData(1);

      for (let i = 0; i < buffer.length; i++) {
        const t = i / sampleRate;
        const pitch = 55 + 180 * Math.exp(-t * 30);
        const decay = Math.exp(-t * 7);
        let sample = Math.sin(2 * Math.PI * pitch * t) * decay * 0.85;
        // subtle soft saturation
        sample = Math.tanh(sample * 1.4);
        ch0[i] = sample;
        ch1[i] = sample;
      }
      return buffer;
    },
  },
  {
    id: 'preset-ambient-pad',
    name: 'Lush Ambient Chord',
    description: 'Smooth ethereal major pad sweep with gentle stereo panning',
    category: 'ambient',
    durationSeconds: 2.2,
    generator: (ctx: AudioContext) => {
      const sampleRate = ctx.sampleRate;
      const duration = 2.2;
      const buffer = ctx.createBuffer(2, sampleRate * duration, sampleRate);
      const ch0 = buffer.getChannelData(0);
      const ch1 = buffer.getChannelData(1);

      // Frequencies for Fmaj7 (F3, A3, C4, E4)
      const freqs = [174.61, 220.0, 261.63, 329.63];

      for (let i = 0; i < buffer.length; i++) {
        const t = i / sampleRate;
        // Envelope: attack 0.4s, decay
        const env = t < 0.4 ? t / 0.4 : Math.exp(-(t - 0.4) * 1.5);
        let sLeft = 0;
        let sRight = 0;
        freqs.forEach((f, idx) => {
          const phase = idx * 0.7;
          const osc = Math.sin(2 * Math.PI * f * t + phase);
          sLeft += osc * (0.15 + 0.05 * Math.sin(t * 2 + idx));
          sRight += osc * (0.15 + 0.05 * Math.cos(t * 2 + idx));
        });
        ch0[i] = sLeft * env * 0.7;
        ch1[i] = sRight * env * 0.7;
      }
      return buffer;
    },
  },
];

/**
 * Generate AudioFileItem from a preset
 */
export async function createItemFromPreset(preset: AudioSamplePreset): Promise<AudioFileItem> {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  const buffer = preset.generator(ctx);
  const blob = audioBufferToWavBlob(buffer);
  const file = new File([blob], `${preset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.wav`, {
    type: 'audio/wav',
  });
  await ctx.close().catch(() => {});
  return processAudioFile(file);
}

/**
 * Wrap text to lines (RFC 2045: 76 chars)
 */
export function wrapString(str: string, maxLen = 76): string {
  if (str.length <= maxLen) return str;
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += maxLen) {
    chunks.push(str.substring(i, i + maxLen));
  }
  return chunks.join('\n');
}

/**
 * Generate code snippet based on selected format
 */
export function generateSnippet(item: AudioFileItem, format: SnippetFormat, wrap = false): string {
  const base64Str = wrap ? wrapString(item.base64, 76) : item.base64;
  const dataUrlStr = wrap ? wrapString(item.dataUrl, 76) : item.dataUrl;
  const safeVarName = item.name
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .toUpperCase();

  switch (format) {
    case 'data-url':
      return dataUrlStr;

    case 'raw-base64':
      return base64Str;

    case 'html-audio':
      return `<!-- HTML5 Audio Element with embedded Base64 -->\n<audio controls preload="auto">\n  <source src="${dataUrlStr}" type="${item.mimeType}" />\n  Your browser does not support the audio element.\n</audio>`;

    case 'js-audio':
      return `// Instantiate and play instantly in Vanilla JavaScript / TypeScript\nconst ${safeVarName}_AUDIO = "${dataUrlStr}";\n\nfunction play${safeVarName.charAt(0) + safeVarName.slice(1).toLowerCase()}() {\n  const sound = new Audio(${safeVarName}_AUDIO);\n  sound.volume = 1.0;\n  sound.play().catch(err => console.error("Playback blocked or failed:", err));\n}`;

    case 'web-audio-api':
      return `// Decode Base64 into Web Audio API AudioBuffer for low-latency playback & effects\nconst ${safeVarName}_DATA_URL = "${dataUrlStr}";\n\nasync function get${safeVarName.charAt(0) + safeVarName.slice(1).toLowerCase()}Buffer(audioCtx: AudioContext): Promise<AudioBuffer> {\n  const response = await fetch(${safeVarName}_DATA_URL);\n  const arrayBuffer = await response.arrayBuffer();\n  return await audioCtx.decodeAudioData(arrayBuffer);\n}\n\n// Usage example:\n// const ctx = new (window.AudioContext || window.webkitAudioContext)();\n// const buffer = await get${safeVarName.charAt(0) + safeVarName.slice(1).toLowerCase()}Buffer(ctx);\n// const source = ctx.createBufferSource();\n// source.buffer = buffer;\n// source.connect(ctx.destination);\n// source.start(0);`;

    case 'react-component':
      return `import React, { useRef } from 'react';\n\n// Embedded audio asset\nconst AUDIO_DATA = "${dataUrlStr}";\n\nexport function SoundButton() {\n  const audioRef = useRef<HTMLAudioElement | null>(null);\n\n  const handlePlay = () => {\n    if (audioRef.current) {\n      audioRef.current.currentTime = 0;\n      audioRef.current.play().catch(console.error);\n    }\n  };\n\n  return (\n    <button\n      onClick={handlePlay}\n      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-500 active:scale-95 transition"\n    >\n      Play Sound\n      <audio ref={audioRef} src={AUDIO_DATA} preload="auto" />\n    </button>\n  );\n}`;

    case 'json-payload':
      return JSON.stringify(
        {
          name: item.name,
          mimeType: item.mimeType,
          originalSizeBytes: item.originalSize,
          base64SizeBytes: item.base64Size,
          durationSeconds: Number(item.duration.toFixed(2)),
          sampleRateHz: item.sampleRate,
          channels: item.numberOfChannels,
          dataUrl: dataUrlStr,
        },
        null,
        2
      );

    case 'python-b64':
      return `# Python: Decode and save Base64 audio to file\nimport base64\n\naudio_b64 = """${base64Str}"""\n\n# Decode and write to disk\nwith open("${item.name.replace(/\.[^/.]+$/, '')}_decoded.${item.mimeType.includes('wav') ? 'wav' : 'mp3'}", "wb") as f:\n    f.write(base64.b64decode(audio_b64))\n\nprint("Audio successfully decoded and saved.")`;

    case 'howler-js':
      return `// Howler.js audio snippet with Base64 data URI\nimport { Howl } from 'howler';\n\nconst sound = new Howl({\n  src: ['${dataUrlStr}'],\n  format: ['${item.mimeType.split('/')[1] || 'mp3'}'],\n  volume: 0.8,\n  autoplay: false,\n  onplay: () => console.log('Sound started playing'),\n});\n\n// Play sound\n// sound.play();`;

    default:
      return dataUrlStr;
  }
}

/**
 * Validate and parse a Base64 string for the Decoder View
 */
export function parseBase64AudioInput(input: string): {
  isValid: boolean;
  error?: string;
  mimeType: string;
  cleanBase64: string;
  dataUrl: string;
} {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      isValid: false,
      error: 'Input is empty. Paste a Base64 string or Data URL.',
      mimeType: 'audio/mpeg',
      cleanBase64: '',
      dataUrl: '',
    };
  }

  let mimeType = 'audio/mpeg';
  let cleanBase64 = trimmed;

  // Check if it has data URL prefix: data:audio/...;base64,...
  const dataUrlMatch = trimmed.match(/^data:([^;]+);base64,(.+)$/s);
  if (dataUrlMatch) {
    mimeType = dataUrlMatch[1];
    cleanBase64 = dataUrlMatch[2].replace(/\s+/g, '');
  } else {
    // Strip whitespace, newlines, quotes
    cleanBase64 = trimmed.replace(/[\s"']/g, '');
    // Try to guess mime if known signatures or standard
    if (cleanBase64.startsWith('UklGR')) {
      mimeType = 'audio/wav'; // "RIFF"
    } else if (cleanBase64.startsWith('SUQz') || cleanBase64.startsWith('//NI') || cleanBase64.startsWith('//NE')) {
      mimeType = 'audio/mp3'; // ID3 tag or MP3 sync frame
    } else if (cleanBase64.startsWith('OggS')) {
      mimeType = 'audio/ogg'; // OggS
    } else if (cleanBase64.startsWith('GkXfo')) {
      mimeType = 'audio/webm'; // WebM/Matroska EBML
    } else if (cleanBase64.startsWith('fLaC')) {
      mimeType = 'audio/flac'; // FLAC
    }
  }

  // Validate Base64 characters
  const validBase64Pattern = /^[A-Za-z0-9+/]+={0,2}$/;
  if (!validBase64Pattern.test(cleanBase64)) {
    return {
      isValid: false,
      error: 'Invalid Base64 characters detected. Must contain only A-Z, a-z, 0-9, +, / and = padding.',
      mimeType,
      cleanBase64,
      dataUrl: '',
    };
  }

  try {
    // Test decode sample
    window.atob(cleanBase64.slice(0, 100));
  } catch (err) {
    return {
      isValid: false,
      error: 'Malformed Base64 encoding: ' + (err as Error).message,
      mimeType,
      cleanBase64,
      dataUrl: '',
    };
  }

  return {
    isValid: true,
    mimeType,
    cleanBase64,
    dataUrl: `data:${mimeType};base64,${cleanBase64}`,
  };
}
