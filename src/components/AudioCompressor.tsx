import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Zap,
  ArrowDownRight,
  RotateCcw,
  Volume2,
  Check,
  Sparkles,
  Info,
  Radio,
} from 'lucide-react';
import { AudioFileItem, CompressionSettings, CompressionPreset } from '../types/audio';
import { compressAudioItem, formatBytes } from '../utils/audioUtils';

interface AudioCompressorProps {
  item: AudioFileItem;
  onUpdateItem: (updated: AudioFileItem) => void;
}

const PRESETS_CONFIG: Record<
  Exclude<CompressionPreset, 'custom'>,
  { label: string; description: string; settings: Omit<CompressionSettings, 'preset'> }
> = {
  balanced: {
    label: 'Balanced Web SFX',
    description: '22.05 kHz · Mono · 16-bit WAV (~60% smaller, clear sound)',
    settings: {
      format: 'wav',
      sampleRate: 22050,
      channels: 'mono',
      bitDepth: 16,
      bitrateKbps: 48,
    },
  },
  aggressive: {
    label: 'Compact 8-Bit',
    description: '16 kHz · Mono · 8-bit WAV (~80% smaller, vintage punch)',
    settings: {
      format: 'wav',
      sampleRate: 16000,
      channels: 'mono',
      bitDepth: 8,
      bitrateKbps: 32,
    },
  },
  lofi: {
    label: 'Ultra Opus / WebM',
    description: 'WebM Opus · 48 kbps · Mono (~85% smaller, lossy compressed)',
    settings: {
      format: 'webm',
      sampleRate: 24000,
      channels: 'mono',
      bitDepth: 16,
      bitrateKbps: 48,
    },
  },
  high: {
    label: 'High Fidelity',
    description: '32 kHz · Stereo · 16-bit WAV (~30% smaller, preserve depth)',
    settings: {
      format: 'wav',
      sampleRate: 32000,
      channels: 'stereo',
      bitDepth: 16,
      bitrateKbps: 96,
    },
  },
};

const SAMPLE_RATES = [
  { val: 48000, label: '48.0 kHz' },
  { val: 44100, label: '44.1 kHz' },
  { val: 32000, label: '32.0 kHz' },
  { val: 24000, label: '24.0 kHz' },
  { val: 22050, label: '22.05 kHz' },
  { val: 16000, label: '16.0 kHz' },
  { val: 11025, label: '11.0 kHz' },
  { val: 8000, label: '8.0 kHz' },
];

