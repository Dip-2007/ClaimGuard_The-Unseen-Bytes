import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import { ArrowRight } from 'lucide-react';
import CardSwap, { Card } from './CardSwap';

// ─── Types ───────────────────────────────────────────────────────────────────
interface HeroSectionProps {
  onScrollToUpload?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function HeroSection({ onScrollToUpload }: HeroSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Floating particles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const particles: { x: number; y: number; vx: number; vy: number; r: number; o: number }[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    // Jittered grid initialization for even spread
    const rows = 4;
    const cols = 8;
    const count = rows * cols;
    for (let i = 0; i < count; i++) {
      const rx = i % cols;
      const ry = Math.floor(i / cols);
      particles.push({
        x: (rx / cols) * canvas.offsetWidth + (Math.random() * 40 - 20),
        y: (ry / rows) * canvas.offsetHeight + (Math.random() * 40 - 20),
        vx: (Math.random() - 0.5) * 0.1,
        vy: Math.random() * 0.3 + 0.15,
        r: Math.random() * 0.8 + 0.6,
        o: Math.random() * 0.5 + 0.3,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.offsetWidth;
        if (p.x > canvas.offsetWidth) p.x = 0;
        if (p.y > canvas.offsetHeight) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = isLight ? `rgba(0, 0, 0, ${p.o * 0.25})` : `rgba(255, 255, 255, ${p.o})`;
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <HeroWrapper>
      {/* Particle Canvas */}
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}
      />

      {/* Subtle ambient light — no green */}
      <div className="ambient-glow" />

      {/* Content */}
      <div className="hero-container">
        
        <div className="hero-text-col">
          {/* Headline */}
          <div>
            <h1 className="hero-headline">
              <span className="chrome-text" style={{ display: 'block', marginBottom: '0.1em', fontSize: '1.25em' }}>Smarter</span>
              <span className="white-text" style={{ display: 'block', whiteSpace: 'nowrap' }}>Parse, Validate & Repair</span>
              <span className="white-text" style={{ display: 'block', whiteSpace: 'nowrap' }}>Healthcare EDI Claims</span>
            </h1>
          </div>

          {/* Subtitle */}
          <p
            className="hero-subtitle"
            style={{ maxWidth: '420px', lineHeight: '1.6' }}
          >
            AI-powered compliance in one calm<br />workspace.
          </p>

          {/* CTA Button */}
          <div>
            <CTAButton onClick={onScrollToUpload}>
              <span className="btn-bg" />
              <span className="btn-label">
                Upload EDI File <ArrowRight size={16} />
              </span>
            </CTAButton>
          </div>

        </div>

        <div className="hero-graphics-col">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, x: 20, filter: 'blur(10px)' }}
            animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
            transition={{ duration: 1.2, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="md:mt-16 lg:mt-24"
          >
            <CardSwap
              width={460}
              height={200}
              cardDistance={-30}
              verticalDistance={48}
              delay={2800}
              pauseOnHover={true}
              skewAmount={0}
            >
              <Card className="p-8 flex flex-col justify-center gap-4 bg-gradient-to-br from-[#121214] to-[#0a0a0c] rounded-3xl border border-[#00d2ff]/30 shadow-[0_0_30px_rgba(0,210,255,0.08)]">
                <div className="text-xs font-bold tracking-[0.25em] text-[#00d2ff] bg-[#00d2ff]/10 border border-[#00d2ff]/20 px-4 py-1.5 rounded-full w-fit uppercase">CLAIMS</div>
                <h3 className="text-3xl font-extrabold text-white m-0 tracking-tight">837P claim</h3>
                <p className="text-[1.05rem] text-[#a0a0a0] m-0 leading-relaxed font-medium">Professional claim structure with payer and provider loops.</p>
              </Card>
              <Card className="p-8 flex flex-col justify-center gap-4 bg-gradient-to-br from-[#121214] to-[#0a0a0c] rounded-3xl border border-[#00d2ff]/30 shadow-[0_0_30px_rgba(0,210,255,0.08)]">
                <div className="text-xs font-bold tracking-[0.25em] text-[#00d2ff] bg-[#00d2ff]/10 border border-[#00d2ff]/20 px-4 py-1.5 rounded-full w-fit uppercase">PAYMENTS</div>
                <h3 className="text-3xl font-extrabold text-white m-0 tracking-tight">835 remittance</h3>
                <p className="text-[1.05rem] text-[#a0a0a0] m-0 leading-relaxed font-medium">Payment and adjustment details for remit analysis.</p>
              </Card>
              <Card className="p-8 flex flex-col justify-center gap-4 bg-gradient-to-br from-[#121214] to-[#0a0a0c] rounded-3xl border border-[#00d2ff]/30 shadow-[0_0_30px_rgba(0,210,255,0.08)]">
                <div className="text-xs font-bold tracking-[0.25em] text-[#00d2ff] bg-[#00d2ff]/10 border border-[#00d2ff]/20 px-4 py-1.5 rounded-full w-fit uppercase">MEMBERS</div>
                <h3 className="text-3xl font-extrabold text-white m-0 tracking-tight">834 enrollment</h3>
                <p className="text-[1.05rem] text-[#a0a0a0] m-0 leading-relaxed font-medium">Member additions, changes, and terminations.</p>
              </Card>
            </CardSwap>
          </motion.div>
        </div>

        {/* Scroll Indicator - Absolute Centered */}
        <motion.div 
          className="scroll-indicator"
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: 1, y: [0, 12, 0] }}
          transition={{ 
            opacity: { duration: 0.8, delay: 1.2 },
            y: { repeat: Infinity, duration: 2.2, ease: "easeInOut" }
          }}
        >
          <span className="scroll-text">SCROLL</span>
          <div className="scroll-line" />
        </motion.div>

      </div>
    </HeroWrapper>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

const HeroWrapper = styled.section`
  position: relative;
  min-height: 80vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  overflow: visible;

  .ambient-glow {
    position: absolute;
    top: 10%;
    left: 50%;
    transform: translateX(-50%);
    width: 700px;
    height: 500px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.015), transparent 70%);
    filter: blur(100px);
    pointer-events: none;
  }

  .hero-container {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 1300px;
    padding: 0 24px;
    gap: 60px;

    @media (min-width: 1024px) {
      flex-direction: row;
      justify-content: space-between;
      gap: 100px;
    }
  }

  .hero-text-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 28px;
    flex: 1;

    @media (min-width: 1024px) {
      align-items: flex-start;
      text-align: left;
    }
  }

  .hero-graphics-col {
    flex: 1;
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    perspective: 1200px;
    width: 100%;
    min-height: 480px;

    @media (min-width: 1024px) {
      justify-content: flex-end;
      padding-right: 0px;
    }
  }

  .hero-headline {
    margin: 0;
    font-size: clamp(2.4rem, 4vw, 4.8rem);
    font-weight: 800;
    line-height: 1.05;
    letter-spacing: -0.03em;
    font-family: 'Plus Jakarta Sans', sans-serif;
  }

  .chrome-text {
    background: linear-gradient(
      180deg,
      rgba(130, 255, 170, 0.9) 0%,
      rgba(74, 222, 128, 0.6) 50%,
      rgba(34, 197, 94, 0.3) 100%
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-style: italic;
    font-weight: 700;
    padding-right: 0.08em;
    display: inline-block;
  }

  .white-text {
    color: var(--text);
    opacity: 0.88;
  }

  .hero-subtitle {
    margin: 0;
    font-size: clamp(1.1rem, 1.8vw, 1.5rem);
    color: var(--muted);
    font-weight: 500;
    letter-spacing: 0.01em;
    max-width: 500px;
  }

  .scroll-indicator {
    position: absolute;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    z-index: 10;
  }

  .scroll-text {
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.25em;
    color: var(--muted);
    text-transform: uppercase;
    opacity: 0.7;
  }

  .scroll-line {
    width: 1px;
    height: 40px;
    background: linear-gradient(
      to bottom,
      rgba(200, 200, 210, 0.4),
      rgba(160, 160, 170, 0.15),
      transparent
    );
  }
`;

const CTAButton = styled.button`
  position: relative;
  border: 0;
  cursor: pointer;
  padding: 0;
  background: transparent;
  font-family: inherit;

  .btn-bg {
    position: absolute;
    inset: 0;
    border-radius: 999px;
    background: var(--bg-card-strong);
    border: 1px solid rgba(74, 222, 128, 0.25);
    box-shadow:
      0 0 30px rgba(74, 222, 128, 0.08),
      0 0 60px rgba(34, 197, 94, 0.04),
      inset 0 1px 0 rgba(255, 255, 255, 0.04);
    transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .btn-label {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 16px 36px;
    font-size: 0.92rem;
    font-weight: 700;
    color: var(--accent);
    letter-spacing: 0.01em;
    transition: color 0.25s;
  }

  &:hover .btn-bg {
    border-color: rgba(74, 222, 128, 0.45);
    box-shadow:
      0 0 40px rgba(74, 222, 128, 0.15),
      0 0 80px rgba(34, 197, 94, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
    transform: translateY(-1px);
  }

  &:hover .btn-label {
    color: #fff;
  }

  &:active .btn-bg {
    transform: translateY(0);
  }
`;
