import React from 'react';
import { delayRender, continueRender } from 'remotion';
import {
  AbsoluteFill, Sequence, OffthreadVideo, staticFile, useCurrentFrame, interpolate, spring, useVideoConfig, Easing,
} from 'remotion';

const FONT = "'Share Tech Mono', ui-monospace, monospace";
const RED = '#E83D3D';
const INK = '#EFEFE2';
const fps = 30;

const fontHandle = delayRender('font');
new window.FontFace('Share Tech Mono', `url(${staticFile('stm.ttf')})`).load().then((f) => {
  (document.fonts as any).add(f); continueRender(fontHandle);
});

// [label, title, caption, start second in rec.mp4, duration, zoom from, zoom to, zoom origin]
type Clip = [string, string, string, number, number, number, number, string];
const PANEL = '100% 35%';
const CLIPS: Clip[] = [
  ['01 / RADAR', 'A live globe of every bust', 'Drag the wireframe globe. Each square is a seizure, coloured by severity.', 5.5, 6, 1.0, 1.06, '60% 45%'],
  ['02 / CASE FILE', 'Click a bust, the camera hops there', 'Location, quantity, agency, source and the original headline.', 19.8, 5, 1.1, 1.3, '100% 12%'],
  ['03 / DRUG DOSSIER', 'Know what was seized', 'Legal thresholds under the NDPS Act, known names and trafficking routes, with cited sources.', 25.2, 5.5, 1.15, 1.35, '50% 25%'],
  ['04 / INTEL', 'The briefing', 'Totals, critical cases, drug-type mix and the top states.', 32.8, 4.2, 1.12, 1.3, PANEL],
  ['05 / BUSTS', 'Most wanted', 'The ten biggest busts, filterable by drug. Click one to fly there.', 38.3, 4.4, 1.12, 1.3, PANEL],
  ['06 / TRENDING', 'Biggest and newest', 'Highest-volume seizures and the latest ones, ranked.', 43.3, 4.2, 1.12, 1.3, PANEL],
  ['07 / AGENCY', 'Who is making the busts', 'Every agency ranked by seized volume.', 48.4, 4, 1.12, 1.3, PANEL],
  ['08 / COMPARE', 'State vs state', 'Volume by state and counts by drug type side by side.', 53.4, 4, 1.12, 1.3, PANEL],
  ['09 / FESTIVAL', 'Rave and festival busts', 'A separate dataset of concert and rave-party seizures.', 58.8, 4, 1.12, 1.3, PANEL],
  ['10 / TERMINAL', 'Query it from a command line', 'stats, top, find, states, agencies, recent.', 63.8, 7, 1.12, 1.3, PANEL],
  ['11 / FILTERS', 'Slice by drug, state, weight', 'Filter ops narrow the globe and every panel at once.', 72, 4.4, 1.12, 1.3, '100% 30%'],
];

const INTRO = 4 * fps;
const OUTRO = 5 * fps;
const PIPE = 4 * fps;
const clipFrames = CLIPS.map((c) => Math.round(c[4] * fps));
export const TOTAL = INTRO + clipFrames.reduce((a, b) => a + b, 0) + PIPE + OUTRO;



const Scanlines: React.FC = () => (
  <AbsoluteFill style={{
    pointerEvents: 'none',
    background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 3px)',
  }} />
);

const Typed: React.FC<{ text: string; start?: number; cps?: number; style?: React.CSSProperties }> = ({ text, start = 0, cps = 40, style }) => {
  const f = useCurrentFrame();
  const n = Math.max(0, Math.floor(((f - start) / fps) * cps));
  const cursor = Math.floor(f / 15) % 2 === 0 && n < text.length + 20;
  return <span style={style}>{text.slice(0, n)}<span style={{ opacity: cursor ? 1 : 0, color: RED }}>█</span></span>;
};

