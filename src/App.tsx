import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { AudioUploader } from './components/AudioUploader';
import { WaveformPlayer } from './components/WaveformPlayer';
import { SnippetViewer } from './components/SnippetViewer';
import { BatchList } from './components/BatchList';
import { MicRecorder } from './components/MicRecorder';
import { AudioPresetsModal } from './components/AudioPresetsModal';
import { DecoderView } from './components/DecoderView';
import { AudioCompressor } from './components/AudioCompressor';
import { AudioFileItem } from './types/audio';
import { processAudioFile, createItemFromPreset, SAMPLE_PRESETS } from './utils/audioUtils';
import { Code2, Cpu, Zap, Info, ShieldCheck } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'encoder' | 'decoder'>('encoder');
  const [audioItems, setAudioItems] = useState<AudioFileItem[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecorderOpen, setIsRecorderOpen] = useState(false);
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);

  // Load initial sample sound on first load so users immediately see a working state
  useEffect(() => {
    let mounted = true;
    createItemFromPreset(SAMPLE_PRESETS[0])
      .then((item) => {
        if (mounted) {
          setAudioItems([item]);
          setActiveItemId(item.id);
        }
      })
      .catch((err) => console.warn('Could not auto-load initial sample:', err));

    return () => {
      mounted = false;
    };
  }, []);

  const handleFilesSelected = async (files: File[]) => {
    setIsProcessing(true);
    try {
      const newItems: AudioFileItem[] = [];
      for (const file of files) {
        const item = await processAudioFile(file);
        newItems.push(item);
      }
      setAudioItems((prev) => [...newItems, ...prev]);
      if (newItems.length > 0) {
        setActiveItemId(newItems[0].id);
      }
    } catch (err) {
      console.error('Error processing audio files:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectPreset = (item: AudioFileItem) => {
    setAudioItems((prev) => [item, ...prev]);
    setActiveItemId(item.id);
  };

  const handleAudioRecorded = (item: AudioFileItem) => {
    setAudioItems((prev) => [item, ...prev]);
    setActiveItemId(item.id);
  };

  const handleUpdateItem = (updated: AudioFileItem) => {
    setAudioItems((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
  };

  const handleRemoveItem = (id: string) => {
    setAudioItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      if (activeItemId === id) {
        setActiveItemId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
  };

  const handleClearAll = () => {
    setAudioItems([]);
    setActiveItemId(null);
  };

  const triggerUploadInput = () => {
    if (activeTab !== 'encoder') {
      setActiveTab('encoder');
    }
    const input = document.getElementById('audio-file-input') as HTMLInputElement | null;
    if (input) {
      input.click();
    }
  };

  const activeItem = audioItems.find((item) => item.id === activeItemId) || audioItems[0] || null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 3-Zone Top Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenRecorder={() => setIsRecorderOpen(true)}
        onOpenPresets={() => setIsPresetsOpen(true)}
        onTriggerUpload={triggerUploadInput}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Hero Section */}
        <section className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white text-balance max-w-2xl">
            {activeTab === 'encoder'
              ? 'Convert Audio Files into Clean Base64 Strings'
              : 'Decode Base64 Strings to Playable Audio'}
          </h1>
          <p className="text-sm text-slate-400 max-w-3xl leading-relaxed">
            {activeTab === 'encoder'
              ? 'Embed audio directly into your HTML, React components, JavaScript game loops, or API payloads with zero external server dependencies.'
              : 'Validate Base64 audio encodings, preview the audio waveform in browser, inspect MIME signatures, and export the reconstructed audio file.'}
          </p>
        </section>

        {activeTab === 'encoder' ? (
          <div className="space-y-8">
            {/* Uploader Card */}
            <AudioUploader
              onFilesSelected={handleFilesSelected}
              onOpenRecorder={() => setIsRecorderOpen(true)}
              onOpenPresets={() => setIsPresetsOpen(true)}
              isProcessing={isProcessing}
            />

            {/* Batch Queue (visible if multiple files) */}
            <BatchList
              items={audioItems}
              activeId={activeItemId}
              onSelectItem={(id) => setActiveItemId(id)}
              onRemoveItem={handleRemoveItem}
              onClearAll={handleClearAll}
            />

            {/* Active Item Workspace */}
            {activeItem && (
              <div className="space-y-8">
                {/* Audio Compressor & Optimization Control */}
                <AudioCompressor
                  item={activeItem}
                  onUpdateItem={handleUpdateItem}
                />

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  {/* Left Column: Player & Analysis */}
                  <div className="lg:col-span-6 space-y-6">
                    <WaveformPlayer
                      key={activeItem.id + '-' + activeItem.base64Size}
                      item={activeItem}
                      onRemove={() => handleRemoveItem(activeItem.id)}
                    />
                  </div>

                  {/* Right Column: Code Snippets & Exports */}
                  <div className="lg:col-span-6 space-y-6">
                    <SnippetViewer item={activeItem} />
                  </div>
                </div>
              </div>
            )}

            {/* Developer Best Practices Guide */}
            <div className="border-t border-slate-900 pt-8 mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-400">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-200 font-semibold">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>Instant Zero-Latency Playback</span>
                </div>
                <p className="leading-relaxed">
                  Inlining short sound effects (UI clicks, game chimes, notifications) prevents extra HTTP network round-trips and eliminates audio latency.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-200 font-semibold">
                  <Cpu className="w-4 h-4 text-indigo-400" />
                  <span>The 33% Size Trade-Off</span>
                </div>
                <p className="leading-relaxed">
                  Base64 encodes 3 binary bytes into 4 ASCII characters, incurring a mathematical ~33.3% payload expansion. Best suited for sounds under 500 KB.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-200 font-semibold">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>100% Client-Side Privacy</span>
                </div>
                <p className="leading-relaxed">
                  All encoding, decoding, and waveform synthesis executes locally in your browser using standard Web APIs. No audio data ever leaves your device.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <DecoderView />
          </div>
        )}
      </main>

      {/* Modals */}
      <MicRecorder
        isOpen={isRecorderOpen}
        onClose={() => setIsRecorderOpen(false)}
        onAudioRecorded={handleAudioRecorded}
      />

      <AudioPresetsModal
        isOpen={isPresetsOpen}
        onClose={() => setIsPresetsOpen(false)}
        onSelectPreset={handleSelectPreset}
      />

      {/* Quiet Footer */}
      <footer className="border-t border-slate-900 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span>AudioBase64 Developer Utility</span>
            <span aria-hidden="true">·</span>
            <span>Client-side Web Audio & Base64 Encoder</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span>RFC 2045 & Data URI compliant</span>
            <span aria-hidden="true">·</span>
            <span>Web Audio API</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
