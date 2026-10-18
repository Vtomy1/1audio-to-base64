import React from 'react';
import { Volume2, Sparkles, UploadCloud, Mic, ArrowLeftRight } from 'lucide-react';

interface HeaderProps {
  activeTab: 'encoder' | 'decoder';
  setActiveTab: (tab: 'encoder' | 'decoder') => void;
  onOpenRecorder: () => void;
  onOpenPresets: () => void;
  onTriggerUpload: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenRecorder,
  onOpenPresets,
  onTriggerUpload,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark (Single text element) */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Volume2 className="w-4 h-4" />
          </div>
          <a
            href="/"
            className="text-base font-semibold tracking-tight text-white hover:text-indigo-300 transition-colors whitespace-nowrap shrink-0"
          >
            AudioBase64
          </a>
        </div>

        {/* Zone 2: Single-line Navigation Links & Mode Toggles */}
        <nav className="flex items-center gap-1 sm:gap-2 text-sm font-medium">
          <button
            onClick={() => setActiveTab('encoder')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'encoder'
                ? 'bg-slate-800 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5 text-indigo-400" />
            Audio to Base64
          </button>

          <button
            onClick={() => setActiveTab('decoder')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'decoder'
                ? 'bg-slate-800 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-400" />
            Base64 to Audio
          </button>

          <button
            onClick={onOpenPresets}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Preset Sounds
          </button>

          <button
            onClick={onOpenRecorder}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Mic className="w-3.5 h-3.5 text-emerald-400" />
            Record Mic
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onTriggerUpload}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-md shadow-sm transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Upload Audio</span>
            <span className="sm:hidden">Upload</span>
          </button>
        </div>
      </div>
    </header>
  );
};
