import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Repeat,
  Download,
  Check,
  Share2,
} from 'lucide-react';
import { AudioFileItem } from '../types/audio';
import { formatBytes, formatDuration } from '../utils/audioUtils';

interface WaveformPlayerProps {
  item: AudioFileItem;
  onRemove?: () => void;
}

export const WaveformPlayer: React.FC<WaveformPlayerProps> = ({ item }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(item.duration || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Sync duration when item changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(item.duration || 0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.loop = isLooping;
    }
  }, [item.id, item.dataUrl]);

  // Handle Play/Pause
  const togglePlay = async () => {
    if (!audioRef.current) return;
    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        // Setup analyser on first user interaction
        setupAnalyser();
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Audio play error:', err);
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const handleEnded = () => {
    if (!isLooping) {
      setIsPlaying(false);
      setCurrentTime(0);
    }
  };

  const handleRestart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      if (!isPlaying) {
        togglePlay();
      }
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = ratio * (duration || 1);
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
    if (newVol > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.muted = false;
      setIsMuted(false);
    } else {
      audioRef.current.muted = true;
      setIsMuted(true);
    }
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const toggleLoop = () => {
    const next = !isLooping;
    setIsLooping(next);
    if (audioRef.current) {
      audioRef.current.loop = next;
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = item.dataUrl;
    link.download = item.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Web Audio Analyser setup for real-time reactive visualization
  const setupAnalyser = () => {
    if (analyserRef.current || !audioRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = ctx.createMediaElementSource(audioRef.current);
      sourceNodeRef.current = source;
      source.connect(analyser);
      analyser.connect(ctx.destination);
    } catch {
      // Browsers may restrict cross-origin or re-connection, fallback to static waveform
    }
  };

  // Real-time canvas frequency visualizer animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const analyser = analyserRef.current;
      if (analyser && isPlaying) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        const barWidth = (width / bufferLength) * 1.5;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * height * 0.9;
          const gradient = ctx.createLinearGradient(0, height, 0, 0);
          gradient.addColorStop(0, 'rgba(99, 102, 241, 0.2)');
          gradient.addColorStop(1, 'rgba(129, 140, 248, 0.7)');
          ctx.fillStyle = gradient;
          ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
          x += barWidth;
        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying]);

  // Calculate overhead ratio
  const overheadPercentage =
    item.originalSize > 0
      ? (((item.base64Size - item.originalSize) / item.originalSize) * 100).toFixed(1)
      : '33.3';

  const progressRatio = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 space-y-6">
      {/* Audio element */}
      <audio
        ref={audioRef}
        src={item.dataUrl}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        preload="metadata"
      />

      {/* Title & Metadata row - Zero Pill Rule */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <h2 className="text-lg font-semibold text-white tracking-tight truncate max-w-xl">
            {item.name}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1 font-mono tabular-nums">
            <span>{item.mimeType}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>{item.sampleRate.toLocaleString()} Hz</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>{item.numberOfChannels === 1 ? 'Mono' : item.numberOfChannels === 2 ? 'Stereo' : `${item.numberOfChannels} Ch`}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>{formatDuration(item.duration)}</span>
          </div>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleDownload}
            className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 border border-slate-700/60 rounded-md transition-colors flex items-center gap-1.5"
            title="Download source audio file"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {item.isCompressed && item.originalVersion && (
        <div className="bg-emerald-950/30 border border-emerald-900/40 rounded-lg p-3 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-emerald-400 font-semibold">Resampled & Compressed</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-slate-300 font-mono tabular-nums">
              Base64 string reduced from {formatBytes(item.originalVersion.base64Size)} to {formatBytes(item.base64Size)}
            </span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="text-emerald-300 font-mono font-semibold tabular-nums">
              -{(((item.originalVersion.base64Size - item.base64Size) / item.originalVersion.base64Size) * 100).toFixed(1)}% payload reduction
            </span>
          </div>
        </div>
      )}

      {/* Interactive Waveform Display */}
      <div className="space-y-2">
        <div
          onClick={handleSeek}
          className="relative h-24 bg-slate-950/70 border border-slate-800/80 rounded-lg p-2.5 cursor-pointer group flex items-center justify-between overflow-hidden select-none"
        >
          {/* Background real-time frequency visualizer canvas */}
          <canvas
            ref={canvasRef}
            width={600}
            height={96}
            className="absolute inset-0 w-full h-full pointer-events-none opacity-40"
          />

          {/* Static Waveform Peak Bars */}
          <div className="relative z-10 w-full h-full flex items-center justify-between gap-[2px]">
            {item.waveformPeaks.map((peak, index) => {
              const barProgress = index / item.waveformPeaks.length;
              const hasPlayed = barProgress <= progressRatio;

              return (
                <div
                  key={index}
                  className="flex-1 flex flex-col justify-center items-center h-full"
                >
                  <div
                    style={{ height: `${Math.max(10, peak * 100)}%` }}
                    className={`w-full rounded-sm transition-colors duration-75 ${
                      hasPlayed
                        ? 'bg-indigo-400 shadow-sm shadow-indigo-500/30'
                        : 'bg-slate-700/60 group-hover:bg-slate-600/80'
                    }`}
                  />
                </div>
              );
            })}
          </div>

          {/* Scrubber Playhead Line */}
          <div
            style={{ left: `${progressRatio * 100}%` }}
            className="absolute top-0 bottom-0 w-0.5 bg-indigo-300 shadow-md shadow-indigo-500 z-20 pointer-events-none"
          >
            <div className="w-2.5 h-2.5 -ml-1 rounded-full bg-indigo-400 border border-white top-0 relative shadow" />
          </div>
        </div>

        {/* Timestamps */}
        <div className="flex justify-between items-center text-xs font-mono tabular-nums text-slate-400 px-1">
          <span>{formatDuration(currentTime)}</span>
          <span>{formatDuration(duration)}</span>
        </div>
      </div>

      {/* Playback Controls Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
        {/* Left: Transport buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-sm transition-all active:scale-95"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>

          <button
            onClick={handleRestart}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
            title="Replay from start"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={toggleLoop}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              isLooping
                ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white'
            }`}
            title={isLooping ? 'Loop enabled' : 'Enable loop'}
          >
            <Repeat className="w-4 h-4" />
          </button>
        </div>

        {/* Center: Playback Speed selector */}
        <div className="flex items-center gap-1 bg-slate-950/60 border border-slate-800 rounded-lg p-1 text-xs">
          {[0.5, 1, 1.25, 1.5, 2].map((rate) => (
            <button
              key={rate}
              onClick={() => handleRateChange(rate)}
              className={`px-2 py-1 rounded font-mono tabular-nums transition-colors ${
                playbackRate === rate
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>

        {/* Right: Volume slider */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-20 sm:w-28 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>
      </div>

      {/* Metrics & Mathematical Size Breakdown - Single Elevation, Zero Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-800 text-xs">
        <div className="space-y-0.5">
          <div className="text-slate-500">Original File Size</div>
          <div className="text-slate-200 font-mono font-medium tabular-nums">
            {formatBytes(item.originalSize)}
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="text-slate-500">Base64 Encoded Size</div>
          <div className="text-slate-200 font-mono font-medium tabular-nums">
            {formatBytes(item.base64Size)}
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="text-slate-500">Base64 Characters</div>
          <div className="text-slate-200 font-mono font-medium tabular-nums">
            {item.base64Size.toLocaleString()} chars
          </div>
        </div>

        <div className="space-y-0.5">
          <div className="text-slate-500">Encoding Overhead</div>
          <div className="text-amber-400/90 font-mono font-medium tabular-nums">
            +{overheadPercentage}% (4:3 ratio)
          </div>
        </div>
      </div>
    </div>
  );
};
