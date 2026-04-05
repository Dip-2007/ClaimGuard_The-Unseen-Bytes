import React, { useState, useRef, useMemo } from 'react';
import { motion, useInView } from 'framer-motion';
import { Maximize2, Minimize2 } from 'lucide-react';
import { createPortal } from 'react-dom';

const formatEdi = (content: string) => {
  if (!content || content.length < 106) return content;
  const term = content[105];
  const segments = content.split(term).map(s => s.trim()).filter(s => s.length > 0);
  return segments.join(term + '\n') + term + '\n';
};

interface AnimatedItemProps {
  children: React.ReactNode;
  delay?: number;
  index: number;
}

const AnimatedItem: React.FC<AnimatedItemProps> = ({ children, delay = 0, index }) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.1, once: false });
  return (
    <motion.div
      ref={ref}
      data-index={index}
      initial={{ scale: 0.7, opacity: 0 }}
      animate={inView ? { scale: 1, opacity: 1 } : { scale: 0.7, opacity: 0 }}
      transition={{ duration: 0.2, delay }}
    >
      {children}
    </motion.div>
  );
};

interface ValidationError {
  error_id: string;
  severity: string;
  segment_id: string;
  element_index: number;
  loop_location: string;
  line_number: number;
  message: string;
  suggestion: string;
  fixable: boolean;
  fix_value: string;
}

interface ValidationPanelProps {
  validation: {
    is_valid: boolean;
    error_count: number;
    warning_count: number;
    info_count: number;
    errors: ValidationError[];
  };
  onFix: (errorId: string, fixValue: string, lineNumber: number, elementIndex: number) => void;
  onFixAll: () => void;
  onRawEdit: (newContent: string) => void;
  onSaveProgress?: () => void;
  rawContent: string;
  initialRawContent?: string;
}

const severityClass: Record<string, string> = {
  error: 'severity-error',
  warning: 'severity-warning',
  info: 'severity-info',
};

const severityBadgeClass: Record<string, string> = {
  error: 'badge-error',
  warning: 'badge-warning',
  info: 'badge-info',
};

