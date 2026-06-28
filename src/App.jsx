import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabase';
import HeartTree from './components/HeartTree';

const BORN = new Date('2002-08-24T00:00:00').getTime();

// ─── Config ───────────────────────────────────────────────────────────────────
const CONFIG = {
  questionText: 'Si Colombia gana el mundial usted y yo qué 🇨🇴',
  yesText: 'Juntos como Petro y Cepeda',
  noText: 'Nadota',
  name: 'Valen',
};

// ─── Ruleta segments ──────────────────────────────────────────────────────────
const PLANS = [
  { emoji: '🍽️', name: 'Ir a comer' },
  { emoji: '🎬', name: 'Cine' },
  { emoji: '💄', name: 'Maquillaje' },
  { emoji: '🛍️', name: 'De compras' },
  { emoji: '✨', name: 'Algo diferente' },
  { emoji: '🧺', name: 'Picnic' },
  { emoji: '🍽️', name: 'Ir a comer' },
  { emoji: '🍿', name: 'Noche de pelis' },
  { emoji: '🎬', name: 'Cine' },
  { emoji: '🍝', name: 'Cocinar juntos' },
  { emoji: '✨', name: 'Algo diferente' },
  { emoji: '🛍️', name: 'De compras' },
];
const SEG_COLORS = [
  '#FFB0C0','#FCD9A8','#FF8FA3','#FFCBA8','#F2B8C0','#FFDCC4',
  '#FFB0C0','#FCD9A8','#FF8FA3','#FFCBA8','#F2B8C0','#FFDCC4',
];
const CX = 170, CY = 170, R = 160;

