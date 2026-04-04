import { useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { createPortal } from 'react-dom';

interface RemittanceSummaryProps {
  summary: {
    total_charged: number;
    total_paid: number;
    total_adjusted: number;
    total_denied: number;
    claims: any[];
    adjustments: any[];
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export default function RemittanceSummary({ summary }: RemittanceSummaryProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const paidPercent = summary.total_charged > 0 ? ((summary.total_paid / summary.total_charged) * 100).toFixed(1) : '0';

  const renderedPanel = (
    <section className={`glass-card panel-card animate-fade-in flex flex-col transition-all duration-300 ${isMaximized ? 'w-full max-w-[1400px] h-[90vh] shadow-2xl relative z-10 overflow-y-auto' : ''}`}>
      <div className="panel-header shrink-0">
        <div>
            <h3 className="panel-title">835 remittance summary</h3>
            <p className="panel-subtitle">Payment, adjustment, and denial totals extracted from the uploaded remit.</p>
          </div>
          <div className="flex gap-4 items-center">
            <span className="badge badge-success">{paidPercent}% paid</span>
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
              title={isMaximized ? "Restore view" : "Maximize view"}
            >
              {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </div>

      <div className="stat-grid mb-5">
        <div className="summary-stat surface-panel">
          <span>Total charged</span>
          <strong>{formatCurrency(summary.total_charged)}</strong>
        </div>
        <div className="summary-stat surface-panel">
          <span>Total paid</span>
          <strong className="text-green">{formatCurrency(summary.total_paid)}</strong>
        </div>
        <div className="summary-stat surface-panel">
          <span>Total adjusted</span>
          <strong className="text-amber">{formatCurrency(summary.total_adjusted)}</strong>
        </div>
        <div className="summary-stat surface-panel">
          <span>Total denied</span>
          <strong className="text-red">{formatCurrency(summary.total_denied)}</strong>
        </div>
      </div>

      <div className="table-wrap surface-panel">
        <table className="data-table text-sm">
          <thead>
            <tr>
              <th className="text-left">Claim ID</th>
              <th className="text-left">Status</th>
              <th className="text-right">Charged</th>
              <th className="text-right">Paid</th>
              <th className="text-left">Adjustments</th>
            </tr>
          </thead>
          <tbody>
            {summary.claims.map((claim, index) => (
              <tr key={index} className="table-row">
                <td className="font-mono text-accent">{claim.claim_id}</td>
                <td>
                  <span className={`badge ${claim.status === '4' ? 'badge-error' : claim.status === '1' ? 'badge-success' : 'badge-info'}`}>
                    {claim.status_label}
                  </span>
                </td>
                <td className="text-right font-mono text-slate-200">{formatCurrency(claim.charged)}</td>
                <td className="text-right font-mono text-green">{formatCurrency(claim.paid)}</td>
                <td>
                  {claim.adjustments?.length ? (
                    claim.adjustments.map((adj: any, adjustmentIndex: number) => (
                      <div key={adjustmentIndex} className="mb-1 text-xs text-slate-400 last:mb-0">
                        <span className="font-mono text-amber">{adj.group_code}-{adj.reason_code}</span>
                        <span className="ml-2">{adj.reason_description}</span>
                        <span className="ml-2 text-red">({formatCurrency(adj.amount)})</span>
                      </div>
                    ))
                  ) : (
                    <span className="text-slate-500">No adjustments</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
