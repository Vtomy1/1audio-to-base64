import React, { useRef, useState } from 'react';
import { UploadCloud, Mic, Sparkles, Music, FileAudio, AlertCircle } from 'lucide-react';

interface AudioUploaderProps {
  onFilesSelected: (files: File[]) => void;
  onOpenRecorder: () => void;
  onOpenPresets: () => void;
  isProcessing: boolean;
}

export const AudioUploader: React.FC<AudioUploaderProps> = ({
  onFilesSelected,
  onOpenRecorder,
  onOpenPresets,
  isProcessing,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const validateAndForwardFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setErrorMessage(null);

    const validFiles: File[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      // Check audio mime or common audio extensions
      const isAudio =
        file.type.startsWith('audio/') ||
        file.type === 'video/webm' ||
        file.type === 'video/ogg' ||
        /\.(mp3|wav|ogg|aac|m4a|flac|webm|weba|opus|wma|aiff)$/i.test(file.name);

      if (isAudio) {
        validFiles.push(file);
      }
    }

    if (validFiles.length === 0) {
      setErrorMessage('Please select valid audio files (.mp3, .wav, .ogg, .aac, .m4a, .flac, .webm).');
      return;
    }

    onFilesSelected(validFiles);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    validateAndForwardFiles(e.dataTransfer.files);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndForwardFiles(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.wav,.ogg,.aac,.m4a,.flac,.webm,.weba,.opus"
        className="hidden"
        id="audio-file-input"
        onChange={handleInputChange}
      />

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative group cursor-pointer border-2 border-dashed rounded-xl p-8 sm:p-12 text-center transition-all ${
          isDragOver
            ? 'border-indigo-500 bg-indigo-950/20 shadow-lg shadow-indigo-500/10'
            : 'border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900'
        }`}
      >
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center group-hover:scale-105 group-hover:border-indigo-500/50 transition-all text-indigo-400">
            {isProcessing ? (
              <div className="w-7 h-7 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <FileAudio className="w-8 h-8" />
            )}
          </div>

          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-semibold text-white tracking-tight">
              {isProcessing
                ? 'Processing & analyzing audio...'
                : 'Drop audio files here, or click to browse'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
              Supports MP3, WAV, OGG, AAC, M4A, FLAC, and WebM. Files are encoded instantly in your browser with zero data leaving your machine.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-colors flex items-center gap-2"
            >
              <UploadCloud className="w-4 h-4" />
              Choose Files
            </button>

            <button
              type="button"
              onClick={onOpenPresets}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-lg transition-colors flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              Try Sound Presets
            </button>

            <button
              type="button"
              onClick={onOpenRecorder}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 rounded-lg transition-colors flex items-center gap-2"
            >
              <Mic className="w-4 h-4 text-emerald-400" />
              Record Microphone
            </button>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-3 flex items-center gap-2 text-xs text-rose-400 bg-rose-950/30 border border-rose-900/50 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
