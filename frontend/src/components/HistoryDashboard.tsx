import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  History, FileText, MessageSquare, ExternalLink, Calendar,
  Lock, BarChart3, AlertTriangle,
  CheckCircle2, Clock, RefreshCw, Shield, Activity,
  ArrowUpRight, Eye, Wrench, Download, FileDown, PieChart,
} from 'lucide-react';

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  metadata?: any;
}

type FileStatus = 'needs_fixing' | 'clean' | 'chat';
type FilterId = 'all' | 'needs_fixing' | 'clean' | 'chat';

interface HistoryDashboardProps {
  getAuthHeaders: () => Record<string, string>;
  onViewResult?: (metadata: any) => void;
  onContinueFixing?: (metadata: any) => void;
  isGuest?: boolean;
}

function getFileStatus(activity: ActivityItem): FileStatus {
  if (activity.type === 'chat') return 'chat';
  const errors = activity.metadata?.error_count ?? 0;
  return errors > 0 ? 'needs_fixing' : 'clean';
}

const statusConfig: Record<FileStatus, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  needs_fixing: {
    label: 'Needs Fixing',
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.06)',
    border: 'rgba(239, 68, 68, 0.18)',
    icon: <Wrench size={14} />,
  },
  clean: {
    label: 'Clean',
    color: '#4ade80',
    bg: 'rgba(74, 222, 128, 0.06)',
    border: 'rgba(74, 222, 128, 0.18)',
    icon: <CheckCircle2 size={14} />,
  },
  chat: {
    label: 'Chat',
    color: '#54d0ff',
    bg: 'rgba(84, 208, 255, 0.06)',
    border: 'rgba(84, 208, 255, 0.18)',
    icon: <MessageSquare size={14} />,
  },
};

// ─── Analytics Panel ─────────────────────────────────────────────────

function AnalyticsPanel({ activities }: { activities: ActivityItem[] }) {
  const stats = useMemo(() => {
    const uploads = activities.filter(a => a.type === 'upload');
    const chats = activities.filter(a => a.type === 'chat');
    const totalErrors = uploads.reduce((sum, a) => sum + (a.metadata?.error_count || 0), 0);
    const cleanFiles = uploads.filter(a => (a.metadata?.error_count || 0) === 0).length;
    const needsFix = uploads.filter(a => (a.metadata?.error_count || 0) > 0).length;
    const txTypes: Record<string, number> = {};
    uploads.forEach(a => {
      const t = a.metadata?.transaction_type || 'Unknown';
      txTypes[t] = (txTypes[t] || 0) + 1;
    });

    const dayMap: Record<string, number> = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dayMap[d.toLocaleDateString('en-US', { weekday: 'short' })] = 0;
    }
    activities.forEach(a => {
      const day = new Date(a.timestamp).toLocaleDateString('en-US', { weekday: 'short' });
      if (day in dayMap) dayMap[day]++;
    });

    return { uploads: uploads.length, chats: chats.length, totalErrors, cleanFiles, needsFix, txTypes, dayMap };
  }, [activities]);

  const maxDay = Math.max(...Object.values(stats.dayMap), 1);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
      <StatCard icon={<FileText size={20} />} label="Files Parsed" value={stats.uploads} color="#4ade80" bg="rgba(74,222,128,0.08)" border="rgba(74,222,128,0.18)" />
      <StatCard icon={<CheckCircle2 size={20} />} label="Clean Files" value={stats.cleanFiles} color="#4ade80" bg="rgba(74,222,128,0.08)" border="rgba(74,222,128,0.18)" />
      <StatCard icon={<Wrench size={20} />} label="Needs Fixing" value={stats.needsFix} color="#ef4444" bg="rgba(239,68,68,0.06)" border="rgba(239,68,68,0.15)" />
      <StatCard icon={<MessageSquare size={20} />} label="AI Chats" value={stats.chats} color="#54d0ff" bg="rgba(84,208,255,0.08)" border="rgba(84,208,255,0.18)" />
      <StatCard icon={<AlertTriangle size={20} />} label="Total Errors" value={stats.totalErrors} color="#ffb454" bg="rgba(255,180,84,0.08)" border="rgba(255,180,84,0.18)" />

      {/* 7-Day Sparkline */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        style={{
          gridColumn: 'span 2', background: 'var(--bg-card)',
          border: '1px solid var(--border)', borderRadius: 20, padding: '18px 22px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Activity size={15} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>7-Day Activity</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 56 }}>
          {Object.entries(stats.dayMap).map(([day, count]) => (
            <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max((count / maxDay) * 44, 4)}px` }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  width: '100%', maxWidth: 28, borderRadius: 5,
                  background: count > 0 ? 'linear-gradient(to top, rgba(74,222,128,0.3), rgba(74,222,128,0.7))' : 'rgba(255,255,255,0.04)',
                  boxShadow: count > 0 ? '0 4px 12px rgba(74,222,128,0.15)' : 'none',
                }}
              />
              <span style={{ fontSize: '0.58rem', color: 'var(--muted)', fontWeight: 600 }}>{day}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Tx types */}
      {Object.keys(stats.txTypes).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          style={{
            gridColumn: 'span 3', background: 'var(--bg-card)',
            border: '1px solid var(--border)', borderRadius: 20, padding: '18px 22px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <PieChart size={15} style={{ color: '#54d0ff' }} />
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Transaction Types</span>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {Object.entries(stats.txTypes).map(([type, count]) => {
              const colors: Record<string, string> = { '835': '#54d0ff', '837': '#4ade80', '834': '#a78bfa' };
              const labels: Record<string, string> = { '835': 'Remittance', '837': 'Claim', '834': 'Enrollment' };
              const c = colors[type] || '#ffab00';
              return (
                <div key={type} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 16px', borderRadius: 14,
                  background: `${c}10`, border: `1px solid ${c}25`, flex: '1 1 130px',
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, background: `${c}18`,
                    display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.78rem', color: c,
                  }}>{type}</div>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)' }}>{count}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--muted)', fontWeight: 600 }}>{labels[type] || type}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color, bg, border }: {
  icon: React.ReactNode; label: string; value: number; color: string; bg: string; border: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, boxShadow: `0 12px 32px rgba(0,0,0,0.25)` }}
      transition={{ duration: 0.3 }}
      style={{
        background: bg, border: `1px solid ${border}`, borderRadius: 18,
        padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 10,
      }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}15`, display: 'grid', placeItems: 'center', color }}>{icon}</div>
      <div>
        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--muted)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      </div>
    </motion.div>
  );
}

