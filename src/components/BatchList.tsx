import React from 'react';
import { Play, Trash2, Download, FileAudio, Check, Layers } from 'lucide-react';
import { AudioFileItem } from '../types/audio';
import { formatBytes, formatDuration } from '../utils/audioUtils';

interface BatchListProps {
  items: AudioFileItem[];
  activeId: string | null;
  onSelectItem: (id: string) => void;
  onRemoveItem: (id: string) => void;
  onClearAll: () => void;
}

export const BatchList: React.FC<BatchListProps> = ({
  items,
  activeId,
  onSelectItem,
  onRemoveItem,
  onClearAll,
}) => {
  if (items.length <= 1) return null;

  const handleExportAllJson = () => {
    const bundle: Record<string, { dataUrl: string; mimeType: string; sizeBytes: number; durationSeconds: number }> = {};
    items.forEach((item) => {
      bundle[item.name] = {
        dataUrl: item.dataUrl,
        mimeType: item.mimeType,
        sizeBytes: item.originalSize,
        durationSeconds: Number(item.duration.toFixed(2)),
      };
    });

    const jsonStr = JSON.stringify(bundle, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audio-base64-bundle-${items.length}-files.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">
            Converted Audio Queue ({items.length})
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportAllJson}
            className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/60 rounded-md transition-colors flex items-center gap-1.5"
            title="Download JSON map of all converted audio"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Bundle (JSON)</span>
          </button>

          <button
            onClick={onClearAll}
            className="px-2.5 py-1 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 border border-rose-900/40 rounded-md transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>

      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
        {items.map((item) => {
          const isActive = item.id === activeId;

          return (
            <div
              key={item.id}
              onClick={() => onSelectItem(item.id)}
              className={`group px-3 py-2.5 rounded-lg border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                isActive
                  ? 'bg-slate-800/90 border-indigo-500/60 shadow-sm'
                  : 'bg-slate-950/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                    isActive ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'
                  }`}
                >
                  <FileAudio className="w-3.5 h-3.5" />
                </div>

                <div className="min-w-0">
                  <div className="text-xs font-medium text-white truncate max-w-xs sm:max-w-md">
                    {item.name}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono tabular-nums flex items-center gap-1.5 mt-0.5">
                    <span>{formatBytes(item.originalSize)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDuration(item.duration)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.mimeType.split('/')[1] || item.mimeType}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => onRemoveItem(item.id)}
                  className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded transition-colors"
                  title="Remove from queue"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
