import { useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { createPortal } from 'react-dom';

interface Loop {
  loop_id: string;
  name: string;
  segments: Segment[];
  children: Loop[];
}

interface Segment {
  segment_id: string;
  elements: { index: number; value: string; description: string }[];
  raw: string;
  line_number: number;
}

interface ParsedTreeViewerProps {
  loops: Loop[];
  transactionType: string;
}

function SegmentRow({ segment }: { segment: Segment }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-1.5">
      <button onClick={() => setExpanded(!expanded)} className="segment-row-button">
        <span className="w-10 text-xs text-slate-500">{segment.line_number}</span>
        <span className="font-mono text-sm font-bold text-accent">{segment.segment_id}</span>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-400">{segment.raw}</span>
        <span className="text-xs text-slate-500">{expanded ? 'Hide' : 'Show'} elements</span>
      </button>

      {expanded && (
        <div className="surface-panel ml-10 mt-2 overflow-hidden">
          <table className="segment-detail-table text-sm">
            <thead>
              <tr>
                <th className="text-left">Element</th>
                <th className="text-left">Value</th>
                <th className="text-left">Description</th>
              </tr>
            </thead>
            <tbody>
              {segment.elements.map((elem) => (
                <tr key={elem.index} className="table-row">
                  <td className="font-mono text-slate-400">{segment.segment_id}{String(elem.index).padStart(2, '0')}</td>
                  <td className="font-mono text-slate-200">{elem.value || <span className="text-slate-500">empty</span>}</td>
                  <td className="text-slate-400">{elem.description || 'No description available'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function countSegments(loop: Loop): number {
  return loop.segments.length + loop.children.reduce((acc, child) => acc + countSegments(child), 0);
}

function LoopNode({ loop, depth = 0 }: { loop: Loop; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);

  return (
    <div className="tree-node">
      <button onClick={() => setExpanded(!expanded)} className="tree-node-button">
        <span className="text-sm text-slate-300">{expanded ? '-' : '+'}</span>
        <span className="text-sm font-semibold text-slate-100">{loop.loop_id}</span>
        <span className="truncate text-sm text-slate-400">{loop.name}</span>
        <span className="ml-auto text-xs text-slate-500">{countSegments(loop)} segments</span>
      </button>

      {expanded && (
        <div className="animate-fade-in">
          {loop.segments.map((seg, i) => (
            <SegmentRow key={`${seg.segment_id}-${i}`} segment={seg} />
          ))}
          {loop.children.map((child, i) => (
            <LoopNode key={`${child.loop_id}-${i}`} loop={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function getAllSegments(loop: Loop): Segment[] {
  return [...loop.segments, ...loop.children.flatMap(getAllSegments)];
}

export default function ParsedTreeViewer({ loops, transactionType }: ParsedTreeViewerProps) {
  const [viewMode, setViewMode] = useState<'tree' | 'raw'>('tree');
  const [isMaximized, setIsMaximized] = useState(false);
  const totalSegments = loops.reduce((acc, loop) => acc + countSegments(loop), 0);
  const rawLines = loops.flatMap(getAllSegments).map((segment) => segment.raw).join('\n');

  const renderedPanel = (
    <section className={`glass-card panel-card flex flex-col transition-all duration-300 ${isMaximized ? 'w-full max-w-[1400px] h-[90vh] shadow-2xl relative z-10 overflow-y-auto' : ''}`}>
      <div className="panel-header shrink-0">
        <div>
            <h3 className="panel-title">
              Parsed structure
              <span className="badge badge-info">{transactionType}</span>
            </h3>
            <p className="panel-subtitle">Explore loop hierarchy or inspect raw segment rows.</p>
          </div>
          <div className="flex gap-2 items-center">
            <div className="toggle-group">
              <button onClick={() => setViewMode('tree')} className={`toggle-button ${viewMode === 'tree' ? 'active' : ''}`}>
                Tree
              </button>
              <button onClick={() => setViewMode('raw')} className={`toggle-button ${viewMode === 'raw' ? 'active' : ''}`}>
                Raw
              </button>
            </div>
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
              title={isMaximized ? "Restore view" : "Maximize view"}
            >
              {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </div>

      <div className="mb-4 flex flex-wrap gap-3 text-sm text-slate-400">
        <span className="status-chip subtle">{loops.length} loops</span>
        <span className="status-chip subtle">{totalSegments} segments</span>
      </div>

      {viewMode === 'tree' ? (
        <div className="surface-panel max-h-[560px] overflow-y-auto p-3">
          {loops.length > 0 ? loops.map((loop, i) => <LoopNode key={`${loop.loop_id}-${i}`} loop={loop} />) : <div className="empty-state">No parsed loops available yet.</div>}
        </div>
      ) : (
        <pre className="surface-panel max-h-[560px] overflow-y-auto whitespace-pre-wrap p-5 text-sm text-slate-300">{rawLines || 'No raw segment data available.'}</pre>
      )}
      </section>
  );

  if (isMaximized) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
        <div className="absolute inset-0 cursor-pointer" onClick={() => setIsMaximized(false)} />
        {renderedPanel}
      </div>,
      document.body
    );
  }

  return renderedPanel;
}
