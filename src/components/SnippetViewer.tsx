import React, { useState, useMemo } from 'react';
import { Copy, Check, Download, WrapText, FileCode, CheckCheck, Eye, EyeOff } from 'lucide-react';
import { AudioFileItem, SnippetFormat } from '../types/audio';
import { generateSnippet } from '../utils/audioUtils';

interface SnippetViewerProps {
  item: AudioFileItem;
}

const FORMAT_OPTIONS: { id: SnippetFormat; label: string; ext: string }[] = [
  { id: 'data-url', label: 'Data URL', ext: 'txt' },
  { id: 'raw-base64', label: 'Raw Base64', ext: 'txt' },
  { id: 'html-audio', label: 'HTML5 <audio>', ext: 'html' },
  { id: 'js-audio', label: 'JS new Audio()', ext: 'js' },
  { id: 'web-audio-api', label: 'Web Audio API', ext: 'ts' },
  { id: 'react-component', label: 'React / TSX', ext: 'tsx' },
  { id: 'json-payload', label: 'JSON API', ext: 'json' },
  { id: 'python-b64', label: 'Python', ext: 'py' },
  { id: 'howler-js', label: 'Howler.js', ext: 'js' },
];

export const SnippetViewer: React.FC<SnippetViewerProps> = ({ item }) => {
  const [selectedFormat, setSelectedFormat] = useState<SnippetFormat>('data-url');
  const [wrapLines, setWrapLines] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showFullString, setShowFullString] = useState(false);

  // Full snippet for copying/downloading
  const fullSnippet = useMemo(() => {
    return generateSnippet(item, selectedFormat, wrapLines);
  }, [item, selectedFormat, wrapLines]);

  // Preview string capped at 2500 chars unless user clicks expand, to ensure high DOM performance
  const isTruncated = fullSnippet.length > 2500 && !showFullString;
  const displaySnippet = useMemo(() => {
    if (isTruncated) {
      return fullSnippet.slice(0, 2500) + `\n\n/* ... Truncated ${Math.round((fullSnippet.length - 2500) / 1000)}k remaining characters for preview speed. Full string will be copied or downloaded. */`;
    }
    return fullSnippet;
  }, [fullSnippet, isTruncated]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleDownload = () => {
    const option = FORMAT_OPTIONS.find((f) => f.id === selectedFormat);
    const extension = option ? option.ext : 'txt';
    const baseName = item.name.replace(/\.[^/.]+$/, '');
    const filename = `${baseName}.${selectedFormat}.${extension}`;

    const blob = new Blob([fullSnippet], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
      {/* Format Selector Tab Strip */}
      <div className="bg-slate-950/70 border-b border-slate-800 p-2 sm:px-4 flex items-center justify-between gap-4 overflow-x-auto">
        <div className="flex items-center gap-1">
          {FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setSelectedFormat(opt.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
                selectedFormat === opt.id
                  ? 'bg-slate-800 text-white font-semibold shadow-sm border border-slate-700/60'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Quick Toolbar */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setWrapLines(!wrapLines)}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              wrapLines
                ? 'bg-indigo-950/50 text-indigo-300 border-indigo-700/50'
                : 'text-slate-400 hover:text-slate-200 border-slate-800 bg-slate-900'
            }`}
            title="Toggle RFC 2045 line wrapping (76 chars per line)"
          >
            <WrapText className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">RFC 76 Wrap</span>
          </button>

          <button
            onClick={handleDownload}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/60 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap"
            title="Download snippet as file"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Save File</span>
          </button>

          <button
            onClick={handleCopy}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md shadow-sm transition-all flex items-center gap-1.5 whitespace-nowrap ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Snippet</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code Editor Viewport */}
      <div className="relative bg-slate-950 p-4 font-mono text-xs leading-relaxed overflow-x-auto min-h-[220px] max-h-[380px] scrollbar-thin">
        <pre className="text-slate-300 selection:bg-indigo-600/40 whitespace-pre font-mono">
          <code>{displaySnippet}</code>
        </pre>

        {fullSnippet.length > 2500 && (
          <div className="sticky bottom-2 left-2 right-2 mt-4 flex items-center justify-between bg-slate-900/90 backdrop-blur border border-slate-800 rounded-lg p-2.5 px-3">
            <span className="text-slate-400 text-xs">
              Preview shows {isTruncated ? '2,500' : fullSnippet.length.toLocaleString()} of {fullSnippet.length.toLocaleString()} characters
            </span>
            <button
              onClick={() => setShowFullString(!showFullString)}
              className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
            >
              {showFullString ? (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Collapse Preview</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>Expand Full String</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Bottom Status & Info Bar */}
      <div className="bg-slate-950/90 border-t border-slate-800/80 px-4 py-2 flex flex-wrap items-center justify-between text-xs text-slate-500 font-mono tabular-nums">
        <div className="flex items-center gap-2">
          <span>{fullSnippet.length.toLocaleString()} characters</span>
          <span aria-hidden="true" className="text-slate-700">·</span>
          <span>{fullSnippet.split('\n').length.toLocaleString()} lines</span>
          <span aria-hidden="true" className="text-slate-700">·</span>
          <span>UTF-8 / ASCII Safe</span>
        </div>
        <div className="text-slate-400">
          Target: Web & Node.js
        </div>
      </div>
    </div>
  );
};