const Intro: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 18 } });
  const out = interpolate(f, [INTRO - 12, INTRO], [1, 0], { extrapolateLeft: 'clamp' });
  return (
    <AbsoluteFill style={{ background: '#000', alignItems: 'center', justifyContent: 'center', fontFamily: FONT, color: INK, opacity: out }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 36, transform: `scale(${0.9 + s * 0.1})`, opacity: s }}>
        <div style={{ width: 150, height: 150, border: `3px solid ${RED}`, color: RED, fontSize: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 40px ${RED}55` }}>NK</div>
        <div>
          <div style={{ fontSize: 120, letterSpacing: '0.18em', lineHeight: 1 }}>NARC KART</div>
          <div style={{ fontSize: 30, letterSpacing: '0.5em', color: '#8a8a80', marginTop: 14 }}>OPS CENTER</div>
        </div>
      </div>
      <div style={{ position: 'absolute', bottom: 230, fontSize: 38, letterSpacing: '0.08em' }}>
        <Typed text="India's drug seizure tracker." start={18} />
      </div>
      <div style={{ position: 'absolute', top: 60, right: 80, border: `2px solid ${RED}`, color: RED, padding: '8px 20px', fontSize: 24, letterSpacing: '0.4em', opacity: interpolate(f, [30, 40], [0, 0.8], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>CLASSIFIED</div>
      <Scanlines />
    </AbsoluteFill>
  );
};

const ClipScene: React.FC<{ clip: Clip; dur: number }> = ({ clip, dur }) => {
  const [label, title, caption, from, , z0, z1, origin] = clip;
  const f = useCurrentFrame();
  const fade = interpolate(f, [0, 8, dur - 8, dur], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const zoom = interpolate(f, [0, dur], [z0, z1], { easing: Easing.inOut(Easing.quad) });
  const slide = interpolate(f, [4, 16], [40, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ background: '#000', opacity: fade }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: origin }}>
        <OffthreadVideo src={staticFile('rec.mp4')} startFrom={Math.round(from * fps)} muted />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.6) 22%, transparent 42%)' }} />
      <div style={{ position: 'absolute', left: 110, bottom: 110, fontFamily: FONT, color: INK, transform: `translateY(${slide}px)` }}>
        <div style={{ color: RED, fontSize: 26, letterSpacing: '0.35em', marginBottom: 12 }}>{label}</div>
        <div style={{ fontSize: 62, letterSpacing: '0.03em', marginBottom: 14, textShadow: '0 2px 20px #000' }}>{title}</div>
        <div style={{ fontSize: 30, color: '#b9b9ad', maxWidth: 1300 }}>{caption}</div>
      </div>
      <div style={{ position: 'absolute', left: 110, bottom: 84, height: 4, width: interpolate(f, [0, dur], [0, 520]), background: RED }} />
    </AbsoluteFill>
  );
};

const Pipeline: React.FC = () => {
  const f = useCurrentFrame();
  const steps = ['Google News RSS', 'update_data.py', 'data.json', 'Vercel redeploy'];
  const fade = interpolate(f, [0, 8, PIPE - 8, PIPE], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: '#000', fontFamily: FONT, color: INK, alignItems: 'center', justifyContent: 'center', opacity: fade }}>
      <div style={{ color: RED, fontSize: 26, letterSpacing: '0.35em', marginBottom: 30 }}>12 / DATA PIPELINE</div>
      <div style={{ fontSize: 58, marginBottom: 70 }}>Refreshed every Sunday. No backend.</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
        {steps.map((s, i) => {
          const o = interpolate(f, [12 + i * 10, 22 + i * 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          return (
            <React.Fragment key={s}>
              {i > 0 && <div style={{ color: RED, fontSize: 40, opacity: o }}>→</div>}
              <div style={{ border: `2px solid ${i === 2 ? RED : '#444'}`, padding: '22px 30px', fontSize: 32, opacity: o, background: '#0b0b0b' }}>{s}</div>
            </React.Fragment>
          );
        })}
      </div>
      <div style={{ fontSize: 26, color: '#8a8a80', marginTop: 60 }}>GitHub Action · merges new busts, never deletes · static JSON on Vercel</div>
      <Scanlines />
    </AbsoluteFill>
  );
};

const Outro: React.FC = () => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: '#000', fontFamily: FONT, color: INK, alignItems: 'center', justifyContent: 'center', opacity: o }}>
      <div style={{ fontSize: 100, letterSpacing: '0.18em' }}>NARC KART</div>
      <div style={{ fontSize: 44, color: RED, marginTop: 40 }}><Typed text="narc-kart.vercel.app" start={10} cps={30} /></div>
      <div style={{ fontSize: 26, color: '#8a8a80', marginTop: 40 }}>github.com/AayushBhat07/narc-kart</div>
      <Scanlines />
    </AbsoluteFill>
  );
};

export const Demo: React.FC = () => {
  let t = INTRO;
  return (
    <AbsoluteFill style={{ background: '#000' }}>

      <Sequence durationInFrames={INTRO}><Intro /></Sequence>
      {CLIPS.map((clip, i) => {
        const start = t; t += clipFrames[i];
        return (
          <Sequence key={clip[0]} from={start} durationInFrames={clipFrames[i]}>
            <ClipScene clip={clip} dur={clipFrames[i]} />
          </Sequence>
        );
      })}
      <Sequence from={t} durationInFrames={PIPE}><Pipeline /></Sequence>
      <Sequence from={t + PIPE} durationInFrames={OUTRO}><Outro /></Sequence>
    </AbsoluteFill>
  );
};