// ─── Filter Bar ──────────────────────────────────────────────────────

function FilterBar({ active, onChange, counts }: {
  active: FilterId; onChange: (f: FilterId) => void;
  counts: Record<FilterId, number>;
}) {
  const filters: { id: FilterId; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'all', label: 'All', icon: <Clock size={13} />, color: 'var(--accent)' },
    { id: 'needs_fixing', label: `Needs Fixing (${counts.needs_fixing})`, icon: <Wrench size={13} />, color: '#ef4444' },
    { id: 'clean', label: `Clean (${counts.clean})`, icon: <CheckCircle2 size={13} />, color: '#4ade80' },
    { id: 'chat', label: `Chats (${counts.chat})`, icon: <MessageSquare size={13} />, color: '#54d0ff' },
  ];

  return (
    <div style={{
      display: 'flex', gap: 6, marginBottom: 24, padding: 5, borderRadius: 16,
      background: 'var(--surface)', border: '1px solid var(--border)', width: 'fit-content', flexWrap: 'wrap',
    }}>
      {filters.map(f => {
        const isActive = active === f.id;
        const activeColor = f.id === 'all' ? '#4ade80' : (statusConfig[f.id as FileStatus]?.color || '#4ade80');
        return (
          <button
            key={f.id} onClick={() => onChange(f.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 11, border: 0,
              background: isActive ? activeColor : 'transparent',
              color: isActive ? (f.id === 'needs_fixing' ? '#fff' : '#050907') : 'var(--muted)',
              fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.2s ease',
              boxShadow: isActive ? `0 4px 14px ${activeColor}30` : 'none',
            }}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Activity Card ───────────────────────────────────────────────────

function ActivityCard({ activity, index, onViewResult, onContinueFixing }: {
  activity: ActivityItem; index: number;
  onViewResult?: (metadata: any) => void;
  onContinueFixing?: (metadata: any) => void;
}) {
  const status = getFileStatus(activity);
  const cfg = statusConfig[status];
  const isUpload = activity.type === 'upload';

  const txLabels: Record<string, string> = { '835': 'Remittance', '837': 'Claim', '834': 'Enrollment' };
  const txName = activity.metadata?.transaction_type ? `${activity.metadata.transaction_type} ${txLabels[activity.metadata.transaction_type] || 'EDI'}` : 'EDI Document';
  const errCount = activity.metadata?.error_count || 0;
  const warnCount = activity.metadata?.warning_count || 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.035, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ scale: 1.01 }}
      style={{
        background: 'var(--bg-card)', border: `1px solid ${cfg.border}`,
        borderRadius: 16, marginBottom: 14, overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Top Banner indicating status */}
      <div style={{
        background: cfg.bg, borderBottom: `1px solid ${cfg.border}`,
        padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8,
        color: cfg.color, fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em'
      }}>
        {status === 'needs_fixing' ? '🔴 Needs Fixing' : status === 'clean' ? '🟢 Clean / Resolved' : '💬 Chat'}
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4, textTransform: 'none', letterSpacing: 'normal' }}>
          <Clock size={11} />
          {new Date(activity.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {/* Document Stats Row */}
        {isUpload ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem', marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, color: 'var(--text)' }}>{txName}</span>
            <span style={{ color: 'var(--muted)' }}>•</span>
            {status === 'needs_fixing' ? (
              <>
                <span style={{ color: '#ef4444', fontWeight: 600 }}>{errCount} {errCount === 1 ? 'Error' : 'Errors'}</span>
                {warnCount > 0 && (
                  <>
                    <span style={{ color: 'var(--muted)' }}>•</span>
                    <span style={{ color: '#ffb454', fontWeight: 600 }}>{warnCount} Warnings</span>
                  </>
                )}
              </>
            ) : (
              <>
                <span style={{ color: '#4ade80', fontWeight: 600 }}>0 Errors</span>
                <span style={{ color: 'var(--muted)' }}>•</span>
                <span style={{ color: '#4ade80', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 size={12}/> Valid</span>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem', marginBottom: 8, color: 'var(--text)', fontWeight: 800 }}>
            {activity.title}
          </div>
        )}

        {/* File Name or description */}
        <h3 style={{ margin: '0 0 16px', fontSize: '1.05rem', fontWeight: 500, color: 'var(--muted)' }}>
          {isUpload ? `File: ${activity.title}` : activity.description}
        </h3>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {status === 'needs_fixing' && onContinueFixing && (
             <ActionButton
               onClick={() => onContinueFixing(activity.metadata)}
               icon={<ArrowUpRight size={14} />}
               label="Continue Fixing"
               color="#ef4444"
               primary
             />
          )}

          {status === 'clean' && onViewResult && (
             <ActionButton
               onClick={() => onViewResult(activity.metadata)}
               icon={<BarChart3 size={14} />}
               label="View Analytics"
               color="#4ade80"
               primary
             />
          )}

          {status === 'chat' && (
             <ActionButton
               onClick={() => {}}
               icon={<Eye size={14} />}
               label="View Conversation"
               color="#54d0ff"
               primary
             />
          )}

          {isUpload && activity.metadata?.cloudinary_url && (
             <ActionLink
               href={activity.metadata.cloudinary_url}
               icon={<Download size={14} />}
               label="Download EDI"
             />
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ActionButton({ onClick, icon, label, color, primary }: {
  onClick: () => void; icon: React.ReactNode; label: string; color: string; primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '7px 14px', borderRadius: 10, fontSize: '0.78rem',
        fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        background: primary ? `${color}14` : 'rgba(255,255,255,0.05)',
        color: primary ? color : '#ccc',
        border: `1px solid ${primary ? `${color}28` : 'rgba(255,255,255,0.08)'}`,
        transition: 'all 0.2s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = primary ? `${color}28` : 'rgba(255,255,255,0.1)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = primary ? `${color}14` : 'rgba(255,255,255,0.05)';
        e.currentTarget.style.transform = 'none';
      }}
    >
      {icon} {label} <ArrowUpRight size={11} />
    </button>
  );
}

function ActionLink({ href, icon, label, accent }: {
  href: string; icon: React.ReactNode; label: string; accent?: boolean;
}) {
  return (
    <a
      href={href} target="_blank" rel="noreferrer"
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '7px 14px', borderRadius: 10, fontSize: '0.78rem',
        fontWeight: 700, textDecoration: 'none', fontFamily: 'inherit',
        background: accent ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.05)',
        color: accent ? '#4ade80' : '#bbb',
        border: `1px solid ${accent ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.08)'}`,
        transition: 'all 0.2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = accent ? 'rgba(74,222,128,0.18)' : 'rgba(255,255,255,0.1)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = accent ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.05)'; }}
    >
      {icon} {label} <ExternalLink size={10} />
    </a>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export default function HistoryDashboard({ getAuthHeaders, onViewResult, onContinueFixing, isGuest }: HistoryDashboardProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>('all');
  const [showAnalytics, setShowAnalytics] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (isGuest) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/history', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch history');
      const data = await res.json();
      setActivities(data.activities);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, isGuest]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const filteredActivities = useMemo(() => {
    if (filter === 'all') return activities;
    return activities.filter(a => getFileStatus(a) === filter);
  }, [activities, filter]);

  const counts = useMemo(() => ({
    all: activities.length,
    needs_fixing: activities.filter(a => getFileStatus(a) === 'needs_fixing').length,
    clean: activities.filter(a => getFileStatus(a) === 'clean').length,
    chat: activities.filter(a => getFileStatus(a) === 'chat').length,
  }), [activities]);

  // ─── Guest ────────────────────────────────────────────────────────
  if (isGuest) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '100px 20px', textAlign: 'center',
        maxWidth: 460, margin: '0 auto',
      }}>
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          style={{
            width: 96, height: 96, borderRadius: 26,
            background: 'rgba(255,171,0,0.08)', border: '1px solid rgba(255,171,0,0.2)',
            display: 'grid', placeItems: 'center', color: '#ffab00', marginBottom: 26,
          }}
        ><Lock size={42} /></motion.div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 10px', color: 'var(--text)' }}>Guest Mode</h2>
        <p style={{ color: 'var(--muted)', lineHeight: 1.7, fontSize: '0.92rem' }}>
          Activity history is only available for registered users.<br />Log in to track your validations and chats.
        </p>
      </div>
    );
  }

  // ─── Loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '120px 20px', textAlign: 'center' }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} style={{ marginBottom: 20, color: 'var(--accent)' }}>
          <History size={42} />
        </motion.div>
        <p style={{ color: 'var(--muted)', fontSize: '0.92rem' }}>Loading your activity...</p>
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '120px 20px', textAlign: 'center' }}>
        <Shield size={42} style={{ color: '#ef4444', marginBottom: 18 }} />
        <h2 style={{ marginBottom: 8, fontSize: '1.3rem', fontWeight: 700 }}>Something went wrong</h2>
        <p style={{ color: '#ef4444', marginBottom: 22 }}>{error}</p>
        <button onClick={fetchHistory} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
          color: 'var(--text)', padding: '10px 22px', borderRadius: 12,
          cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.85rem',
        }}><RefreshCw size={14} /> Try Again</button>
      </div>
    );
  }

  // ─── Main ─────────────────────────────────────────────────────────
  return (
    <div style={{ width: '100%', maxWidth: 1080, margin: '0 auto', padding: '28px 20px' }}>
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 28, flexWrap: 'wrap', gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            padding: 13, borderRadius: 16,
            background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.18)',
            color: '#4ade80', boxShadow: '0 4px 18px rgba(74,222,128,0.08)',
          }}><History size={24} /></div>
          <div>
            <h1 style={{
              margin: 0, fontSize: 'clamp(1.4rem, 2.5vw, 1.9rem)', fontWeight: 800,
              letterSpacing: '-0.02em', color: 'var(--text)',
            }}>Activity History</h1>
            <p style={{ margin: '3px 0 0', color: 'var(--muted)', fontSize: '0.88rem' }}>
              Track validations, fixes, and AI interactions.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px',
              borderRadius: 11, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit',
              background: showAnalytics ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.05)',
              color: showAnalytics ? '#4ade80' : 'var(--muted)',
              border: `1px solid ${showAnalytics ? 'rgba(74,222,128,0.25)' : 'rgba(255,255,255,0.08)'}`,
              transition: 'all 0.2s',
            }}
          ><BarChart3 size={14} /> Analytics</button>
          <button
            onClick={fetchHistory}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '8px 14px',
              borderRadius: 11, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit', background: 'rgba(255,255,255,0.05)',
              color: 'var(--muted)', border: '1px solid rgba(255,255,255,0.08)',
              transition: 'all 0.2s',
            }}
          ><RefreshCw size={13} /> Refresh</button>
        </div>
      </motion.header>

      {/* Analytics */}
      <AnimatePresence>
        {showAnalytics && activities.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <AnalyticsPanel activities={activities} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filter */}
      {activities.length > 0 && (
        <FilterBar active={filter} onChange={setFilter} counts={counts} />
      )}

      {/* Timeline */}
      {filteredActivities.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '72px 20px', textAlign: 'center' }}>
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            style={{
              width: 92, height: 92, borderRadius: 26,
              background: 'rgba(255,255,255,0.03)', display: 'grid', placeItems: 'center',
              color: 'rgba(255,255,255,0.1)', marginBottom: 22,
            }}
          ><Calendar size={44} /></motion.div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            {filter !== 'all' ? `No ${statusConfig[filter as FileStatus]?.label || filter} items` : 'No activity yet'}
          </h2>
          <p style={{ color: 'var(--muted)', maxWidth: 360, lineHeight: 1.6, fontSize: '0.9rem' }}>
            {filter === 'needs_fixing'
              ? 'All your files are clean! No errors to fix.'
              : 'Start by uploading an EDI file or chatting with the AI Guide.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filteredActivities.map((activity, idx) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              index={idx}
              onViewResult={onViewResult}
              onContinueFixing={onContinueFixing}
            />
          ))}
        </div>
      )}
    </div>
  );
}
