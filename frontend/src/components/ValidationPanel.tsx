import { useState, useRef, useMemo } from 'react';

const formatEdi = (content: string) => {
  if (!content || content.length < 106) return content;
  const term = content[105];
  const segments = content.split(term).map(s => s.trim()).filter(s => s.length > 0);
  return segments.join(term + '\n') + term + '\n';
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
  onFix: (errorId: string, fixValue: string) => void;
  onFixAll: () => void;
  onRawEdit: (newContent: string) => void;
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

export default function ValidationPanel({ validation, onFix, onFixAll, onRawEdit, rawContent, initialRawContent }: ValidationPanelProps) {
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [manualFixId, setManualFixId] = useState<string | null>(null);
  const [manualFixValue, setManualFixValue] = useState<string>('');
  const [aiExplanations, setAiExplanations] = useState<Record<string, string>>({});
  const [loadingAi, setLoadingAi] = useState<Record<string, boolean>>({});
  const [isEditingRaw, setIsEditingRaw] = useState(false);
  const [editableRawContent, setEditableRawContent] = useState('');

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

  const handleManualFixClick = async (err: ValidationError) => {
    setManualFixId(err.error_id);
    setManualFixValue('');
    if (!aiExplanations[err.error_id]) {
      setLoadingAi((prev) => ({ ...prev, [err.error_id]: true }));
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: `You are an expert X12 EDI validator. An error occurred at Segment: ${err.segment_id}, Element Index: ${err.element_index}, on Line Number: ${err.line_number}. Error ID: ${err.error_id}, Message: ${err.message}, Suggestion: ${err.suggestion}. Locate exactly line ${err.line_number} in the provided EDI context to analyze the error. Explain briefly in 1-2 short sentences how to fix it based on the exact context. Then, on a new line starting exactly with 'RECOMMENDED_VALUE:', provide exactly the literal string value they should inject. Then, on a new line starting exactly with 'CONFIDENCE:', provide a percentage (e.g., 99%) of how sure you are about this recommendation.`,
            context: rawContent
          }),
        });
        const data = await res.json();
        setAiExplanations((prev) => ({ ...prev, [err.error_id]: data.reply }));
      } catch {
        setAiExplanations((prev) => ({ ...prev, [err.error_id]: 'AI explanation currently unavailable.' }));
      } finally {
        setLoadingAi((prev) => ({ ...prev, [err.error_id]: false }));
      }
    }
  };

  const filtered = validation.errors.filter((error) => filter === 'all' || error.severity === filter);
  const fixableCount = validation.errors.filter((error) => error.fixable).length;

  return (
    <section className="glass-card panel-card">
      <div className="panel-header">
        <div>
          <h3 className="panel-title">
            Validation results
            <span className={`badge ${validation.is_valid ? 'badge-success' : 'badge-warning'}`}>
              {validation.is_valid ? 'Passing' : 'Needs attention'}
            </span>
          </h3>
          <p className="panel-subtitle">Filter findings, inspect context, and apply deterministic corrections.</p>
        </div>
        <div className="flex gap-2">
          {!isEditingRaw && (
            <button 
              onClick={() => { setEditableRawContent(formatEdi(rawContent)); setIsEditingRaw(true); }} 
              className="btn-secondary px-4 py-3 text-sm flex items-center gap-2 border-indigo-500/30 text-indigo-300"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              Edit Raw Source
            </button>
          )}
          {fixableCount > 0 && !isEditingRaw && (
            <button onClick={onFixAll} className="btn-success px-4 py-3 text-sm">
              Fix all ({fixableCount})
            </button>
          )}
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
                    
                    const isFullLineModified = (hasFullLineError || hasFullLineWarn) && (line !== origLine);

                    const lineBgClass = isFullLineModified ? "bg-green-500/10" : hasFullLineError ? "bg-red-500/10" : hasFullLineWarn ? "bg-amber-500/10" : "bg-transparent";
                    const borderColor = isFullLineModified ? "border-green-500/40" : hasFullLineError ? "border-red-500/40" : hasFullLineWarn ? "border-amber-500/40" : "border-transparent";

                    if (line === '') {
                      return <div key={i} className={`border-l-2 ${borderColor} ${lineBgClass} pl-[14px] pr-4 text-transparent whitespace-pre flex w-max min-w-full`} style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: '14px', height: '24px', lineHeight: '24px', letterSpacing: '0px' }}> </div>;
                    }

                    const parts = line.split(elemSep);

                    return (
                      <div key={i} className={`border-l-2 ${borderColor} ${lineBgClass} pl-[14px] pr-4 text-transparent whitespace-pre flex w-max min-w-full`} style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace', fontSize: '14px', height: '24px', lineHeight: '24px', letterSpacing: '0px' }}>
                        {parts.map((part, pIdx) => {
                          const isErr = errs.some(e => e.severity === 'error' && e.element_index === pIdx);
                          const isWarn = errs.some(e => e.severity === 'warning' && e.element_index === pIdx);
                          
                          const origPart = origParts[pIdx];
                          const isModified = origPart !== undefined && part !== origPart;
                          
                          const partBg = isModified ? "bg-green-500/40 rounded-sm shadow-[0_0_8px_rgba(34,197,94,0.4)]" :
                                         isErr ? "bg-red-500/40 rounded-sm shadow-[0_0_8px_rgba(239,68,68,0.4)]" : 
                                         isWarn ? "bg-amber-500/40 rounded-sm shadow-[0_0_8px_rgba(245,158,11,0.4)]" : "bg-transparent";

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
          <div className="stat-grid mb-5">
        <div className="summary-stat surface-panel">
          <span className="text-muted">Errors</span>
          <strong className="text-red">{validation.error_count}</strong>
          <small>Blocking issues</small>
        </div>
        <div className="summary-stat surface-panel">
          <span className="text-muted">Warnings</span>
          <strong className="text-amber">{validation.warning_count}</strong>
          <small>Review recommended</small>
        </div>
        <div className="summary-stat surface-panel">
          <span className="text-muted">Info</span>
          <strong className="text-accent">{validation.info_count}</strong>
          <small>Helpful notes</small>
        </div>
        <div className="summary-stat surface-panel">
          <span className="text-muted">Fixable</span>
          <strong className="text-green">{fixableCount}</strong>
          <small>Automatic candidates</small>
        </div>
      </div>

      <div className="toggle-group mb-5 w-fit flex-wrap">
        {(['all', 'error', 'warning', 'info'] as const).map((value) => (
          <button key={value} onClick={() => setFilter(value)} className={`toggle-button ${filter === value ? 'active' : ''}`}>
            {value === 'all' ? `All (${validation.errors.length})` : `${value[0].toUpperCase()}${value.slice(1)}`}
          </button>
        ))}
      </div>

      <div className="validation-list">
        {filtered.length === 0 ? (
          <div className="surface-panel empty-state">
            {validation.is_valid ? 'No validation issues found.' : 'No items match the selected filter.'}
          </div>
        ) : (
          filtered.map((err, index) => (
            <article key={`${err.error_id}-${index}`} className="validation-item">
              <div className="validation-item-head">
                <div className="flex gap-3">
                  <span className={`severity-dot ${severityClass[err.severity] || 'severity-info'}`} />
                  <div>
                    <div className="validation-meta">
                      <span className={`badge ${severityBadgeClass[err.severity] || 'badge-info'}`}>{err.severity}</span>
                      <span className="status-chip subtle">{err.error_id}</span>
                      <span className="status-chip subtle">{err.segment_id}{err.element_index > 0 ? String(err.element_index).padStart(2, '0') : ''}</span>
                      {err.loop_location && <span className="status-chip subtle">Loop {err.loop_location}</span>}
                      {err.line_number > 0 && <span className="status-chip subtle">Line {err.line_number}</span>}
                    </div>
                    <p className="mb-2 text-sm leading-6 text-slate-100">{err.message}</p>
                    {err.suggestion && <p className="text-sm leading-6 text-slate-400">Suggestion: {err.suggestion}</p>}
                  </div>
                </div>

                <div className="flex flex-col items-end shrink-0">
                  {err.fixable ? (
                    <button onClick={() => onFix(err.error_id, err.fix_value)} className="btn-primary px-4 py-2 text-sm shrink-0">
                      Apply fix
                    </button>
                  ) : err.element_index > 0 && err.severity !== 'info' ? (
                    manualFixId === err.error_id ? (
                      <div className="flex flex-col gap-2 mt-2 bg-slate-800 p-3 rounded border border-slate-700 animate-fade-in shadow-xl relative z-10 w-72">
                        <label className="text-xs font-medium text-slate-300">Enter correct value for {err.segment_id}{String(err.element_index).padStart(2, '0')}</label>
                        
                        <div className="bg-slate-900/50 rounded p-2 text-xs text-indigo-200 border border-indigo-900/50 leading-relaxed">
                          {loadingAi[err.error_id] ? (
                            <span className="flex items-center gap-2">
                              <svg className="animate-spin h-3 w-3 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Generating AI fix instructions...
                            </span>
                          ) : (
                            (() => {
                              const aiText = aiExplanations[err.error_id] || '';
                              
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
                          <button onClick={() => { onFix(err.error_id, manualFixValue); setManualFixId(null); }} className="btn-success px-3 py-1 text-xs whitespace-nowrap">Apply & Download</button>
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
                        className="btn-secondary px-4 py-2 text-sm border-amber/30 hover:border-amber/60 text-amber shrink-0"
                      >
                        Edit Raw Source
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
      </>
      )}
    </section>
  );
}