export const AudioCompressor: React.FC<AudioCompressorProps> = ({
  item,
  onUpdateItem,
}) => {
  const [settings, setSettings] = useState<CompressionSettings>({
    preset: 'balanced',
    format: 'wav',
    sampleRate: 22050,
    channels: 'mono',
    bitDepth: 16,
    bitrateKbps: 48,
  });

  const [isCompressing, setIsCompressing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Apply a preset
  const handleSelectPreset = (preset: CompressionPreset) => {
    if (preset === 'custom') {
      setSettings((prev) => ({ ...prev, preset: 'custom' }));
      setShowAdvanced(true);
      return;
    }

    const config = PRESETS_CONFIG[preset];
    setSettings({
      preset,
      ...config.settings,
    });
  };

  // Run compression
  const handleApplyCompression = async () => {
    setIsCompressing(true);
    setStatusMessage(null);
    try {
      const compressed = await compressAudioItem(item, settings);
      onUpdateItem(compressed);

      const origBytes = item.originalVersion ? item.originalVersion.base64Size : item.base64Size;
      const savedBytes = origBytes - compressed.base64Size;
      const pct = Math.max(0, ((savedBytes / origBytes) * 100)).toFixed(1);

      setStatusMessage(`Compressed! Base64 reduced by ${pct}% (${formatBytes(savedBytes)} saved).`);
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      console.error('Compression failed:', err);
      setStatusMessage('Compression failed. Please try a different preset.');
    } finally {
      setIsCompressing(false);
    }
  };

  // Revert back to original audio version
  const handleRevert = () => {
    if (!item.originalVersion) return;
    const restored: AudioFileItem = {
      ...item,
      name: item.originalVersion.name,
      originalSize: item.originalVersion.originalSize,
      base64Size: item.originalVersion.base64Size,
      sampleRate: item.originalVersion.sampleRate,
      numberOfChannels: item.originalVersion.numberOfChannels,
      mimeType: item.originalVersion.mimeType,
      dataUrl: item.originalVersion.dataUrl,
      base64: item.originalVersion.dataUrl.split('base64,')[1] || '',
      isCompressed: false,
    };
    onUpdateItem(restored);
    setStatusMessage('Restored to original uncompressed file.');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const hasOriginal = Boolean(item.originalVersion && item.isCompressed);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Audio Quality & Resampling Compressor</h3>
            <p className="text-xs text-slate-400">
              Downsample and downmix before Base64 encoding to neutralize the +33% string overhead
            </p>
          </div>
        </div>

        {hasOriginal && (
          <button
            onClick={handleRevert}
            className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/60 rounded-md transition-colors flex items-center gap-1.5 shrink-0"
            title="Revert to original file"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Revert Original</span>
          </button>
        )}
      </div>

      {/* Preset Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {(Object.keys(PRESETS_CONFIG) as (keyof typeof PRESETS_CONFIG)[]).map((key) => {
          const p = PRESETS_CONFIG[key];
          const isSelected = settings.preset === key;

          return (
            <button
              key={key}
              type="button"
              onClick={() => handleSelectPreset(key)}
              className={`text-left p-3 rounded-lg border transition-all ${
                isSelected
                  ? 'bg-indigo-950/40 border-indigo-500/60 shadow-sm shadow-indigo-500/10'
                  : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold ${isSelected ? 'text-indigo-300' : 'text-slate-200'}`}>
                  {p.label}
                </span>
                {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                {p.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Toggle Advanced Controls */}
      <div className="flex items-center justify-between text-xs pt-1">
        <button
          onClick={() => {
            setShowAdvanced(!showAdvanced);
            if (!showAdvanced) {
              setSettings((prev) => ({ ...prev, preset: 'custom' }));
            }
          }}
          className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors flex items-center gap-1"
        >
          <span>{showAdvanced ? 'Hide Custom Sliders' : 'Customize Sample Rate & Channels'}</span>
          <ArrowDownRight className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
        </button>

        <span className="text-slate-500">
          Target: {settings.sampleRate.toLocaleString()} Hz · {settings.channels.toUpperCase()} · {settings.format.toUpperCase()}
        </span>
      </div>

      {/* Advanced Custom Drawer */}
      {showAdvanced && (
        <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-4 space-y-4 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {/* Format Selector */}
            <div className="space-y-1.5">
              <label className="text-slate-400 font-medium">Output Format</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, format: 'wav', preset: 'custom' })}
                  className={`py-1.5 px-2 rounded font-medium border text-center transition-colors ${
                    settings.format === 'wav'
                      ? 'bg-slate-800 text-white border-indigo-500/50'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  WAV (PCM)
                </button>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, format: 'webm', preset: 'custom' })}
                  className={`py-1.5 px-2 rounded font-medium border text-center transition-colors ${
                    settings.format === 'webm'
                      ? 'bg-slate-800 text-white border-indigo-500/50'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  WebM (Opus)
                </button>
              </div>
            </div>

            {/* Channels Selector */}
            <div className="space-y-1.5">
              <label className="text-slate-400 font-medium">Channels</label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, channels: 'mono', preset: 'custom' })}
                  className={`py-1.5 px-2 rounded font-medium border text-center transition-colors ${
                    settings.channels === 'mono'
                      ? 'bg-slate-800 text-white border-indigo-500/50'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                  title="Mixes L and R into 1 channel, cutting sample payload by 50%"
                >
                  Mono (50% cut)
                </button>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, channels: 'stereo', preset: 'custom' })}
                  className={`py-1.5 px-2 rounded font-medium border text-center transition-colors ${
                    settings.channels === 'stereo'
                      ? 'bg-slate-800 text-white border-indigo-500/50'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  Stereo (2 Ch)
                </button>
              </div>
            </div>

            {/* Bit Depth or Bitrate */}
            <div className="space-y-1.5">
              <label className="text-slate-400 font-medium">
                {settings.format === 'wav' ? 'Quantization Bit Depth' : 'Bitrate (kbps)'}
              </label>
              {settings.format === 'wav' ? (
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, bitDepth: 16, preset: 'custom' })}
                    className={`py-1.5 px-2 rounded font-medium border text-center transition-colors ${
                      settings.bitDepth === 16
                        ? 'bg-slate-800 text-white border-indigo-500/50'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    16-bit (Hi-Fi)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, bitDepth: 8, preset: 'custom' })}
                    className={`py-1.5 px-2 rounded font-medium border text-center transition-colors ${
                      settings.bitDepth === 8
                        ? 'bg-slate-800 text-white border-indigo-500/50'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                    title="8-bit unsigned PCM cuts byte size by half"
                  >
                    8-bit (-50%)
                  </button>
                </div>
              ) : (
                <select
                  value={settings.bitrateKbps}
                  onChange={(e) =>
                    setSettings({ ...settings, bitrateKbps: Number(e.target.value), preset: 'custom' })
                  }
                  className="w-full bg-slate-900 border border-slate-800 text-white rounded p-1.5 outline-none font-mono text-xs"
                >
                  <option value={24}>24 kbps (Voice / Lo-Fi)</option>
                  <option value={32}>32 kbps (Compact SFX)</option>
                  <option value={48}>48 kbps (Balanced)</option>
                  <option value={64}>64 kbps (Crisp)</option>
                  <option value={96}>96 kbps (High Quality)</option>
                  <option value={128}>128 kbps (Near Lossless)</option>
                </select>
              )}
            </div>
          </div>

          {/* Sample Rate Grid */}
          <div className="space-y-1.5 pt-1">
            <label className="text-slate-400 font-medium text-xs">
              Sample Rate (Resampled via OfflineAudioContext)
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
              {SAMPLE_RATES.map((sr) => (
                <button
                  key={sr.val}
                  type="button"
                  onClick={() => setSettings({ ...settings, sampleRate: sr.val, preset: 'custom' })}
                  className={`py-1 px-1.5 rounded font-mono tabular-nums text-xs border text-center transition-colors ${
                    settings.sampleRate === sr.val
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  {sr.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Action Strip & Savings Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="text-xs text-slate-400 flex items-center gap-2">
          {item.isCompressed ? (
            <span className="text-emerald-400 flex items-center gap-1 font-medium">
              <Check className="w-3.5 h-3.5" />
              Audio is compressed ({formatBytes(item.originalSize)} · {item.sampleRate.toLocaleString()} Hz)
            </span>
          ) : (
            <span>
              Original uncompressed ({formatBytes(item.originalSize)} · {item.sampleRate.toLocaleString()} Hz)
            </span>
          )}

          {statusMessage && (
            <span className="text-indigo-300 font-medium">{statusMessage}</span>
          )}
        </div>

        <button
          onClick={handleApplyCompression}
          disabled={isCompressing}
          className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 shrink-0"
        >
          {isCompressing ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Resampling & Compressing...</span>
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Compress & Re-encode Base64</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
