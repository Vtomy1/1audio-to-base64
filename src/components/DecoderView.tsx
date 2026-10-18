import React, { useState } from 'react';
import {
  Play,
  Pause,
  Download,
  AlertCircle,
  FileCode,
  Sparkles,
  RotateCcw,
  Volume2,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { parseBase64AudioInput, formatBytes, formatDuration, decodeAudioMetadata, extractPeaks } from '../utils/audioUtils';
import { SAMPLE_PRESETS, createItemFromPreset } from '../utils/audioUtils';

export const DecoderView: React.FC = () => {
  const [inputBase64, setInputBase64] = useState('');
  const [decodedItem, setDecodedItem] = useState<{
    dataUrl: string;
    mimeType: string;
    sizeBytes: number;
    duration: number;
    peaks: number[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const handleDecode = async (textToDecode = inputBase64) => {
    setError(null);
    if (!textToDecode.trim()) {
      setError('Please enter or paste a Base64 string or Data URI.');
      return;
    }

    setIsDecoding(true);
    try {
      const parsed = parseBase64AudioInput(textToDecode);
      if (!parsed.isValid) {
        setError(parsed.error || 'Invalid Base64 audio string.');
        setIsDecoding(false);
        return;
      }

      // Convert data URL to ArrayBuffer for audio metadata inspection
      const res = await fetch(parsed.dataUrl);
      const arrayBuffer = await res.arrayBuffer();
      const meta = await decodeAudioMetadata(arrayBuffer);

      setDecodedItem({
        dataUrl: parsed.dataUrl,
        mimeType: parsed.mimeType,
        sizeBytes: arrayBuffer.byteLength,
        duration: meta.duration,
        peaks: meta.peaks,
      });
      setIsPlaying(false);
      setCurrentTime(0);
    } catch (err) {
      setError('Failed to decode audio: The Base64 string might not be valid audio data.');
      console.error(err);
    } finally {
      setIsDecoding(false);
    }
  };

  const loadDemoBase64 = async () => {
    setIsLoadingDemo(true);
    setError(null);
    try {
      // Create a preset item and grab its dataUrl
      const item = await createItemFromPreset(SAMPLE_PRESETS[0]);
      setInputBase64(item.dataUrl);
      await handleDecode(item.dataUrl);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingDemo(false);
    }
  };

  const handleClear = () => {
    setInputBase64('');
    setDecodedItem(null);
    setError(null);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch((e) => {
        console.error('Play error:', e);
        setIsPlaying(false);
      });
    }
  };

  const handleDownloadDecoded = () => {
    if (!decodedItem) return;
    const ext = decodedItem.mimeType.split('/')[1] || 'wav';
    const link = document.createElement('a');
    link.href = decodedItem.dataUrl;
    link.download = `decoded-audio.${ext.includes('mpeg') ? 'mp3' : ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const progressRatio =
    decodedItem && decodedItem.duration > 0
      ? Math.min(1, currentTime / decodedItem.duration)
      : 0;

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-base font-semibold text-white tracking-tight">
              Base64 to Audio Decoder & Player
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Paste a raw Base64 string or Data URI (<code>data:audio/...;base64,...</code>) to test, play, and recover the original audio file.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={loadDemoBase64}
              disabled={isLoadingDemo}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/60 rounded-md transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Load Demo Base64</span>
            </button>

            {inputBase64 && (
              <button
                onClick={handleClear}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-400 rounded-md transition-colors"
                title="Clear input"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Input Textarea */}
        <div className="space-y-2">
          <textarea
            value={inputBase64}
            onChange={(e) => setInputBase64(e.target.value)}
            placeholder="Paste your Base64 string here (e.g. data:audio/mp3;base64,//uQxAAAAA... or raw base64)..."
            rows={5}
            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg p-3 font-mono text-xs text-slate-200 placeholder-slate-600 outline-none resize-y leading-relaxed"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <div className="font-mono tabular-nums">
              {inputBase64.length.toLocaleString()} characters entered
            </div>

            <button
              onClick={() => handleDecode()}
              disabled={isDecoding || !inputBase64.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg shadow-sm transition-colors flex items-center gap-2"
            >
              {isDecoding ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Decoding...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Decode & Play</span>
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-950/30 border border-rose-900/50 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Decoded Audio Output Player */}
      {decodedItem && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 space-y-5 animate-in fade-in duration-200">
          <audio
            ref={audioRef}
            src={decodedItem.dataUrl}
            onTimeUpdate={() => {
              if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
            }}
            onEnded={() => {
              setIsPlaying(false);
              setCurrentTime(0);
            }}
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">
                  Audio Successfully Decoded
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 font-mono tabular-nums">
                <span>{decodedItem.mimeType}</span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>{formatBytes(decodedItem.sizeBytes)} raw audio</span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>{formatDuration(decodedItem.duration)} duration</span>
              </div>
            </div>

            <button
              onClick={handleDownloadDecoded}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-md shadow-sm transition-colors flex items-center gap-1.5 shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Audio File</span>
            </button>
          </div>

          {/* Waveform Scrubber */}
          <div className="space-y-2">
            <div
              onClick={(e) => {
                if (!audioRef.current || !decodedItem.duration) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const targetTime = ratio * decodedItem.duration;
                audioRef.current.currentTime = targetTime;
                setCurrentTime(targetTime);
              }}
              className="relative h-20 bg-slate-950 border border-slate-800 rounded-lg p-2.5 cursor-pointer flex items-center justify-between gap-[2px] overflow-hidden select-none group"
            >
              {decodedItem.peaks.map((peak, idx) => {
                const barProgress = idx / decodedItem.peaks.length;
                const hasPlayed = barProgress <= progressRatio;
                return (
                  <div key={idx} className="flex-1 flex flex-col justify-center items-center h-full">
                    <div
                      style={{ height: `${Math.max(12, peak * 100)}%` }}
                      className={`w-full rounded-sm transition-colors ${
                        hasPlayed
                          ? 'bg-indigo-400'
                          : 'bg-slate-700/60 group-hover:bg-slate-600'
                      }`}
                    />
                  </div>
                );
              })}

              <div
                style={{ left: `${progressRatio * 100}%` }}
                className="absolute top-0 bottom-0 w-0.5 bg-indigo-300 pointer-events-none"
              />
            </div>

            <div className="flex justify-between items-center text-xs font-mono tabular-nums text-slate-400 px-1">
              <span>{formatDuration(currentTime)}</span>
              <span>{formatDuration(decodedItem.duration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="w-10 h-10 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-sm transition-all active:scale-95"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>

            <button
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.currentTime = 0;
                  setCurrentTime(0);
                  if (!isPlaying) togglePlay();
                }
              }}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
              title="Restart"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
