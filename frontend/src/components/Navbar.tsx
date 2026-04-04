import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import styled, { keyframes } from 'styled-components';
import { Home, ShieldCheck, MessageSquare, Plus, FileDown, Bot } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
type TabId = 'upload' | 'results' | 'chat';

interface NavItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  available: boolean;
}

interface NavbarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  hasResults: boolean;
  onExport?: (format: string) => void;
}

// ─── Navbar Component ────────────────────────────────────────────────────────
export default function Navbar({ activeTab, onTabChange, hasResults, onExport }: NavbarProps) {
  const { scrollY } = useScroll();
  const navMaxWidth = useTransform(scrollY, [0, 150], ["1400px", "1000px"]);
  const navBackground = useTransform(scrollY, [0, 150], ['rgba(22, 22, 22, 0.72)', 'rgba(15, 15, 16, 0.88)']);
  const navBackdrop = useTransform(scrollY, [0, 150], ['blur(24px)', 'blur(32px)']);
  const navBoxShadow = useTransform(scrollY, [0, 150], ['0 24px 80px rgba(0,0,0,0.45)', '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255, 255, 255, 0.08)']);

  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const navItems: NavItem[] = [
    { id: 'upload', label: 'Workspace', icon: <Home size={18} />, available: true },
    { id: 'results', label: 'Results', icon: <ShieldCheck size={18} />, available: hasResults },
    { id: 'chat', label: 'AI Guide', icon: <MessageSquare size={18} />, available: true },
  ];

  const availableItems = navItems.filter(i => i.available);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock horizontal scroll to prevent mobile menu overflow
  useEffect(() => {
    document.body.style.overflowX = 'hidden';
    return () => { document.body.style.overflowX = ''; };
  }, []);

  const handleNavClick = (id: TabId) => {
    onTabChange(id);
    setMobileMenuOpen(false);
  };

  // ─── Mobile Layout ─────────────────────────────────────────────────────────
  const MobileNav = () => (
    <div className="lg:hidden">
      {/* Top Header — glassmorphism notch */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        background: 'rgba(15, 15, 16, 0.82)', backdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ height: '2px', position: 'absolute', top: 0, left: 0, right: 0, background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), rgba(200, 200, 200, 0.2), transparent)' }} />
        <LogoLoader />
        {hasResults && onExport && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setExportOpen(!exportOpen)}
              style={{
                background: 'rgba(74, 222, 128, 0.12)', border: '1px solid rgba(74, 222, 128, 0.25)',
                borderRadius: 12, padding: '8px 12px', color: '#4ade80', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700,
              }}
            >
              <FileDown size={14} /> Export
            </button>
            <AnimatePresence>
              {exportOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  style={{
                    position: 'absolute', right: 0, top: '100%', marginTop: 8,
                    background: 'rgba(22, 22, 22, 0.96)', border: '1px solid rgba(74, 222, 128, 0.15)',
                    borderRadius: 16, padding: 6, minWidth: 130, backdropFilter: 'blur(20px)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
                  }}
                >
                  {['json', 'edi', 'csv'].map(fmt => (
                    <button key={fmt} onClick={() => { onExport(fmt); setExportOpen(false); }}
                      style={{
                        display: 'block', width: '100%', padding: '10px 14px', border: 0, borderRadius: 12,
                        background: 'transparent', color: '#ccc', cursor: 'pointer', textAlign: 'left',
                        fontSize: '0.82rem', fontWeight: 600, fontFamily: 'inherit',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      Export {fmt.toUpperCase()}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Bottom Navigation Bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        height: 80, pointerEvents: 'none',
      }}>
        {/* SVG Cutout Background */}
        <svg viewBox="0 0 400 80" preserveAspectRatio="none" style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
        }}>
          <path
            d="M0 20 Q0 0 20 0 L155 0 Q170 0 175 14 Q185 40 200 40 Q215 40 225 14 Q230 0 245 0 L380 0 Q400 0 400 20 L400 80 L0 80 Z"
            fill="rgba(15, 15, 16, 0.92)"
          />
          <path
            d="M0 20 Q0 0 20 0 L155 0 Q170 0 175 14 Q185 40 200 40 Q215 40 225 14 Q230 0 245 0 L380 0 Q400 0 400 20 L400 80 L0 80 Z"
            fill="none" stroke="rgba(74, 222, 128, 0.12)" strokeWidth="0.5"
          />
        </svg>

        {/* Nav Items — left and right of FAB */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'space-around', padding: '0 20px', pointerEvents: 'auto',
        }}>
          {/* Left items */}
          <div style={{ display: 'flex', gap: 8, flex: 1, justifyContent: 'center' }}>
            {availableItems.filter(i => i.id !== 'chat').map(item => (
              <button key={item.id} onClick={() => handleNavClick(item.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  background: 'transparent', border: 0, cursor: 'pointer',
                  color: activeTab === item.id ? '#4ade80' : '#888', padding: '6px 14px',
                  transition: 'color 0.2s', fontSize: '0.68rem', fontWeight: 700,
                  fontFamily: 'inherit',
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Center FAB spacer */}
          <div style={{ width: 72 }} />

          {/* Right items */}
          <div style={{ display: 'flex', gap: 8, flex: 1, justifyContent: 'center' }}>
            {availableItems.filter(i => i.id === 'chat').map(item => (
              <button key={item.id} onClick={() => handleNavClick(item.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  background: 'transparent', border: 0, cursor: 'pointer',
                  color: activeTab === item.id ? '#4ade80' : '#888', padding: '6px 14px',
                  transition: 'color 0.2s', fontSize: '0.68rem', fontWeight: 700,
                  fontFamily: 'inherit',
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Center FAB Button */}
        <motion.button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          animate={{ rotate: mobileMenuOpen ? 135 : 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          style={{
            position: 'absolute', left: '50%', top: -22, transform: 'translateX(-50%)',
            width: 56, height: 56, borderRadius: '50%', border: 0, cursor: 'pointer',
            background: 'linear-gradient(135deg, #4ade80, #22c55e)',
            boxShadow: '0 8px 32px rgba(74, 222, 128, 0.35), inset 0 1px 0 rgba(255,255,255,0.25)',
            display: 'grid', placeItems: 'center', color: '#050907', zIndex: 10,
            pointerEvents: 'auto',
          }}
        >
          <Plus size={26} strokeWidth={2.5} />
        </motion.button>

        {/* Orbit Menu */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                  zIndex: -1, pointerEvents: 'auto',
                }}
              />
              {/* Orbit items — semi-circle above FAB */}
              {availableItems.map((item, index) => {
                const totalItems = availableItems.length;
                const angleRange = 140;
                const startAngle = -90 - angleRange / 2;
                const angle = startAngle + (angleRange / (totalItems - 1)) * index;
                const rad = (angle * Math.PI) / 180;
                const radius = 110;
                const x = Math.cos(rad) * radius;
                const y = Math.sin(rad) * radius;

                return (
                  <motion.button
                    key={item.id}
                    initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                    animate={{ opacity: 1, x, y: y - 22, scale: 1 }}
                    exit={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 22, delay: index * 0.06 }}
                    onClick={() => handleNavClick(item.id)}
                    style={{
                      position: 'absolute', left: 'calc(50% - 26px)', top: '0px',
                      width: 52, height: 52, borderRadius: '50%', border: 0, cursor: 'pointer',
                      background: activeTab === item.id
                        ? 'linear-gradient(135deg, #4ade80, #22c55e)'
                        : 'rgba(30, 31, 30, 0.95)',
                      boxShadow: activeTab === item.id
                        ? '0 8px 24px rgba(74, 222, 128, 0.3)'
                        : '0 8px 24px rgba(0,0,0,0.4)',
                      color: activeTab === item.id ? '#050907' : '#ccc',
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', gap: 2, pointerEvents: 'auto',
                      backdropFilter: 'blur(12px)',
                      borderWidth: 1, borderStyle: 'solid',
                      borderColor: activeTab === item.id
                        ? 'rgba(74, 222, 128, 0.5)'
                        : 'rgba(255,255,255,0.08)',
                    }}
                  >
                    {item.icon}
                    <span style={{ fontSize: '0.55rem', fontWeight: 700, lineHeight: 1 }}>
                      {item.label}
                    </span>
                  </motion.button>
                );
              })}
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  // ─── Desktop Layout ────────────────────────────────────────────────────────
  const DesktopNav = () => (
    <motion.nav
      className="hidden lg:block"
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        display: 'flex', justifyContent: 'center',
        padding: '16px 24px',
      }}
    >
      <motion.div
        style={{
          width: '100%',
          maxWidth: navMaxWidth,
          height: '76px',
          borderRadius: 100,
          background: navBackground,
          backdropFilter: navBackdrop,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: navBoxShadow,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 22px',
        }}
      >
        {/* Left — Logo */}
        <LogoLoader />

        {/* Center — Nav Links */}
        <div style={{ display: 'flex', gap: 4, padding: 5, borderRadius: 999, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)' }}>
          {availableItems.map(item => (
            <RippleButton
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              active={activeTab === item.id}
            >
              <div className="ripple-content">
                <span className="ripple-text">{item.label}</span>
                <span className="ripple-icon">{item.icon}</span>
              </div>
            </RippleButton>
          ))}
        </div>

        {/* Right — Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {hasResults && onExport && (
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setExportOpen(!exportOpen)}
                style={{
                  background: 'rgba(74, 222, 128, 0.1)', border: '1px solid rgba(74, 222, 128, 0.2)',
                  borderRadius: 14, padding: '9px 14px', color: '#4ade80', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 700,
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
                <FileDown size={14} /> Export
              </button>
              <AnimatePresence>
                {exportOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      position: 'absolute', right: 0, top: '100%', marginTop: 8,
                      background: 'rgba(18, 18, 18, 0.98)', border: '1px solid rgba(74, 222, 128, 0.12)',
                      borderRadius: 16, padding: 6, minWidth: 150, backdropFilter: 'blur(24px)',
                      boxShadow: '0 24px 80px rgba(0,0,0,0.65)',
                    }}
                  >
                    {['json', 'edi', 'csv'].map(fmt => (
                      <button key={fmt} onClick={() => { onExport(fmt); setExportOpen(false); }}
                        style={{
                          display: 'block', width: '100%', padding: '11px 14px', border: 0, borderRadius: 12,
                          background: 'transparent', color: '#bbb', cursor: 'pointer', textAlign: 'left',
                          fontSize: '0.82rem', fontWeight: 600, fontFamily: 'inherit',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                          e.currentTarget.style.color = '#fff';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = '#bbb';
                        }}
                      >
                        Export {fmt.toUpperCase()}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* AI Dashboard Universe Button */}
          <UniverseButtonWrapper onClick={() => handleNavClick('chat')}>
            <div className="universe-inner">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className={`circle circle-${i + 1}`} />
              ))}
              <span className="universe-label"><Bot size={14} /> AI</span>
            </div>
          </UniverseButtonWrapper>
        </div>
      </motion.div>
    </motion.nav>
  );

  return (
    <>
      <MobileNav />
      <DesktopNav />
      {/* Spacer for fixed desktop nav */}
      <div className="hidden lg:block" style={{ height: 92 }} />
      {/* Spacer for fixed mobile header */}
      <div className="lg:hidden" style={{ height: 56 }} />
    </>
  );
}

// ─── RippleButton ────────────────────────────────────────────────────────────
function RippleButton({
  children, onClick, active,
}: { children: React.ReactNode; onClick: () => void; active: boolean }) {
  return (
    <StyledRippleButton onClick={onClick} className={active ? 'active' : ''}>
      {children}
    </StyledRippleButton>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLED COMPONENTS & CSS ANIMATIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Logo Shimmer + Slot Machine ─────────────────────────────────────────────

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const slotSpin = keyframes`
  0%, 20% { transform: translateY(0); }
  33.33%, 53.33% { transform: translateY(-25%); }
  66.66%, 86.66% { transform: translateY(-50%); }
  100% { transform: translateY(-75%); }
`;

const LogoLoader = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0;
  font-weight: 800;
  font-size: 1rem;
  letter-spacing: 0.04em;
  user-select: none;
  height: 1.2em;
  overflow: hidden;
  mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 0%, black 15%, black 85%, rgba(0,0,0,0) 100%);
  -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0) 0%, black 15%, black 85%, rgba(0,0,0,0) 100%);

  &::before {
    content: 'CLAIMGUARD-';
    line-height: 1.2em;
    background: linear-gradient(
      90deg,
      #888 0%, #ccc 25%, #fff 50%, #ccc 75%, #888 100%
    );
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: ${shimmer} 3s linear infinite;
  }

  &::after {
    content: 'PARSE\\A VALIDATE\\A RESOLVE\\A PARSE';
    white-space: pre;
    display: inline-block;
    line-height: 1.2em;
    color: #4ade80;
    animation: ${slotSpin} 6s cubic-bezier(0.23, 1, 0.32, 1) infinite;
  }
`;

// ─── Ripple Nav Button ───────────────────────────────────────────────────────

const StyledRippleButton = styled.button`
  position: relative;
  border: 0;
  background: transparent;
  color: #888;
  padding: 10px 18px;
  border-radius: 999px;
  font-weight: 600;
  cursor: pointer;
  overflow: hidden;
  font-family: inherit;
  transition: background 0.2s ease, color 0.2s ease;

  .ripple-content {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 1.2em;
    overflow: hidden;
  }

  .ripple-text {
    display: block;
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s;
    font-size: 0.88rem;
  }

  .ripple-icon {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    transform: translateY(120%);
    opacity: 0;
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s;
  }

  &:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #fff;

    .ripple-text {
      transform: translateY(-120%);
      opacity: 0;
    }
    .ripple-icon {
      transform: translateY(0);
      opacity: 1;
    }
  }

  &.active {
    color: #050907;
    background: #4ade80;
    box-shadow: 0 10px 24px rgba(74, 222, 128, 0.28);

    .ripple-icon {
      color: #050907;
    }

    &:hover .ripple-text {
      transform: translateY(0);
      opacity: 1;
    }
    &:hover .ripple-icon {
      transform: translateY(120%);
      opacity: 0;
    }
  }
`;

// ─── Universe Dashboard Button ───────────────────────────────────────────────

const orbitAnim = (i: number) => keyframes`
  0% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(${Math.sin(i * 0.8) * 18}px, ${Math.cos(i * 0.6) * 14}px) scale(${0.8 + (i % 3) * 0.15}); }
  50% { transform: translate(${Math.cos(i * 0.5) * 22}px, ${Math.sin(i * 0.9) * 10}px) scale(${1 + (i % 2) * 0.2}); }
  75% { transform: translate(${Math.sin(i * 1.1) * 16}px, ${-Math.cos(i * 0.7) * 18}px) scale(${0.9 + (i % 4) * 0.1}); }
  100% { transform: translate(0, 0) scale(1); }
`;

const UniverseButtonWrapper = styled.button`
  position: relative;
  border: 0;
  cursor: pointer;
  border-radius: 14px;
  padding: 0;
  width: 72px;
  height: 38px;
  overflow: hidden;
  background: radial-gradient(circle at 40% 40%, #1a1032, #0a0a14);
  box-shadow:
    inset 0 0 12px rgba(139, 92, 246, 0.15),
    0 4px 16px rgba(0, 0, 0, 0.4);
  transition: box-shadow 0.3s, transform 0.2s;
  font-family: inherit;

  &:hover {
    box-shadow:
      inset 0 0 18px rgba(139, 92, 246, 0.25),
      0 8px 32px rgba(139, 92, 246, 0.2),
      0 0 0 1px rgba(139, 92, 246, 0.15);
    transform: translateY(-1px);
  }

  .universe-inner {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .universe-label {
    position: relative;
    z-index: 2;
    color: rgba(200, 180, 255, 0.9);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    display: flex;
    align-items: center;
    gap: 4px;
    text-shadow: 0 0 8px rgba(139, 92, 246, 0.4);
  }

  ${Array.from({ length: 12 }).map((_, i) => {
    const colors = [
      'rgba(139, 92, 246, 0.4)', 'rgba(99, 102, 241, 0.35)', 'rgba(6, 182, 212, 0.3)',
      'rgba(168, 85, 247, 0.45)', 'rgba(79, 70, 229, 0.3)', 'rgba(34, 211, 238, 0.25)',
      'rgba(147, 51, 234, 0.35)', 'rgba(99, 102, 241, 0.4)', 'rgba(6, 182, 212, 0.35)',
      'rgba(139, 92, 246, 0.3)', 'rgba(168, 85, 247, 0.25)', 'rgba(79, 70, 229, 0.4)',
    ];
    const sizes = [6, 8, 5, 9, 7, 10, 6, 8, 5, 7, 9, 6];
    const blurs = [2, 3, 2, 4, 3, 5, 2, 3, 4, 3, 2, 4];
    const lefts = [15, 55, 75, 25, 65, 40, 80, 10, 50, 35, 70, 20];
    const tops = [20, 60, 30, 70, 15, 50, 75, 45, 25, 65, 40, 55];

    return `
      .circle-${i + 1} {
        position: absolute;
        width: ${sizes[i]}px;
        height: ${sizes[i]}px;
        border-radius: 50%;
        background: ${colors[i]};
        filter: blur(${blurs[i]}px);
        left: ${lefts[i]}%;
        top: ${tops[i]}%;
        animation: ${orbitAnim(i + 1).getName()} ${3 + (i % 4) * 0.8}s ease-in-out infinite;
        animation-delay: ${i * 0.15}s;
      }
    `;
  }).join('\n')}

  /* Inject the keyframes */
  ${Array.from({ length: 12 }).map((_, i) => {
    const kf = orbitAnim(i + 1);
    return kf;
  })}
`;