import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import { History, FileText, MessageSquare, ExternalLink, Calendar, Trash2, ChevronRight, Lock } from 'lucide-react';

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  metadata?: any;
}

interface HistoryDashboardProps {
  getAuthHeaders: () => Record<string, string>;
  onViewResult?: (metadata: any) => void;
  isGuest?: boolean;
}

export default function HistoryDashboard({ getAuthHeaders, onViewResult, isGuest }: HistoryDashboardProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (isGuest) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch('/api/history', {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch history');
      const data = await res.json();
      setActivities(data.activities);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, isGuest]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  if (isGuest) {
    return (
      <EmptyState>
        <div className="icon-wrap guest">
          <Lock size={48} />
        </div>
        <h2>Guest Mode</h2>
        <p>Activity history is only available for registered users. Log in to track your EDI validations and chat history.</p>
      </EmptyState>
    );
  }

  if (loading) {
    return (
      <LoadingState>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="spinner"
        >
          <History size={40} />
        </motion.div>
        <p>Loading your activity...</p>
      </LoadingState>
    );
  }

  if (error) {
    return (
      <ErrorState>
        <Trash2 size={40} color="#ef4444" />
        <h2>Something went wrong</h2>
        <p>{error}</p>
        <button onClick={fetchHistory}>Try Again</button>
      </ErrorState>
    );
  }

  return (
    <DashboardContainer className="animate-fade-in">
      <header className="dashboard-header">
        <div className="header-bg" />
        <div className="title-section">
          <div className="icon-badge">
            <History size={24} />
          </div>
          <div>
            <h1>Activity History</h1>
            <p>Track your past EDI uploads, validation results, and AI interactions.</p>
          </div>
        </div>
      </header>

      <div className="dashboard-content">
        {activities.length === 0 ? (
          <EmptyState>
            <div className="icon-wrap">
              <Calendar size={48} />
            </div>
            <h2>No activity yet</h2>
            <p>Start by uploading an EDI file or chatting with the AI Guide.</p>
          </EmptyState>
        ) : (
          <Timeline>
            {activities.map((activity, idx) => (
              <TimelineItem 
                key={activity.id}
                as={motion.div}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <div className="timeline-marker">
                  <div className={`icon-circle ${activity.type}`}>
                    {activity.type === 'upload' ? <FileText size={18} /> : <MessageSquare size={18} />}
                  </div>
                  <div className="line" />
                </div>
                
                <div className="activity-card">
                  <div className="card-header">
                    <span className="timestamp">
                      {new Date(activity.timestamp).toLocaleDateString(undefined, { 
                        month: 'short', 
                        day: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                    <div className="type-tag">{activity.type}</div>
                  </div>
                  
                  <div className="card-body">
                    <h3>{activity.title}</h3>
                    <p>{activity.description}</p>
                    
                    {activity.metadata && (
                      <div className="metadata-pills">
                        {activity.metadata.transaction_type && (
                          <span className="pill">Type: {activity.metadata.transaction_type}</span>
                        )}
                        {activity.metadata.error_count !== undefined && (
                          <span className={`pill ${activity.metadata.error_count > 0 ? 'error' : 'success'}`}>
                            {activity.metadata.error_count} Errors
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="card-actions">
                    {activity.metadata?.cloudinary_url && (
                      <a href={activity.metadata.cloudinary_url} target="_blank" rel="noreferrer" className="action-btn">
                        <ExternalLink size={14} /> Download EDI
                      </a>
                    )}
                    {activity.type === 'upload' && onViewResult && (
                      <button onClick={() => onViewResult(activity.metadata)} className="action-btn primary">
                        View Analysis <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </TimelineItem>
            ))}
          </Timeline>
        )}
      </div>
    </DashboardContainer>
  );
}

// ─── Styled Components ───────────────────────────────────────────────────────

const DashboardContainer = styled.div`
  width: 100%;
  max-width: 1000px;
  margin: 0 auto;
  padding: 40px 20px;
  min-height: 100vh;

  .dashboard-header {
    position: relative;
    padding-bottom: 40px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 24px;

    .header-bg {
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 0% 0%, rgba(74, 222, 128, 0.08) 0%, transparent 50%);
      pointer-events: none;
    }

    .icon-badge {
      padding: 16px;
      background: rgba(74, 222, 128, 0.1);
      border-radius: 20px;
      color: #4ade80;
      border: 1px solid rgba(74, 222, 128, 0.2);
      box-shadow: 0 4px 20px rgba(74, 222, 128, 0.1);
    }

    .title-section {
      display: flex;
      align-items: center;
      gap: 20px;
      z-index: 1;

      h1 {
        font-size: 2.2rem;
        font-weight: 800;
        margin: 0;
        letter-spacing: -0.02em;
        background: linear-gradient(135deg, var(--text) 0%, #a1a1aa 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }

      p {
        margin: 4px 0 0 0;
        color: var(--muted);
        font-size: 1.05rem;
      }
    }
  }

  .dashboard-content {
    position: relative;
    z-index: 1;
  }
`;

const Timeline = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
`;

const TimelineItem = styled.div`
  display: flex;
  gap: 24px;

  .timeline-marker {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 40px;

    .icon-circle {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: var(--bg-card);
      border: 1px solid rgba(255, 255, 255, 0.08);
      display: grid;
      place-items: center;
      z-index: 2;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);

      &.upload { color: #4ade80; border-color: rgba(74, 222, 128, 0.3); }
      &.chat { color: #54d0ff; border-color: rgba(84, 208, 255, 0.3); }
    }

    .line {
      flex: 1;
      width: 2px;
      background: linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%);
      margin: 4px 0;
    }
  }

  &:last-child .line {
    display: none;
  }

  .activity-card {
    flex: 1;
    background: var(--bg-elevated);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 20px;
    padding: 24px;
    margin-bottom: 32px;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 10px 30px rgba(0,0,0,0.1);

    &:hover {
      transform: translateX(8px);
      background: var(--bg-card);
      border-color: rgba(255, 255, 255, 0.12);
      box-shadow: 0 20px 40px rgba(0,0,0,0.2);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;

      .timestamp {
        font-size: 0.85rem;
        color: var(--muted);
        font-weight: 500;
        letter-spacing: 0.02em;
      }

      .type-tag {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        padding: 4px 10px;
        border-radius: 8px;
        background: rgba(255,255,255,0.04);
        color: var(--muted);
      }
    }

    .card-body {
      h3 {
        margin: 0 0 8px 0;
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--text);
      }

      p {
        margin: 0;
        color: var(--muted);
        font-size: 0.95rem;
        line-height: 1.5;
      }

      .metadata-pills {
        display: flex;
        gap: 8px;
        margin-top: 16px;

        .pill {
          font-size: 0.8rem;
          font-weight: 600;
          padding: 4px 12px;
          border-radius: 100px;
          background: rgba(255,255,255,0.05);
          color: #aaa;

          &.error { color: #ef4444; background: rgba(239, 68, 68, 0.1); }
          &.success { color: #4ade80; background: rgba(74, 222, 128, 0.1); }
        }
      }
    }

    .card-actions {
      display: flex;
      gap: 12px;
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid rgba(255,255,255,0.04);

      .action-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        border-radius: 12px;
        font-size: 0.85rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s;
        text-decoration: none;
        font-family: inherit;
        border: 0;

        background: rgba(255,255,255,0.05);
        color: #ddd;

        &:hover {
          background: rgba(255,255,255,0.1);
          color: #fff;
        }

        &.primary {
          background: rgba(74, 222, 128, 0.12);
          color: #4ade80;

          &:hover {
            background: rgba(74, 222, 128, 0.22);
            transform: translateY(-1px);
          }
        }
      }
    }
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  items-center;
  justify-center;
  padding: 80px 20px;
  text-align: center;
  color: var(--muted);

  .icon-wrap {
    width: 100px;
    height: 100px;
    border-radius: 30px;
    background: rgba(255,255,255,0.03);
    display: grid;
    place-items: center;
    margin: 0 auto 24px;
    color: rgba(255,255,255,0.1);

    &.guest { color: #ffab00; background: rgba(255, 171, 0, 0.05); }
  }

  h2 { font-size: 1.5rem; color: var(--text); margin-bottom: 12px; }
  p { max-width: 400px; margin: 0 auto; line-height: 1.6; }
`;

const LoadingState = styled.div`
  display: flex;
  flex-direction: column;
  items-center;
  justify-center;
  padding: 120px 20px;
  text-align: center;
  color: var(--muted);

  .spinner {
    margin: 0 auto 24px;
    color: #4ade80;
  }
`;

const ErrorState = styled.div`
  display: flex;
  flex-direction: column;
  items-center;
  justify-center;
  padding: 120px 20px;
  text-align: center;
  
  h2 { margin-top: 24px; margin-bottom: 12px; }
  p { color: #ef4444; margin-bottom: 24px; }
  
  button {
    background: transparent;
    border: 1px solid rgba(255,255,255,0.1);
    color: var(--text);
    padding: 10px 24px;
    border-radius: 12px;
    cursor: pointer;
    font-family: inherit;
    font-weight: 700;
  }
`;
