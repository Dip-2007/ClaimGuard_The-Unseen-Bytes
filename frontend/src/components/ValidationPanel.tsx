import { useState } from 'react';

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
  rawContent: string;
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

export default function ValidationPanel({ validation, onFix, onFixAll, rawContent }: ValidationPanelProps) {
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [manualFixId, setManualFixId] = useState<string | null>(null);
  const [manualFixValue, setManualFixValue] = useState<string>('');
  const [aiExplanations, setAiExplanations] = useState<Record<string, string>>({});
  const [loadingAi, setLoadingAi] = useState<Record<string, boolean>>({});

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
        {fixableCount > 0 && (
          <button onClick={onFixAll} className="btn-success px-4 py-3 text-sm">
            Fix all ({fixableCount})
          </button>
        )}
      </div>

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
                    <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider shrink-0 mt-1">Manual edit only</span>
                  ) : null}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
