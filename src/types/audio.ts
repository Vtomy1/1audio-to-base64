export interface AudioFileItem {
  id: string;
  name: string;
  originalSize: number;
  mimeType: string;
  base64: string; // raw base64 without prefix
  dataUrl: string; // with data:audio/...;base64,
  base64Size: number;
  duration: number; // in seconds
  sampleRate: number;
  numberOfChannels: number;
  createdAt: number;
  waveformPeaks: number[];
  isCompressed?: boolean;
  originalVersion?: {
    name: string;
    originalSize: number;
    base64Size: number;
    sampleRate: number;
    numberOfChannels: number;
    mimeType: string;
    dataUrl: string;
  };
}

export type CompressionPreset = 'balanced' | 'aggressive' | 'lofi' | 'high' | 'custom';

export interface CompressionSettings {
  preset: CompressionPreset;
  format: 'wav' | 'webm';
  sampleRate: number; // 48000, 44100, 32000, 24000, 22050, 16000, 11025, 8000
  channels: 'mono' | 'stereo' | 'original';
  bitDepth: 16 | 8; // for WAV
  bitrateKbps: number; // for WebM/Opus: 24, 32, 48, 64, 96, 128
}

export type SnippetFormat =
  | 'data-url'
  | 'raw-base64'
  | 'html-audio'
  | 'js-audio'
  | 'web-audio-api'
  | 'react-component'
  | 'json-payload'
  | 'python-b64'
  | 'howler-js';

export interface AudioSamplePreset {
  id: string;
  name: string;
  description: string;
  category: 'chime' | 'ui' | 'synth' | 'ambient';
  durationSeconds: number;
  generator: (ctx: AudioContext) => AudioBuffer;
}