function buildSegments() {
  return PLANS.map((p, i) => {
    const a0 = (-90 + i * 30) * Math.PI / 180;
    const a1 = (-90 + (i + 1) * 30) * Math.PI / 180;
    const x0 = CX + R * Math.cos(a0), y0 = CY + R * Math.sin(a0);
    const x1 = CX + R * Math.cos(a1), y1 = CY + R * Math.sin(a1);
    const path = `M${CX} ${CY} L${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
    return { ...p, color: SEG_COLORS[i], path, labelTransform: `rotate(${15 + 30 * i} 170 170)` };
  });
}

function buildHearts() {
  const e = ['💛','💙','❤️','💕','💖'];
  return Array.from({ length: 28 }, (_, i) => ({
    id: i,
    emoji: e[i % e.length],
    left: Math.round(Math.random() * 100),
    delay: (Math.random() * 2.5).toFixed(2),
    dur: (3 + Math.random() * 2.5).toFixed(2),
    size: Math.round(18 + Math.random() * 22),
  }));
}

const SEGMENTS = buildSegments();
const HEARTS = buildHearts();

function loadInitial() {
  const saidYes = localStorage.getItem('valen_saidyes') === '1';
  return {
    screen: saidYes ? 'app' : 'question',
    celebrating: false,
    tab: 'ruleta',
    rotation: 0,
    spinning: false,
    isResult: false,
    resultIdx: null,
    noLeft: 120,
    noTop: 160,
    fleeCount: 0,
    places: [],
    history: [],
    dbLoading: true,
    form: { name: '', rating: 0, note: '', photo: null },
  };
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [s, setS] = useState(loadInitial);
  const [now, setNow] = useState(Date.now);
  const areaRef = useRef(null);
  const fileRef = useRef(null);
  const celebTimerRef = useRef(null);
  const spinTimerRef = useRef(null);

  // ── Live counter for 'Para ti' tab ──
  useEffect(() => {
    if (s.tab !== 'valen') return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [s.tab]);

  // ── Fetch initial data from Supabase ──
  useEffect(() => {
    Promise.all([
      supabase.from('places').select('*').order('created_at', { ascending: false }),
      supabase.from('history').select('*').order('created_at', { ascending: false }),
    ]).then(([{ data: places }, { data: history }]) => {
      setS(prev => ({
        ...prev,
        places: places ?? [],
        history: history ?? [],
        dbLoading: false,
      }));
    });
  }, []);

  // center No button once area is measured
  useEffect(() => {
    if (areaRef.current && s.screen === 'question') {
      const rect = areaRef.current.getBoundingClientRect();
      setS(prev => ({ ...prev, noLeft: Math.max(0, (rect.width - 124) / 2), noTop: 175 }));
    }
  }, [s.screen]);

  useEffect(() => () => {
    clearTimeout(celebTimerRef.current);
    clearTimeout(spinTimerRef.current);
  }, []);

  // ── Question screen helpers ──
  const relocateNo = useCallback((px, py) => {
    if (!areaRef.current) return;
    const rect = areaRef.current.getBoundingClientRect();
    const bw = 124, bh = 50;
    const maxX = Math.max(0, rect.width - bw);
    const maxY = Math.max(0, rect.height - bh);
    let nx = 0, ny = 0;
    for (let i = 0; i < 14; i++) {
      nx = Math.random() * maxX;
      ny = Math.random() * maxY;
      if (px == null || Math.hypot(px - (nx + bw / 2), py - (ny + bh / 2)) > 130) break;
    }
    setS(prev => ({ ...prev, noLeft: nx, noTop: ny, fleeCount: prev.fleeCount + 1 }));
  }, []);

  const onAreaMove = useCallback((e) => {
    if (!areaRef.current) return;
    const rect = areaRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const bx = s.noLeft + 62, by = s.noTop + 25;
    if (Math.hypot(cx - bx, cy - by) < 100) relocateNo(cx, cy);
  }, [s.noLeft, s.noTop, relocateNo]);

  const fleeNow = useCallback((e) => {
    e?.preventDefault();
    relocateNo(null, null);
  }, [relocateNo]);

  const sayYes = useCallback(() => {
    localStorage.setItem('valen_saidyes', '1');
    setS(prev => ({ ...prev, celebrating: true }));
    celebTimerRef.current = setTimeout(() => {
      setS(prev => ({ ...prev, celebrating: false, screen: 'app' }));
    }, 4400);
  }, []);

  const enterNow = useCallback(() => {
    clearTimeout(celebTimerRef.current);
    setS(prev => ({ ...prev, celebrating: false, screen: 'app' }));
  }, []);

  // ── Ruleta helpers ──
  const spin = useCallback(() => {
    if (s.spinning) return;
    const extra = 360 * 5 + Math.random() * 360;
    const newRot = s.rotation + extra;
    setS(prev => ({ ...prev, spinning: true, isResult: false, rotation: newRot }));
    spinTimerRef.current = setTimeout(() => {
      const eff = (((-newRot) % 360) + 360) % 360;
      const idx = Math.floor(eff / 30) % 12;
      setS(prev => ({ ...prev, spinning: false, isResult: true, resultIdx: idx }));
    }, 4500);
  }, [s.spinning, s.rotation]);

  const closeResult = useCallback(() => setS(prev => ({ ...prev, isResult: false })), []);
  const stopProp = useCallback((e) => e.stopPropagation(), []);

  const saveToHistory = useCallback(async () => {
    const seg = SEGMENTS[s.resultIdx];
    if (!seg) return;
    const { data, error } = await supabase.from('history').insert({
      emoji: seg.emoji,
      name: seg.name,
      date: new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }),
    }).select().single();
    if (error || !data) return;
    setS(prev => ({ ...prev, history: [data, ...prev.history], isResult: false }));
  }, [s.resultIdx]);

  const deleteHistory = useCallback(async (id) => {
    await supabase.from('history').delete().eq('id', id);
    setS(prev => ({ ...prev, history: prev.history.filter(x => x.id !== id) }));
  }, []);

  // ── Lugares helpers ──
  const setFormName = (e) => { const v = e.target.value; setS(p => ({ ...p, form: { ...p.form, name: v } })); };
  const setFormNote = (e) => { const v = e.target.value; setS(p => ({ ...p, form: { ...p.form, note: v } })); };
  const setFormRating = (r) => setS(p => ({ ...p, form: { ...p.form, rating: r } }));
  const pickPhoto = () => fileRef.current?.click();
  const onPhoto = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => setS(p => ({ ...p, form: { ...p.form, photo: rd.result } }));
    rd.readAsDataURL(f);
  };

  const savePlace = async () => {
    if (!s.form.name.trim()) return;
    const { data, error } = await supabase.from('places').insert({
      name: s.form.name.trim(),
      rating: s.form.rating,
      note: s.form.note,
      photo: s.form.photo,
    }).select().single();
    if (error || !data) return;
    setS(prev => ({ ...prev, places: [data, ...prev.places], form: { name: '', rating: 0, note: '', photo: null } }));
    if (fileRef.current) fileRef.current.value = '';
  };

  const deletePlace = async (id) => {
    await supabase.from('places').delete().eq('id', id);
    setS(prev => ({ ...prev, places: prev.places.filter(x => x.id !== id) }));
  };

  const setTab = (t) => setS(p => ({ ...p, tab: t }));

  // ── Derived ──
  const yesScale = Math.min(1 + s.fleeCount * 0.14, 2.4);
  const resultSeg = s.resultIdx != null ? SEGMENTS[s.resultIdx] : null;
  const isQuestion = s.screen === 'question' && !s.celebrating;
  const isApp = s.screen === 'app' && !s.celebrating;

  return (
    <div style={{ width: '100%', maxWidth: 460, flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', color: '#7A2E3F' }}>

      {/* ── QUESTION SCREEN ── */}
      {isQuestion && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '26px 22px 18px', minHeight: '100dvh' }}>
          <div style={{ textAlign: 'center', marginTop: '7vh' }}>
            <div style={{ fontFamily: "'Caveat', cursive", fontSize: 30, color: '#E84A6F', fontWeight: 700, animation: 'floaty 4s ease-in-out infinite' }}>
              Para mi Valecita 💕
            </div>
            <h1 style={{ fontFamily: "'Caveat', cursive", fontSize: 46, lineHeight: 1.08, margin: '16px 0 0', color: '#7A2E3F', fontWeight: 700, textWrap: 'balance' }}>
              {CONFIG.questionText}
            </h1>
          </div>

          <div
            ref={areaRef}
            onPointerMove={onAreaMove}
            style={{ position: 'relative', flex: 1, minHeight: 330, marginTop: 22, touchAction: 'none' }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 34 }}>
              <button
                onClick={sayYes}
                style={{
                  transform: `scale(${yesScale})`,
                  transformOrigin: 'center top',
                  transition: 'transform .28s cubic-bezier(.34,1.56,.64,1)',
                  background: 'linear-gradient(135deg,#FF7AA0,#E84A6F)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 999,
                  padding: '16px 26px',
                  fontWeight: 700,
                  fontSize: 17,
                  boxShadow: '0 12px 26px rgba(232,74,111,.42)',
                  cursor: 'pointer',
                  maxWidth: '90vw',
                }}
              >
                {CONFIG.yesText} 💛
              </button>
            </div>

            <button
              onPointerDown={fleeNow}
              onClick={fleeNow}
              onMouseEnter={fleeNow}
              style={{
                position: 'absolute',
                left: s.noLeft,
                top: s.noTop,
                transition: 'left .16s ease, top .16s ease',
                background: '#fff',
                color: '#C28C99',
                border: '2px solid #F2C9D4',
                borderRadius: 999,
                padding: '13px 22px',
                fontWeight: 600,
                fontSize: 15,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,.08)',
                whiteSpace: 'nowrap',
              }}
            >
              {CONFIG.noText} 🙈
            </button>
          </div>
        </div>
      )}

      {/* ── CELEBRATION OVERLAY ── */}
      {s.celebrating && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'linear-gradient(165deg,#FFE3EC,#FBD3E0)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {HEARTS.map(h => (
            <span key={h.id} style={{ position: 'absolute', top: -40, left: `${h.left}%`, fontSize: h.size, animation: `heartFall ${h.dur}s linear ${h.delay}s infinite` }}>
              {h.emoji}
            </span>
          ))}
          <div style={{ position: 'relative', textAlign: 'center', padding: 24, animation: 'popIn .8s cubic-bezier(.2,1.4,.4,1) both' }}>
            <div style={{ fontSize: 60 }}>💛💙❤️</div>
            <div style={{ fontFamily: "'Caveat', cursive", fontSize: 46, color: '#E84A6F', marginTop: 8, fontWeight: 700 }}>¡Obvio que sí!</div>
            <div style={{ fontWeight: 600, fontSize: 18, marginTop: 6, color: '#7A2E3F', maxWidth: 280 }}>{CONFIG.yesText} 🇨🇴💕</div>
            <button
              onClick={enterNow}
              style={{ marginTop: 26, background: '#fff', color: '#E84A6F', border: 'none', borderRadius: 999, padding: '14px 32px', fontWeight: 700, fontSize: 16, boxShadow: '0 8px 20px rgba(0,0,0,.14)', cursor: 'pointer' }}
            >
              Entrar a lo nuestro 💕
            </button>
          </div>
        </div>
      )}

      {/* ── APP SHELL ── */}
      {isApp && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
          <header style={{ padding: '18px 20px 8px', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Caveat', cursive", fontSize: 32, color: '#E84A6F', fontWeight: 700 }}>
              Para Valecita💕
            </div>
          </header>

          <main style={{ flex: 1, overflowY: 'auto', padding: '4px 18px 104px' }}>

            {/* ── TAB: RULETA ── */}
            {s.tab === 'ruleta' && (
              <div style={{ textAlign: 'center', paddingTop: 8 }}>
                <h2 style={{ fontFamily: "'Caveat', cursive", fontSize: 36, margin: '4px 0 0', color: '#7A2E3F', fontWeight: 700 }}>
                  ¿Qué hacemos hoy?
                </h2>
                <p style={{ fontSize: 13, color: '#C28C99', margin: '2px 0 16px' }}>Gira la ruleta del destino 💫</p>

                <div style={{ position: 'relative', width: 'min(82vw, 330px)', margin: '0 auto' }}>
                  <div style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', zIndex: 3, width: 0, height: 0, borderLeft: '14px solid transparent', borderRight: '14px solid transparent', borderTop: '26px solid #E84A6F', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.28))' }} />

                  <svg
                    viewBox="0 0 340 340"
                    style={{ width: '100%', display: 'block', transform: `rotate(${s.rotation}deg)`, transition: 'transform 4.4s cubic-bezier(0.16,0.86,0.28,1)', transformOrigin: 'center', filter: 'drop-shadow(0 12px 22px rgba(180,60,90,.28))' }}
                  >
                    <circle cx="170" cy="170" r="167" fill="#fff" />
                    {SEGMENTS.map((seg, i) => (
                      <path key={i} d={seg.path} fill={seg.color} stroke="#ffffff" strokeWidth="2" />
                    ))}
                    {SEGMENTS.map((seg, i) => (
                      <g key={i} transform={seg.labelTransform}>
                        <text x="170" y="50" textAnchor="middle" style={{ fontSize: 26 }}>{seg.emoji}</text>
                      </g>
                    ))}
                    <circle cx="170" cy="170" r="27" fill="#fff" stroke="#F2C9D4" strokeWidth="3" />
                    <text x="170" y="179" textAnchor="middle" style={{ fontSize: 22 }}>💗</text>
                  </svg>
                </div>

                <button
                  onClick={spin}
                  disabled={s.spinning}
                  style={{ marginTop: 24, background: 'linear-gradient(135deg,#FF7AA0,#E84A6F)', color: '#fff', border: 'none', borderRadius: 999, padding: '15px 44px', fontWeight: 700, fontSize: 17, boxShadow: '0 10px 22px rgba(232,74,111,.38)', cursor: s.spinning ? 'default' : 'pointer', opacity: s.spinning ? 0.8 : 1 }}
                >
                  {s.spinning ? 'Girando... 🌀' : '¡Girar! 🎡'}
                </button>
              </div>
            )}

            {/* ── TAB: LUGARES ── */}
            {s.tab === 'lugares' && (
              <div>
                <h2 style={{ fontFamily: "'Caveat', cursive", fontSize: 36, margin: '4px 0 0', textAlign: 'center', color: '#7A2E3F', fontWeight: 700 }}>
                  Nuestros lugares 📍
                </h2>
                <p style={{ fontSize: 13, color: '#C28C99', textAlign: 'center', margin: '2px 0 16px' }}>Restaurantes y cafés que amamos</p>

                <div style={{ background: '#fff', borderRadius: 20, padding: 16, boxShadow: '0 6px 18px rgba(180,60,90,.1)', marginBottom: 18 }}>
                  <input
                    value={s.form.name}
                    onChange={setFormName}
                    placeholder="Nombre del lugar..."
                    style={{ width: '100%', border: '1.5px solid #F2D6DE', borderRadius: 12, padding: '12px 14px', fontFamily: "'Quicksand', sans-serif", fontSize: 15, color: '#7A2E3F', outline: 'none' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '14px 0 2px', justifyContent: 'center', color: '#F4B740' }}>
                    {[1,2,3,4,5].map(n => (
                      <button key={n} onClick={() => setFormRating(n)} style={{ background: 'none', border: 'none', fontSize: 30, cursor: 'pointer', padding: '0 2px', lineHeight: 1, color: 'inherit' }}>
                        {n <= s.form.rating ? '★' : '☆'}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={s.form.note}
                    onChange={setFormNote}
                    placeholder="Una nota... ¿qué pedimos? ¿qué nos gustó?"
                    style={{ width: '100%', border: '1.5px solid #F2D6DE', borderRadius: 12, padding: '12px 14px', fontFamily: "'Quicksand', sans-serif", fontSize: 14, color: '#7A2E3F', outline: 'none', resize: 'none', minHeight: 58, marginTop: 8 }}
                  />
                  <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center' }}>
                    <button onClick={pickPhoto} style={{ background: '#FCEBF0', color: '#E84A6F', border: 'none', borderRadius: 12, padding: '11px 16px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                      📷 Foto
                    </button>
                    {s.form.photo && (
                      <img src={s.form.photo} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover' }} />
                    )}
                    <input type="file" accept="image/*" ref={fileRef} onChange={onPhoto} style={{ display: 'none' }} />
                    <button onClick={savePlace} style={{ marginLeft: 'auto', background: 'linear-gradient(135deg,#FF7AA0,#E84A6F)', color: '#fff', border: 'none', borderRadius: 12, padding: '11px 22px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                      Guardar
                    </button>
                  </div>
                </div>

                {s.dbLoading ? (
                  <div style={{ textAlign: 'center', color: '#C28C99', padding: '24px 10px', fontSize: 14 }}>Cargando... 💕</div>
                ) : s.places.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#CCBBAA', padding: '24px 10px', fontSize: 14, lineHeight: 1.6 }}>
                    Aún no hay lugares<br />¡Agrega el primero!
                  </div>
                ) : s.places.map(p => (
                  <div key={p.id} style={{ background: '#fff', borderRadius: 18, padding: 14, boxShadow: '0 5px 14px rgba(180,60,90,.08)', marginBottom: 12, display: 'flex', gap: 12 }}>
                    {p.photo && <img src={p.photo} alt="" style={{ width: 64, height: 64, borderRadius: 12, objectFit: 'cover', flex: '0 0 auto' }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 16, color: '#7A2E3F' }}>{p.name}</div>
                        <button onClick={() => deletePlace(p.id)} style={{ background: 'none', border: 'none', color: '#E0A9B6', fontSize: 16, cursor: 'pointer', padding: 0, flex: '0 0 auto' }}>✕</button>
                      </div>
                      <div style={{ fontSize: 15, letterSpacing: 1, marginTop: 3, color: '#F4B740' }}>
                        {'★'.repeat(p.rating) + '☆'.repeat(5 - p.rating)}
                      </div>
                      {p.note && <div style={{ fontSize: 13, color: '#9a6b76', marginTop: 5, lineHeight: 1.4 }}>{p.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── TAB: HISTORIAL ── */}
            {s.tab === 'historial' && (
              <div>
                <h2 style={{ fontFamily: "'Caveat', cursive", fontSize: 36, margin: '4px 0 0', textAlign: 'center', color: '#7A2E3F', fontWeight: 700 }}>
                  Lo que hemos hecho 📜
                </h2>
                <p style={{ fontSize: 13, color: '#C28C99', textAlign: 'center', margin: '2px 0 16px' }}>Nuestros planes cumplidos</p>

                {s.dbLoading ? (
                  <div style={{ textAlign: 'center', color: '#C28C99', padding: '24px 10px', fontSize: 14 }}>Cargando... 💕</div>
                ) : s.history.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#CCBBAA', padding: '24px 10px', fontSize: 14, lineHeight: 1.6 }}>
                    Todavía nada por aquí 🌸<br />¡Gira la ruleta y guarda un plan!
                  </div>
                ) : s.history.map(h => (
                  <div key={h.id} style={{ background: '#fff', borderRadius: 16, padding: '13px 16px', boxShadow: '0 5px 14px rgba(180,60,90,.08)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontSize: 30, flex: '0 0 auto' }}>{h.emoji}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: '#7A2E3F', fontSize: 15 }}>{h.name}</div>
                      <div style={{ fontSize: 12, color: '#C28C99' }}>{h.date}</div>
                    </div>
                    <button onClick={() => deleteHistory(h.id)} style={{ background: 'none', border: 'none', color: '#E0A9B6', fontSize: 15, cursor: 'pointer', flex: '0 0 auto' }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* ── TAB: PARA TI ── */}
            {s.tab === 'valen' && (() => {
              const diff = now - BORN;
              const days = Math.floor(diff / 86400000);
              const hours = Math.floor((diff % 86400000) / 3600000);
              const minutes = Math.floor((diff % 3600000) / 60000);
              const seconds = Math.floor((diff % 60000) / 1000);
              const pad = n => String(n).padStart(2, '0');
              return (
                <div style={{ textAlign: 'center', paddingTop: 8 }}>
                  <h2 style={{ fontFamily: "'Caveat', cursive", fontSize: 36, margin: '4px 0 0', color: '#7A2E3F', fontWeight: 700 }}>
                    Valecita 🌸
                  </h2>

                  <HeartTree />

                  {/* Counter card */}
                  <div style={{ background: '#fff', borderRadius: 24, padding: '22px 18px 18px', boxShadow: '0 6px 18px rgba(180,60,90,.1)', margin: '12px 0' }}>
                    {/* Big numbers */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 18 }}>
                      {[
                        { val: days.toLocaleString('es-CO'), label: 'días' },
                        { val: pad(hours), label: 'horas' },
                        { val: pad(minutes), label: 'min' },
                        { val: pad(seconds), label: 'seg' },
                      ].map(({ val, label }, i) => (
                        <div key={label}>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontFamily: "'Caveat', cursive", fontSize: 38, fontWeight: 700, color: '#E84A6F', lineHeight: 1 }}>{val}</div>
                              <div style={{ fontSize: 10, color: '#C28C99', fontWeight: 700, letterSpacing: 0.5 }}>{label}</div>
                            </div>
                            {i < 3 && <div style={{ fontFamily: "'Caveat', cursive", fontSize: 30, color: '#F2C9D4', margin: '0 2px', lineHeight: 1, paddingBottom: 12 }}>:</div>}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Romantic text */}
                    <p style={{ fontFamily: "'Caveat', cursive", fontSize: 20, color: '#7A2E3F', fontWeight: 700, lineHeight: 1.45, margin: 0 }}>
                      Hace{' '}
                      <span style={{ color: '#E84A6F' }}>{days.toLocaleString('es-CO')} días</span>,{' '}
                      <span style={{ color: '#E84A6F' }}>{hours} horas</span> y{' '}
                      <span style={{ color: '#E84A6F' }}>{minutes} minutos</span>{' '}
                      nació la más hermosa, maravillosa y única de este mundo. Gracias doña Consuelo
                    </p>
                    <p style={{ fontFamily: "'Caveat', cursive", fontSize: 24, color: '#E84A6F', fontWeight: 700, margin: '12px 0 0' }}>
                      Gracias por existir 💕
                    </p>
                  </div>
                </div>
              );
            })()}

          </main>

          {/* ── BOTTOM NAV ── */}
          <nav style={{ position: 'fixed', left: 0, right: 0, bottom: 0, maxWidth: 460, margin: '0 auto', display: 'flex', background: '#fff', borderTop: '1px solid #F4D6DE', padding: '9px 0 16px', zIndex: 20, boxShadow: '0 -4px 18px rgba(180,60,90,.07)' }}>
            {[
              { id: 'ruleta', label: 'Ruleta', emoji: '🎡' },
              { id: 'lugares', label: 'Lugares', emoji: '📍' },
              { id: 'historial', label: 'Historial', emoji: '📜' },
              { id: 'valen', label: 'Para ti', emoji: '💝' },
            ].map(({ id, label, emoji }) => (
              <button key={id} onClick={() => setTab(id)} style={{ flex: 1, background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', color: s.tab === id ? '#E84A6F' : '#D7AAB4', fontWeight: 700, fontSize: 11 }}>
                <span style={{ fontSize: 22 }}>{emoji}</span>
                {label}
              </button>
            ))}
          </nav>

          {/* ── RESULT MODAL ── */}
          {s.isResult && (
            <div
              onClick={closeResult}
              style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(122,46,63,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 26 }}
            >
              <div
                onClick={stopProp}
                style={{ background: '#fff', borderRadius: 26, padding: '30px 24px', maxWidth: 320, width: '100%', textAlign: 'center', boxShadow: '0 20px 50px rgba(0,0,0,.25)', animation: 'popIn .5s cubic-bezier(.2,1.4,.4,1) both' }}
              >
                <div style={{ fontSize: 13, color: '#C28C99', fontWeight: 600 }}>El destino dice...</div>
                <div style={{ fontSize: 62, margin: '10px 0' }}>{resultSeg?.emoji}</div>
                <div style={{ fontFamily: "'Caveat', cursive", fontSize: 42, color: '#E84A6F', fontWeight: 700, lineHeight: 1 }}>{resultSeg?.name}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
                  <button onClick={saveToHistory} style={{ background: 'linear-gradient(135deg,#FF7AA0,#E84A6F)', color: '#fff', border: 'none', borderRadius: 999, padding: 13, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                    Guardar en el historial 📜
                  </button>
                  <button onClick={closeResult} style={{ background: '#FCEBF0', color: '#E84A6F', border: 'none', borderRadius: 999, padding: 13, fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
                    Girar otra vez 🔄
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
