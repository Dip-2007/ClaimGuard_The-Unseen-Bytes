import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styled from 'styled-components';
import { Mail, Lock, User, ArrowRight, Bot, Globe, X } from 'lucide-react';
import GlareHover from './GlareHover';

interface AuthPageProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthMode = 'login' | 'register';

export default function AuthPage({ isOpen, onClose }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Background Particles Logic
  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const particles: { x: number; y: number; vx: number; vy: number; r: number; o: number }[] = [];

    const resize = () => {
      canvas.width = window.innerWidth * window.devicePixelRatio;
      canvas.height = window.innerHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        r: Math.random() * 1.5 + 0.5,
        o: Math.random() * 0.5 + 0.2,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.fillStyle = 'rgba(74, 222, 128, 0.5)';
      
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = window.innerWidth;
        if (p.x > window.innerWidth) p.x = 0;
        if (p.y < 0) p.y = window.innerHeight;
        if (p.y > window.innerHeight) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.globalAlpha = p.o;
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, [isOpen]);

  const toggleMode = () => setMode(prev => prev === 'login' ? 'register' : 'login');

  return (
    <AnimatePresence>
      {isOpen && (
        <AuthOverlay
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <canvas ref={canvasRef} className="auth-canvas" />
          
          <CloseButton onClick={onClose} whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }}>
            <X size={24} />
          </CloseButton>

          <div className="auth-content-wrap">
            <GlareHover
               width="min(90vw, 440px)"
               height="auto"
               background="rgba(15, 15, 18, 0.75)"
               borderRadius="32px"
               borderColor="rgba(74, 222, 128, 0.15)"
               glareColor="#4ade80"
               glareOpacity={0.12}
               className="auth-card-hover"
            >
              <AuthCard>
                <div className="card-header">
                  <LogoArea>
                     <div className="logo-pulse" />
                     <span className="logo-text">CLAIM<span>GUARD</span></span>
                  </LogoArea>
                  <h2>{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
                  <p>{mode === 'login' ? 'Enter your credentials to access the workspace' : 'Join the most advanced EDI validation platform'}</p>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={mode}
                    initial={{ opacity: 0, x: mode === 'login' ? -20 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: mode === 'login' ? 20 : -20 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                  >
                    <FormContainer>
                      {mode === 'register' && (
                        <InputGroup>
                          <label><User size={14} /> Full Name</label>
                          <div className="input-wrap">
                            <input type="text" placeholder="John Doe" />
                          </div>
                        </InputGroup>
                      )}

                      <InputGroup>
                        <label><Mail size={14} /> Email Address</label>
                        <div className="input-wrap">
                          <input type="email" placeholder="name@company.com" />
                        </div>
                      </InputGroup>

                      <InputGroup>
                        <label><Lock size={14} /> Password</label>
                        <div className="input-wrap">
                          <input type="password" placeholder="••••••••" />
                        </div>
                      </InputGroup>

                      <PrimaryButton whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                         {mode === 'login' ? 'Access Workspace' : 'Initialize Account'}
                         <ArrowRight size={18} />
                      </PrimaryButton>
                    </FormContainer>
                  </motion.div>
                </AnimatePresence>

                <Divider>
                  <span>Or continue with</span>
                </Divider>

                <SocialGroup>
                   <SocialBtn whileHover={{ y: -3, background: 'rgba(255,255,255,0.08)' }}>
                      <Globe size={20} />
                   </SocialBtn>
                   <SocialBtn whileHover={{ y: -3, background: 'rgba(255,255,255,0.08)' }}>
                      <Bot size={20} />
                   </SocialBtn>
                </SocialGroup>

                <ModeSwitch>
                  {mode === 'login' ? "Don't have an account?" : "Already a member?"}{' '}
                  <button onClick={toggleMode}>{mode === 'login' ? 'Register Now' : 'Sign In'}</button>
                </ModeSwitch>
              </AuthCard>
            </GlareHover>
          </div>
        </AuthOverlay>
      )}
    </AnimatePresence>
  );
}

const AuthOverlay = styled(motion.div)`
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: #050507;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  .auth-canvas {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .auth-content-wrap {
    position: relative;
    z-index: 10;
    perspective: 1200px;
  }
`;

const CloseButton = styled(motion.button)`
  position: absolute;
  top: 40px;
  right: 40px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  cursor: pointer;
  z-index: 20;
  backdrop-filter: blur(12px);
`;

const AuthCard = styled.div`
  width: 100%;
  padding: 48px 40px;
  backdrop-filter: blur(24px);
  display: flex;
  flex-direction: column;
  gap: 32px;

  .card-header {
    text-align: center;
    h2 {
      margin: 16px 0 8px;
      font-size: 1.8rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #fff;
    }
    p {
      color: #888;
      font-size: 0.95rem;
      line-height: 1.5;
      margin: 0;
    }
  }
`;

const LogoArea = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  
  .logo-pulse {
    width: 12px;
    height: 12px;
    background: #4ade80;
    border-radius: 50%;
    box-shadow: 0 0 15px rgba(74, 222, 128, 0.6);
    animation: pulse 2s infinite;
  }

  .logo-text {
    font-weight: 900;
    letter-spacing: 0.1em;
    font-size: 0.85rem;
    color: #fff;
    span { color: #4ade80; }
  }

  @keyframes pulse {
    0% { transform: scale(1); opacity: 0.8; }
    50% { transform: scale(1.3); opacity: 1; box-shadow: 0 0 25px rgba(74, 222, 128, 0.8); }
    100% { transform: scale(1); opacity: 0.8; }
  }
`;

const FormContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const InputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;

  label {
    font-size: 0.75rem;
    font-weight: 700;
    color: #4ade80;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: flex;
    align-items: center;
    gap: 6px;
    opacity: 0.8;
  }

  .input-wrap {
    position: relative;
    input {
      width: 100%;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 14px 18px;
      border-radius: 14px;
      color: #fff;
      font-size: 1rem;
      font-family: inherit;
      transition: all 0.3s;

      &:focus {
        outline: none;
        background: rgba(74, 222, 128, 0.03);
        border-color: rgba(74, 222, 128, 0.4);
        box-shadow: 0 0 20px rgba(74, 222, 128, 0.08);
      }
      &::placeholder { color: #555; }
    }
  }
`;

const PrimaryButton = styled(motion.button)`
  background: linear-gradient(135deg, #4ade80, #22c55e);
  color: #050907;
  border: 0;
  border-radius: 16px;
  padding: 16px;
  font-weight: 800;
  font-size: 1rem;
  letter-spacing: 0.02em;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 12px;
  box-shadow: 0 10px 30px rgba(74, 222, 128, 0.2);
`;

const Divider = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
  color: #444;
  font-size: 0.75rem;
  text-transform: uppercase;
  font-weight: 700;
  
  &::before, &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(255, 255, 255, 0.05);
  }
`;

const SocialGroup = styled.div`
  display: flex;
  gap: 12px;
  justify-content: center;
`;

const SocialBtn = styled(motion.button)`
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #ccc;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: all 0.3s;
`;

const ModeSwitch = styled.div`
  text-align: center;
  font-size: 0.9rem;
  color: #666;
  
  button {
    background: none;
    border: none;
    color: #4ade80;
    font-weight: 700;
    cursor: pointer;
    padding: 0;
    margin-left: 4px;
    &:hover { text-decoration: underline; }
  }
`;
