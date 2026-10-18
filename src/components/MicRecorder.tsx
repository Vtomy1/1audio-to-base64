import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, X, AlertCircle, Volume2, RefreshCw } from 'lucide-react';
import { AudioFileItem } from '../types/audio';
import { processAudioFile } from '../utils/audioUtils';

interface MicRecorderProps {
  isOpen: boolean;
  onClose: () => void;
  onAudioRecorded: (item: AudioFileItem) => void;
}

export const MicRecorder: React.FC<MicRecorderProps> = ({
  isOpen,
  onClose,
  onAudioRecorded,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopRecordingAndCleanup();
    }
  }, [isOpen]);

  const startVisualizer = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const canvasCtx = canvas.getContext('2d');
      if (!canvasCtx) return;

      const draw = () => {
        const width = canvas.width;
        const height = canvas.height;
        canvasCtx.clearRect(0, 0, width, height);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        const barWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * height * 0.9;
          const gradient = canvasCtx.createLinearGradient(0, height, 0, 0);
          gradient.addColorStop(0, '#10b981');
          gradient.addColorStop(1, '#6ee7b7');
          canvasCtx.fillStyle = gradient;
          canvasCtx.fillRect(x, height - barHeight, barWidth - 1.5, barHeight);
          x += barWidth;
        }

        animFrameRef.current = requestAnimationFrame(draw);
      };

      draw();
    } catch (err) {
      console.warn('Microphone visualizer initialization failed:', err);
    }
  };

  const startRecording = async () => {
    setErrorMessage(null);
    audioChunksRef.current = [];
    setDuration(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Select supported mime type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const ext = mimeType.includes('ogg') ? 'ogg' : 'webm';
        const file = new File(
          [audioBlob],
          `mic-recording-${new Date().toISOString().slice(11, 19).replace(/:/g, '-')}.${ext}`,
          { type: mimeType }
        );

        try {
          const item = await processAudioFile(file);
          onAudioRecorded(item);
          onClose();
        } catch (err) {
          setErrorMessage('Failed to process recorded audio.');
        } finally {
          setIsProcessing(false);
          stopRecordingAndCleanup();
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setIsPaused(false);
      startVisualizer(stream);

      // Duration counter
      const startTime = Date.now();
      timerIntervalRef.current = window.setInterval(() => {
        setDuration(Math.floor((Date.now() - startTime) / 100) / 10);
      }, 100);
    } catch (err) {
      setErrorMessage(
        'Unable to access microphone. Please ensure microphone permissions are granted in your browser.'
      );
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        setIsPaused(false);
      } else {
        mediaRecorderRef.current.pause();
        setIsPaused(true);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
  };

  const stopRecordingAndCleanup = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setIsRecording(false);
    setIsPaused(false);
    setDuration(0);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Mic className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Live Microphone Recorder</h3>
              <p className="text-xs text-slate-400">Record spoken audio and encode directly to Base64</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Visualizer & Timer Display */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-4 flex flex-col items-center justify-center min-h-[140px] space-y-3">
          <canvas
            ref={canvasRef}
            width={320}
            height={60}
            className="w-full h-14 rounded opacity-90"
          />

          <div className="text-2xl font-mono font-semibold tabular-nums text-white tracking-wider">
            {Math.floor(duration / 60)}:{(duration % 60).toFixed(1).padStart(4, '0')}
          </div>

          <div className="text-xs text-slate-400">
            {isRecording
              ? isPaused
                ? 'Recording paused'
                : 'Recording live audio...'
              : 'Ready to record microphone audio'}
          </div>
        </div>

        {errorMessage && (
          <div className="flex items-start gap-2 text-xs text-rose-400 bg-rose-950/30 border border-rose-900/50 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 pt-2">
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={isProcessing}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg shadow-sm transition-colors flex items-center gap-2"
            >
              <Mic className="w-4 h-4" />
              <span>Start Recording</span>
            </button>
          ) : (
            <>
              <button
                onClick={pauseRecording}
                className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/60 rounded-lg transition-colors flex items-center gap-1.5"
              >
                {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                <span>{isPaused ? 'Resume' : 'Pause'}</span>
              </button>

              <button
                onClick={stopRecording}
                disabled={isProcessing}
                className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>Finish & Encode</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