export default function ValidationPanel({ validation, onFix, onFixAll, onRawEdit, onSaveProgress, rawContent, initialRawContent }: ValidationPanelProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [manualFixId, setManualFixId] = useState<string | null>(null);
  const [manualFixValue, setManualFixValue] = useState<string>('');
  const [aiExplanations, setAiExplanations] = useState<Record<string, string>>({});
  const [loadingAi, setLoadingAi] = useState<Record<string, boolean>>({});
  const [isEditingRaw, setIsEditingRaw] = useState(false);
  const [editableRawContent, setEditableRawContent] = useState('');

  const [topGradientOpacity, setTopGradientOpacity] = useState<number>(0);
  const [bottomGradientOpacity, setBottomGradientOpacity] = useState<number>(1);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target as HTMLDivElement;
    setTopGradientOpacity(Math.min(scrollTop / 50, 1));
    const bottomDistance = scrollHeight - (scrollTop + clientHeight);
    setBottomGradientOpacity(scrollHeight <= clientHeight ? 0 : Math.min(bottomDistance / 50, 1));
  };

  const gutterRef = useRef<HTMLDivElement>(null);

  const errorsByLine = useMemo(() => {
    const map: Record<number, ValidationError[]> = {};
    validation.errors.forEach(e => {
      if (e.line_number > 0) {
        if (!map[e.line_number]) map[e.line_number] = [];
        map[e.line_number].push(e);
      }
    });
    return map;
  }, [validation.errors]);

  const originalLines = useMemo(() => {
    const baseContent = initialRawContent || rawContent;
    return formatEdi(baseContent).split('\n');
  }, [initialRawContent, rawContent]);

  // Build a unique key per error instance to avoid AI response collisions
  const errKey = (err: ValidationError) => `${err.error_id}__L${err.line_number}__E${err.element_index}`;

  const handleManualFixClick = async (err: ValidationError) => {
    const key = errKey(err);
    setManualFixId(key);
    setManualFixValue('');
    if (!aiExplanations[key]) {
      setLoadingAi((prev) => ({ ...prev, [key]: true }));
      try {
        // Extract the actual erroneous line from the raw content for precise AI context
        const ediLines = formatEdi(rawContent).split('\n');
        const errLineContent = err.line_number > 0 && err.line_number <= ediLines.length
          ? ediLines[err.line_number - 1]
          : '(line not found)';
        // Also grab surrounding lines for context
        const surroundStart = Math.max(0, err.line_number - 4);
        const surroundEnd = Math.min(ediLines.length, err.line_number + 3);
        const surroundingLines = ediLines.slice(surroundStart, surroundEnd)
          .map((l, i) => `Line ${surroundStart + i + 1}${surroundStart + i + 1 === err.line_number ? ' >>> ' : ':    '}${l}`)
          .join('\n');

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `You are an expert X12 EDI 5010 validator. A validation error was found:\n\n- Error ID: ${err.error_id}\n- Segment: ${err.segment_id}\n- Element Index: ${err.element_index}\n- Line Number: ${err.line_number}\n- Severity: ${err.severity}\n- Message: ${err.message}\n- Suggestion: ${err.suggestion || 'None'}\n\nThe erroneous line is:\n\`${errLineContent}\`\n\nSurrounding context:\n\`\`\`\n${surroundingLines}\n\`\`\`\n\nBased on HIPAA 5010 rules, explain in 1-2 short sentences exactly what is wrong and what value element ${err.element_index} should contain. Then on a NEW LINE write exactly:\nRECOMMENDED_VALUE: <the exact literal value to inject>\nCONFIDENCE: <percentage>`,
            context: rawContent
          }),
        });
        const data = await res.json();
        setAiExplanations((prev) => ({ ...prev, [key]: data.reply }));
      } catch {
        setAiExplanations((prev) => ({ ...prev, [key]: 'AI explanation currently unavailable.' }));
      } finally {
        setLoadingAi((prev) => ({ ...prev, [key]: false }));
      }
    }
  };

  const filtered = validation.errors.filter((error) => filter === 'all' || error.severity === filter);
  const fixableCount = validation.errors.filter((error) => error.fixable).length;

  const renderedPanel = (
    <section className={`glass-card panel-card flex flex-col transition-all duration-300 ${isMaximized ? 'w-full max-w-[1400px] h-[90vh] shadow-2xl relative z-10 overflow-y-auto' : ''}`}>
      <div className="panel-header shrink-0">
        <div>
          <h3 className="panel-title font-bold">
            Validation results
            <span className={`badge ${validation.is_valid ? 'badge-success' : 'badge-warning'}`}>
              {validation.is_valid ? 'Passing' : 'Needs attention'}
            </span>
          </h3>
          <p className="panel-subtitle">Filter findings, inspect context, and apply deterministic corrections.</p>
        </div>
        <div className="flex gap-2">
          {!isEditingRaw && onSaveProgress && (
            <button 
              onClick={onSaveProgress} 
              style={{
                background: 'rgba(84, 208, 255, 0.1)', border: '1px solid rgba(84, 208, 255, 0.2)',
                borderRadius: 10, padding: '6px 12px', color: '#54d0ff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 700,
                fontFamily: 'inherit', transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(84, 208, 255, 0.18)';
                e.currentTarget.style.borderColor = 'rgba(84, 208, 255, 0.35)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(84, 208, 255, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(84, 208, 255, 0.2)';
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
              Save Progress
            </button>
          )}
          {!isEditingRaw && (
            <button 
              onClick={() => { setEditableRawContent(formatEdi(rawContent)); setIsEditingRaw(true); }} 
              className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5 border-indigo-500/30 text-indigo-300"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              Edit Raw Source
            </button>
          )}
          {fixableCount > 0 && !isEditingRaw && (
            <button 
              onClick={onFixAll} 
              style={{
                background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.2)',
                borderRadius: 10, padding: '6px 12px', color: '#4ade80', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 700,
                fontFamily: 'inherit', transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(74, 222, 128, 0.18)';
                e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.35)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(74, 222, 128, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.2)';
              }}
            >
              Fix all ({fixableCount})
            </button>
          )}
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
            title={isMaximized ? "Restore view" : "Maximize view"}
          >
            {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      {isEditingRaw ? (
        <div className="flex flex-col gap-4 animate-fade-in mt-4">
          <div className="relative w-full h-[500px] bg-[#0B1120] border border-slate-700/50 rounded-xl flex overflow-hidden font-mono text-sm shadow-inner">
            
            <div className="flex-none w-12 bg-[#0d1426] border-r border-slate-700/50 select-none overflow-hidden relative z-20">
               <div ref={gutterRef} className="absolute top-0 left-0 w-full text-slate-500 text-right py-4 px-2 whitespace-pre will-change-transform" style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: '12px', lineHeight: '24px' }}>
                  {editableRawContent.split('\n').map((_, i) => i + 1).join('\n')}
               </div>
            </div>

            <div 
              className="relative flex-grow overflow-auto bg-[#0a0f1c]" 
              onScroll={(e) => {
                if (gutterRef.current) {
                  gutterRef.current.style.transform = `translate3d(0, -${e.currentTarget.scrollTop}px, 0)`;
                }
              }}
            >
              <div className="relative min-w-max w-full">
                
                <div className="pt-4 pointer-events-none whitespace-pre pb-12" style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: '14px', lineHeight: '24px', letterSpacing: '0px' }}>
                  {editableRawContent.split('\n').map((line, i) => {
                    const lineNum = i + 1;
                    const errs = errorsByLine[lineNum] || [];
                    const elemSep = editableRawContent.length > 3 ? editableRawContent[3] : '*';
                    
                    const origLine = originalLines[i] || '';
                    const origParts = origLine.split(elemSep);

                    const hasFullLineError = errs.some(e => e.severity === 'error' && e.element_index <= 0);
                    const hasFullLineWarn = errs.some(e => e.severity === 'warning' && e.element_index <= 0);

                    const lineBgClass = hasFullLineError ? "bg-red-500/10" : hasFullLineWarn ? "bg-amber-500/10" : "bg-transparent";
                    const borderColor = hasFullLineError ? "border-red-500/40" : hasFullLineWarn ? "border-amber-500/40" : "border-transparent";

                    if (line === '') {
                      return <div key={i} className={`border-l-2 ${borderColor} ${lineBgClass} pl-[14px] pr-4 text-transparent whitespace-pre flex w-max min-w-full`} style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: '14px', height: '24px', lineHeight: '24px', letterSpacing: '0px' }}> </div>;
                    }

                    const parts = line.split(elemSep);

                    return (
                      <div key={i} className={`border-l-2 ${borderColor} ${lineBgClass} pl-[14px] pr-4 text-transparent whitespace-pre flex w-max min-w-full`} style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: '14px', height: '24px', lineHeight: '24px', letterSpacing: '0px' }}>
                        {parts.map((part, pIdx) => {
                          const isErr = errs.some(e => e.severity === 'error' && (e.element_index === pIdx || (pIdx === 0 && e.element_index <= 0)));
                          const isWarn = errs.some(e => e.severity === 'warning' && (e.element_index === pIdx || (pIdx === 0 && e.element_index <= 0)));
                          
                          const origPart = origParts[pIdx];
                          const isModified = origPart !== undefined && part !== origPart;
                          
                          const partBg = isErr ? "bg-red-500/40 rounded-sm shadow-[0_0_8px_rgba(239,68,68,0.4)]" : 
                                         isWarn ? "bg-amber-500/40 rounded-sm shadow-[0_0_8px_rgba(245,158,11,0.4)]" :
                                         isModified ? "bg-green-500/40 rounded-sm shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-transparent";

                          return (
                            <span key={pIdx}><span className={partBg}>{part}</span>{pIdx < parts.length - 1 ? <span className="bg-transparent">{elemSep}</span> : null}</span>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                <textarea
                  value={editableRawContent}
                  onChange={(e) => setEditableRawContent(e.target.value)}
                  className="absolute inset-0 w-full h-full bg-transparent text-indigo-100 px-4 pt-4 pb-12 resize-none outline-none whitespace-pre z-10"
                  style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: '14px', lineHeight: '24px', letterSpacing: '0px', boxSizing: 'border-box' }}
                  spellCheck={false}
                  wrap="off"
                />

                {/* ━━━ HOVER LAYER FOR TOOLTIPS (Z-20) ━━━ */}
                <div className="absolute inset-0 pt-4 pointer-events-none whitespace-pre pb-12 z-20" style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: '14px', lineHeight: '24px', letterSpacing: '0px' }}>
                  {(() => {
                    const lines = editableRawContent.split('\n');
                    const lineOffsets = lines.reduce((acc, _, idx) => {
                      if (idx === 0) acc.push(0);
                      else acc.push(acc[idx - 1] + lines[idx - 1].length + 1);
                      return acc;
                    }, [] as number[]);

                    return lines.map((line, i) => {
                      const lineNum = i + 1;
                      const errs = errorsByLine[lineNum] || [];
                      const elemSep = editableRawContent.length > 3 ? editableRawContent[3] : '*';
                      
                      if (line === '') {
                        return <div key={`hover-${i}`} className="border-l-2 border-transparent pl-[14px] pr-4 flex w-max min-w-full text-transparent" style={{ height: '24px' }}> </div>;
                      }

                      let charOffsetInLine = 0;
                      const parts = line.split(elemSep);
                      const lineOffset = lineOffsets[i];
                      
                      const origLine = originalLines[i] || '';
                      const origParts = origLine.split(elemSep);

                      return (
                        <div key={`hover-${i}`} className="border-l-2 border-transparent pl-[14px] pr-4 flex w-max min-w-full text-transparent" style={{ height: '24px' }}>
                          {parts.map((part, pIdx) => {
                            const matchedErrs = errs.filter(e => (e.severity === 'error' || e.severity === 'warning') && (e.element_index === pIdx || (pIdx === 0 && e.element_index <= 0)));
                            const origPart = origParts[pIdx];
                            const isModified = origPart !== undefined && part !== origPart;

                            const partStart = lineOffset + charOffsetInLine;
                            charOffsetInLine += part.length + 1; // +1 for elemSep

                            if (matchedErrs.length > 0 || isModified) {
                              return (
                                <span 
                                  key={pIdx} 
                                  className="relative group pointer-events-auto cursor-text"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    const ta = e.currentTarget.closest('.relative.min-w-max')?.querySelector('textarea');
                                    if (ta) {
                                      ta.focus();
                                      ta.setSelectionRange(partStart, partStart + part.length);
                                    }
                                  }}
                                >
                                  {part}
                                  {/* TOOLTIP */}
                                  <div className="absolute top-full left-0 mt-1 w-max max-w-[320px] p-3 rounded-lg shadow-2xl bg-slate-900 border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-[100] pointer-events-none invisible group-hover:visible flex flex-col gap-1.5" style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif', letterSpacing: 'normal', lineHeight: 'normal' }}>
                                    {isModified && (
                                      <div className={`${matchedErrs.length > 0 ? 'mb-3' : ''} p-2 bg-green-500/10 border border-green-500/20 rounded`}>
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                          <span className="text-[10px] uppercase font-bold text-green-400 bg-green-500/20 px-1.5 py-[2px] rounded border border-green-500/30">Current Edits</span>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                          <div className="flex items-start gap-2">
                                            <span className="text-[10px] font-semibold text-slate-500 uppercase mt-0.5 w-[32px]">From:</span>
                                            <span className="font-mono text-[12px] text-red-400/80 bg-red-400/10 px-1 rounded line-through decoration-red-500/50 break-all">{origPart === '' ? '(empty)' : origPart}</span>
                                          </div>
                                          <div className="flex items-start gap-2">
                                            <span className="text-[10px] font-semibold text-slate-500 uppercase mt-0.5 w-[32px]">To:</span>
                                            <span className="font-mono text-[12px] text-green-300 bg-green-400/10 px-1 rounded break-all">{part === '' ? '(empty)' : part}</span>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    {matchedErrs.length > 0 && (
                                      <div className="flex flex-col gap-3">
                                        {matchedErrs.map((err, errIdx) => (
                                          <div key={`err-${errIdx}`}>
                                            <div className="flex items-center gap-2 mb-1.5">
                                              <span className={`px-2 py-[2px] rounded uppercase text-[10px] font-bold ${err.severity === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                                                {err.severity}
                                              </span>
                                              <span className="text-slate-300 text-[11px] font-semibold">{err.error_id} • {err.segment_id}{err.element_index > 0 ? String(err.element_index).padStart(2, '0') : ''}</span>
                                            </div>
                                            <p className="text-[13px] text-slate-100 whitespace-normal leading-relaxed">{err.message}</p>
                                            {err.suggestion && <p className="text-[12px] text-slate-400 whitespace-normal mt-1"><strong className="text-slate-300 font-semibold">Suggestion:</strong> {err.suggestion}</p>}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  {pIdx < parts.length - 1 ? <span className="pointer-events-none">{elemSep}</span> : null}
                                </span>
                              );
                            }

                            return (
                              <span key={pIdx} className="pointer-events-none">
                                {part}{pIdx < parts.length - 1 ? elemSep : null}
                              </span>
                            );
                          })}
                        </div>
                      );
                    });
                  })()}
                </div>

              </div>
            </div>
          </div>
          <div className="flex gap-3 justify-end items-center mb-2">
            <button 
              onClick={() => setIsEditingRaw(false)} 
              className="px-6 py-2 rounded-lg font-medium text-slate-300 hover:text-white transition-colors border border-transparent hover:bg-slate-800"
            >
              Cancel
            </button>
            <button 
              onClick={() => {
                onRawEdit(editableRawContent);
                setIsEditingRaw(false);
              }} 
              className="bg-indigo-600 hover:bg-indigo-500 flex items-center gap-2 text-white px-6 py-2 rounded-lg font-medium shadow-[0_0_15px_rgba(79,70,229,0.3)] transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
              Save & Re-validate
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-center items-center divide-x divide-gray-500/30 mb-8 py-2 mt-2 w-full">
            <div className="px-10 flex flex-col items-center text-center gap-1">
              <span className="text-[var(--text)] font-medium text-[1.05rem]">Errors</span>
              <strong className="text-red text-2xl font-bold leading-tight block">{validation.error_count}</strong>
              <span className="text-[var(--muted)] text-[0.9rem]">Blocking issues</span>
            </div>
            <div className="px-10 flex flex-col items-center text-center gap-1">
              <span className="text-[var(--text)] font-medium text-[1.05rem]">Warnings</span>
              <strong className="text-amber text-2xl font-bold leading-tight block">{validation.warning_count}</strong>
              <span className="text-[var(--muted)] text-[0.9rem]">Review recommended</span>
            </div>
            <div className="px-10 flex flex-col items-center text-center gap-1">
              <span className="text-[var(--text)] font-medium text-[1.05rem]">Info</span>
              <strong className="text-accent text-2xl font-bold leading-tight block">{validation.info_count}</strong>
              <span className="text-[var(--muted)] text-[0.9rem]">Helpful notes</span>
            </div>
            <div className="px-10 flex flex-col items-center text-center gap-1">
              <span className="text-[var(--text)] font-medium text-[1.05rem]">Fixable</span>
              <strong className="text-green text-2xl font-bold leading-tight block">{fixableCount}</strong>
              <span className="text-[var(--muted)] text-[0.9rem]">Automatic candidates</span>
            </div>
          </div>

      <div className="toggle-group mb-5 w-fit flex-wrap">
        {(['all', 'error', 'warning', 'info'] as const).map((value) => (
          <button key={value} onClick={() => setFilter(value)} className={`toggle-button ${filter === value ? 'active' : ''}`}>
            {value === 'all' ? `All (${validation.errors.length})` : `${value[0].toUpperCase()}${value.slice(1)}`}
          </button>
        ))}
      </div>

      <div className="relative w-full">
      <div className="validation-list" onScroll={handleScroll}>
        {filtered.length === 0 ? (
          <div className="surface-panel empty-state">
            {validation.is_valid ? 'No validation issues found.' : 'No items match the selected filter.'}
          </div>
        ) : (
          filtered.map((err, index) => (
            <AnimatedItem key={`${err.error_id}-${index}`} delay={0.1} index={index}>
            <article className="validation-item mb-5" style={{ padding: '24px' }}>
              <div className="validation-item-head flex justify-between gap-6">
                <div className="flex gap-4 flex-1">
                  <span className={`severity-dot mt-1.5 shrink-0 ${severityClass[err.severity] || 'severity-info'}`} />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      <span className={`badge px-4 py-1.5 ${severityBadgeClass[err.severity] || 'badge-info'}`}>{err.severity}</span>
                      <span className="status-chip px-4 py-1.5 subtle">{err.error_id}</span>
                      <span className="status-chip px-4 py-1.5 subtle">{err.segment_id}{err.element_index > 0 ? String(err.element_index).padStart(2, '0') : ''}</span>
                      {err.loop_location && <span className="status-chip px-4 py-1.5 subtle">Loop {err.loop_location}</span>}
                      {err.line_number > 0 && <span className="status-chip px-4 py-1.5 subtle">Line {err.line_number}</span>}
                    </div>
                    <p className="mb-3 text-[0.95rem] leading-relaxed text-[var(--text)]">{err.message}</p>
                    {err.suggestion && <p className="text-[0.95rem] leading-relaxed text-[var(--muted)]">Suggestion: {err.suggestion}</p>}
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0 ml-4">
                  {err.fixable ? (
                    <button 
                      onClick={() => onFix(err.error_id, err.fix_value, err.line_number, err.element_index)} 
                      style={{
                        background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.2)',
                        borderRadius: 14, padding: '9px 14px', color: '#4ade80', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 700,
                        fontFamily: 'inherit', transition: 'all 0.2s',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(74, 222, 128, 0.18)';
                        e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.35)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(74, 222, 128, 0.1)';
                        e.currentTarget.style.borderColor = 'rgba(74, 222, 128, 0.2)';
                      }}
                    >
                      Apply fix
                    </button>
                  ) : err.element_index > 0 && err.severity !== 'info' ? (
                    manualFixId === errKey(err) ? (
                      <div className="flex flex-col gap-2 mt-2 bg-slate-800 p-3 rounded border border-slate-700 animate-fade-in shadow-xl relative z-10 w-72">
                        <label className="text-xs font-medium text-slate-300">Enter correct value for {err.segment_id}{String(err.element_index).padStart(2, '0')}</label>
                        
                        <div className="bg-slate-900/50 rounded p-2 text-xs text-indigo-200 border border-indigo-900/50 leading-relaxed">
                          {loadingAi[errKey(err)] ? (
                            <span className="flex items-center gap-2">
                              <svg className="animate-spin h-3 w-3 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Generating AI fix instructions...
                            </span>
                          ) : (
                            (() => {
                              const aiText = aiExplanations[errKey(err)] || '';
                              
                              let aiExplanation = aiText;
                              let aiRecommendation = null;
                              let aiConfidence = null;

                              // Normalize by removing markdown bold/italic asterisks
                              const normalizedText = aiText.replace(/\*/g, '');

                              const recMatch = normalizedText.match(/RECOMMENDED_VALUE:\s*([^\n]+)/i);
                              if (recMatch) {
                                aiRecommendation = recMatch[1].trim();
                                // remove this line from the explanation
                                aiExplanation = aiExplanation.replace(new RegExp(`\\*?RECOMMENDED_VALUE:\\*?\\s*${aiRecommendation.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}`, 'i'), '');
                              }

                              const confMatch = normalizedText.match(/CONFIDENCE:\s*([^\n]+)/i);
                              if (confMatch) {
                                aiConfidence = confMatch[1].trim();
                                aiExplanation = aiExplanation.replace(new RegExp(`\\*?CONFIDENCE:\\*?\\s*${aiConfidence.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}`, 'i'), '');
                              }
                              
                              // Clean up any stray markdown or empty lines
                              aiExplanation = aiExplanation.replace(/\*\*/g, '').trim();

                              return (
                                <div className="flex flex-col gap-2">
                                  <div className="flex gap-2">
                                    <span className="shrink-0 mt-0.5 animate-pulse text-indigo-400 flex items-center justify-center w-4 h-4 rounded-full bg-indigo-500/20">✨</span>
                                    <span>{aiExplanation.trim()}</span>
                                  </div>
                                  {aiRecommendation && aiRecommendation !== 'None' && aiRecommendation !== 'null' && (
                                    <div className="flex items-center gap-2">
                                      <button 
                                        onClick={() => setManualFixValue(aiRecommendation)}
                                        className="w-fit text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 rounded px-2 py-1 hover:bg-indigo-500/40 transition-colors text-left font-mono"
                                      >
                                        Suggest: <strong className="text-white">{aiRecommendation}</strong>
                                      </button>
                                      {aiConfidence && (
                                        <span className="text-[10px] text-indigo-400/80 bg-indigo-900/40 px-1.5 py-0.5 rounded border border-indigo-500/20">
                                          {aiConfidence} match
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })()
                          )}
                        </div>

                        <input
                          type="text"
                          className="bg-slate-900 border border-slate-600 text-white rounded px-2 py-1.5 text-sm w-full outline-none focus:border-indigo-500 transition-colors"
                          placeholder="New value..."
                          value={manualFixValue}
                          onChange={(e) => setManualFixValue(e.target.value)}
                          autoFocus
                        />
                        <div className="flex gap-2 justify-end mt-1">
                          <button onClick={() => setManualFixId(null)} className="btn-secondary px-3 py-1 text-xs">Cancel</button>
                          <button onClick={() => { onFix(err.error_id, manualFixValue, err.line_number, err.element_index); setManualFixId(null); }} className="btn-success px-3 py-1 text-xs whitespace-nowrap">Apply & Download</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end gap-2">
                        <span className="text-amber text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                          Requires user input
                        </span>
                        <button onClick={() => handleManualFixClick(err)} className="btn-secondary px-4 py-2 text-sm border-amber/30 hover:border-amber/60 text-amber shrink-0">
                          Fix Manually
                        </button>
                      </div>
                    )
                  ) : err.severity !== 'info' ? (
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-amber text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        Requires file modification
                      </span>
                      <button 
                        onClick={() => { setEditableRawContent(formatEdi(rawContent)); setIsEditingRaw(true); }} 
                        className="btn-secondary px-3 py-1.5 text-xs border-amber/30 hover:border-amber/60 text-amber shrink-0"
                      >
                        Edit Raw Source
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
            </AnimatedItem>
          ))
        )}
      </div>
      {filtered.length > 0 && (
        <>
          <div
            className="absolute top-0 left-0 right-0 h-[50px] pointer-events-none transition-opacity duration-300 ease rounded-t-[20px] z-[5]"
            style={{ opacity: topGradientOpacity, background: 'linear-gradient(to bottom, var(--bg-elevated) 0%, transparent 100%)' }}
          ></div>
          <div
            className="absolute bottom-0 left-0 right-0 h-[100px] pointer-events-none transition-opacity duration-300 ease rounded-b-[20px] z-[5]"
            style={{ opacity: bottomGradientOpacity, background: 'linear-gradient(to top, var(--bg-elevated) 0%, transparent 100%)' }}
          ></div>
        </>
      )}
      </div>
      </>
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
