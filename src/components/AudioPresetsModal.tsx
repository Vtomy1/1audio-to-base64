import React, { useState } from 'react';
import { Sparkles, Play, Plus, X, Volume2, Check } from 'lucide-react';
import { AudioFileItem, AudioSamplePreset } from '../types/audio';
import { SAMPLE_PRESETS, createItemFromPreset } from '../utils/audioUtils';

interface AudioPresetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPreset: (item: AudioFileItem) => void;
}

export const AudioPresetsModal: React.FC<AudioPresetsModalProps> = ({
  isOpen,
  onClose,
  onSelectPreset,
}) => {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const playPreview = (preset: AudioSamplePreset) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const buffer = preset.generator(ctx);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => {
        setPlayingId(null);
        ctx.close().catch(() => {});
      };
      setPlayingId(preset.id);
      source.start(0);
    } catch (err) {
      console.error('Audio preset playback failed:', err);
      setPlayingId(null);
    }
  };

  const handleImport = async (preset: AudioSamplePreset) => {
    try {
      setLoadingId(preset.id);
      const item = await createItemFromPreset(preset);
      onSelectPreset(item);
      onClose();
    } catch (err) {
      console.error('Failed to import preset:', err);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Preset Sound Library</h3>
              <p className="text-xs text-slate-400">Synthesized audio cues generated directly via Web Audio API</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
          {SAMPLE_PRESETS.map((preset) => {
            const isPlaying = playingId === preset.id;
            const isLoading = loadingId === preset.id;

            return (
              <div
                key={preset.id}
                className="bg-slate-950/60 border border-slate-800/80 hover:border-slate-700/80 rounded-lg p-3.5 flex items-center justify-between gap-4 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => playPreview(preset)}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                      isPlaying
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                    }`}
                    title="Play preview"
                  >
                    <Play className="w-4 h-4 ml-0.5" />
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-white truncate">
                        {preset.name}
                      </h4>
                      <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {preset.durationSeconds}s
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">
                      {preset.description}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleImport(preset)}
                  disabled={isLoading}
                  className="px-3 py-1.5 text-xs font-semibold text-indigo-400 hover:text-white hover:bg-indigo-600 border border-indigo-500/30 rounded-md transition-colors shrink-0 flex items-center gap-1.5"
                >
                  {isLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>Encode</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
