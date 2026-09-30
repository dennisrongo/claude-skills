() => {
  const CLIP = 96;
  const TRAIL = 2;
  const RESULTS_SHOWN = 10;
  const GREEN = '#34e5a0';
  const RED = '#ff4d7d';
  const AMBER = '#ffb547';
  const CYAN = '#5ee7ff';
  const VIOLET = '#9b8cff';
  const SLATE = '#6b7694';
  const FONT = '-apple-system,"Segoe UI Variable Text","Segoe UI",Roboto,system-ui,sans-serif';
  const MONO = 'ui-monospace,"SF Mono","Cascadia Code",Consolas,monospace';
  const GLASS = 'overflow:hidden;background:linear-gradient(180deg,rgba(20,26,44,.94),rgba(7,10,18,.94));backdrop-filter:blur(18px) saturate(160%);-webkit-backdrop-filter:blur(18px) saturate(160%);border:1px solid rgba(120,170,255,.22);border-radius:16px;box-shadow:inset 0 1px 0 rgba(255,255,255,.06),0 12px 36px rgba(0,0,0,.5),0 0 28px rgba(94,231,255,.14);color:#eef1fa;font-family:' + FONT + ';';

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const clip = s => { const t = String(s ?? ''); return t.length > CLIP ? t.slice(0, CLIP - 1) + '…' : t; };
  const show = v => clip(v === undefined ? 'undefined' : JSON.stringify(v));
  const plain = (v, name, depth = 0) => {
    if (depth > 20) throw new TypeError(`check ${name}: value is nested too deeply or circular`);
    if (v === null || ['string', 'boolean', 'number'].includes(typeof v)) return;
    if (Array.isArray(v)) { v.forEach(x => plain(x, name, depth + 1)); return; }
    if (typeof v === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(v))) { Object.values(v).forEach(x => plain(x, name, depth + 1)); return; }
    throw new TypeError(`check ${name}: ${typeof v === 'object' ? v.constructor.name : typeof v} cannot be compared; pass strings, numbers, booleans, null, arrays or plain objects`);
  };
  const same = (a, b) => {
    if (a === b) return true;
    if (typeof a === 'number' && typeof b === 'number') return Number.isNaN(a) && Number.isNaN(b);
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(k => k in b && same(a[k], b[k]));
  };
  const make = (css, text = '', tag = 'div') => { const n = document.createElement(tag); n.style.cssText = css; if (text) n.textContent = text; return n; };
  const chip = (text, color) => make('font:700 11px ' + MONO + ';padding:1px 8px;border-radius:99px;color:' + color + ';background:' + color + '1c;border:1px solid ' + color + '55;box-shadow:0 0 10px ' + color + '33', text);
  const trailLine = (glyph, color, text) => {
    const row = make('display:flex;gap:8px;padding:1px 0');
    row.append(make('flex:none;width:12px;font-weight:800;color:' + color + ';text-shadow:0 0 8px ' + color, glyph, 'span'), make('overflow-wrap:anywhere', text, 'span'));
    return row;
  };

  const panel = make('position:fixed;top:12px;left:12px;z-index:2147483647;display:none;box-sizing:border-box;width:min(370px,34vw);padding:12px 14px 13px;pointer-events:none;' + GLASS);
  const accent = make('position:absolute;left:0;top:0;right:0;height:2px;background:linear-gradient(90deg,' + CYAN + ',' + VIOLET + ');box-shadow:0 0 12px ' + CYAN);
  const sweep = make('position:absolute;top:0;bottom:0;left:0;width:40%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.05),transparent);pointer-events:none');
  const header = make('position:relative;display:flex;align-items:center;gap:8px;flex-wrap:wrap');
  const dot = make('flex:none;width:8px;height:8px;border-radius:50%;background:' + AMBER + ';box-shadow:0 0 10px ' + AMBER);
  const status = make('font:700 10px ' + MONO + ';letter-spacing:.18em;color:' + AMBER, 'START');
  const clock = make('margin-left:2px;font:700 16px ' + MONO + ';font-variant-numeric:tabular-nums;letter-spacing:-.01em;color:#fff;text-shadow:0 0 12px ' + CYAN + '88', '0:00.0');
  const counts = make('display:flex;gap:5px;margin-left:auto');
  const pace = make('flex:none;font:700 9.5px ' + MONO + ';letter-spacing:.12em;padding:2px 8px;border-radius:99px;color:#cbd5e1;border:1px solid #cbd5e155', 'REAL TIME');
  header.append(dot, status, clock, counts, pace);
  const suite = make('position:relative;margin-top:8px;font-size:12px;font-weight:650;color:#c3cbe0;overflow-wrap:anywhere');
  const stamp = make('position:relative;margin-top:1px;font:400 10px ' + MONO + ';color:#7f8bab;overflow-wrap:anywhere');
  const rule = make('position:relative;height:1px;margin:9px 0;background:linear-gradient(90deg,rgba(94,231,255,.35),rgba(155,140,255,.15),transparent)');
  const stepRow = make('position:relative;display:flex;align-items:baseline;gap:9px');
  const stepChip = make('flex:none;font:700 9.5px ' + MONO + ';letter-spacing:.12em;color:#05070c;background:linear-gradient(135deg,' + CYAN + ',' + VIOLET + ');border-radius:6px;padding:2px 7px;box-shadow:0 0 12px ' + CYAN + '55', 'STEP');
  const stepTitle = make('min-width:0;font-size:15px;line-height:1.3;font-weight:650;letter-spacing:-.01em;overflow-wrap:anywhere');
  stepRow.append(stepChip, stepTitle);
  const doing = make('position:relative;display:none;margin-top:5px;font-size:12.5px;line-height:1.4;color:#8ff0ff;overflow-wrap:anywhere');
  const saw = make('position:relative;display:none;margin-top:2px;font-size:12px;line-height:1.4;color:#c7cee0;overflow-wrap:anywhere');
  const checkBox = make('position:relative;display:none;margin-top:9px;padding:7px 10px;border-radius:10px;font-size:12.5px;line-height:1.4;font-weight:600;overflow-wrap:anywhere;border:1px solid transparent');
  const trail = make('position:relative;display:none;margin-top:9px;padding-top:8px;border-top:1px solid rgba(120,170,255,.14);font-size:11.5px;line-height:1.5;color:#98a4c0');
  panel.append(accent, sweep, header, suite, stamp, rule, stepRow, doing, saw, checkBox, trail);
  sweep.animate([{ transform: 'translateX(-120%)' }, { transform: 'translateX(320%)' }], { duration: 4200, iterations: Infinity, easing: 'ease-in-out' });

  const button = document.createElement('button');
  button.id = '__rec_start';
  button.textContent = 'START RECORDING';
  button.style.cssText = 'position:fixed;top:12px;left:12px;z-index:2147483647;font:700 16px Arial;padding:10px 16px;background:#c0392b;color:#fff;border:0;border-radius:8px';
  document.body.append(panel, button);

  const state = window.__rec = {
    state: 'armed', verdict: 'none', corner: 'top-left', uploadUrl: 'http://127.0.0.1:8766/upload', settle: 1500,
    seconds: 0, error: null, bytes: 0, dwell: 0, run: null, result: null,
    steps: 0, pass: 0, fail: 0, log: [], failed: [],
  };
  const history = [];
  const results = [];
  let started = 0, timer = null, stepPass = 0, stepFail = 0, stepFirstFail = '', cur = { n: 0, title: '', saw: '' }, pulse = null;

  const elapsed = () => (started ? Number(((performance.now() - started) / 1000).toFixed(2)) : 0);
  const hold = () => (state.state === 'recording' && state.dwell ? wait(state.dwell) : Promise.resolve());
  const paint = () => {
    const t = elapsed();
    clock.textContent = Math.floor(t / 60) + ':' + (t % 60).toFixed(1).padStart(4, '0');
    pace.textContent = state.dwell ? 'PACED ' + state.dwell + ' ms' : 'REAL TIME';
    pace.style.color = state.dwell ? AMBER : '#cbd5e1';
    pace.style.borderColor = (state.dwell ? AMBER : '#cbd5e1') + '55';
    const chips = [];
    if (state.pass) chips.push(chip('✓ ' + state.pass, GREEN));
    if (state.fail) chips.push(chip('✕ ' + state.fail, RED));
    counts.replaceChildren(...chips);
  };
  const setStatus = (text, color, pulsing) => {
    status.textContent = text;
    status.style.color = color;
    dot.style.background = color;
    dot.style.boxShadow = '0 0 10px ' + color;
    if (pulse) { pulse.cancel(); pulse = null; }
    if (pulsing) pulse = dot.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0.3, transform: 'scale(.7)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 1200, iterations: Infinity });
  };
  const setCheck = (tag, text, color) => {
    if (!text) { checkBox.style.display = 'none'; return; }
    checkBox.style.display = 'block';
    checkBox.style.color = color;
    checkBox.style.background = color + '17';
    checkBox.style.borderColor = color + '55';
    checkBox.style.boxShadow = '0 0 16px ' + color + '26';
    checkBox.replaceChildren(make('display:inline-block;margin-right:8px;padding:1px 8px;border-radius:99px;font:700 9.5px ' + MONO + ';letter-spacing:.14em;color:#05070c;background:' + color + ';box-shadow:0 0 10px ' + color + '88', tag, 'span'), document.createTextNode(text));
    checkBox.animate([{ opacity: 0, transform: 'scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 180, easing: 'ease-out' });
  };
  const tint = color => {
    panel.style.borderColor = color + '66';
    accent.style.background = color;
    accent.style.boxShadow = '0 0 14px ' + color;
    const glow = alpha => 'inset 0 1px 0 rgba(255,255,255,.06), 0 12px 36px rgba(0,0,0,.5), 0 0 32px ' + color + alpha;
    panel.style.boxShadow = glow('40');
    panel.animate([{ boxShadow: glow('b3') }, { boxShadow: glow('40') }], { duration: 900, easing: 'ease-out' });
  };
  const renderTrail = rows => {
    trail.replaceChildren(...rows);
    trail.style.display = rows.length ? 'block' : 'none';
  };
  const closeStep = () => {
    if (!cur.n) return;
    const suffix = stepFail ? '  [FAIL] ' + stepFirstFail : stepPass ? '  [PASS x' + stepPass + ']' : '';
    history.push({ glyph: stepFail ? '✕' : stepPass ? '✓' : '•', color: stepFail ? RED : stepPass ? GREEN : SLATE, text: cur.n + '  ' + cur.title + (cur.saw ? '  →  ' + cur.saw : '') + suffix });
    renderTrail(history.slice(-TRAIL).reverse().map(h => trailLine(h.glyph, h.color, h.text)));
  };

  state.show = fields => {
    if (fields.suite !== undefined) suite.textContent = clip(fields.suite);
    if (fields.stamp !== undefined) stamp.textContent = fields.stamp;
    if (fields.step !== undefined) {
      closeStep();
      stepPass = 0;
      stepFail = 0;
      stepFirstFail = '';
      state.steps++;
      cur = { n: state.steps, title: clip(fields.step), saw: '' };
      stepChip.textContent = 'STEP ' + cur.n;
      stepTitle.textContent = cur.title;
      doing.style.display = 'none';
      saw.style.display = 'none';
      setCheck('', '', GREEN);
      stepRow.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 160, easing: 'ease-out' });
    }
    if (fields.doing !== undefined) {
      doing.textContent = fields.doing ? '→ ' + clip(fields.doing) : '';
      doing.style.display = fields.doing ? 'block' : 'none';
    }
    if (fields.saw !== undefined) {
      cur.saw = clip(fields.saw);
      saw.textContent = fields.saw ? 'Saw: ' + cur.saw : '';
      saw.style.display = fields.saw ? 'block' : 'none';
    }
    state.log.push({ t: elapsed(), n: state.steps, ...fields });
    paint();
    return hold();
  };
  state.check = async (label, actual, expected) => {
    if (actual !== undefined) plain(actual, `"${label}" actual`);
    plain(expected, `"${label}" expected`);
    const ok = same(actual, expected);
    if (ok) state.pass++; else { state.fail++; state.failed.push(label); }
    results.push({ label, ok });
    const detail = clip(label + ': ' + (ok ? 'saw ' + show(actual) : 'expected ' + show(expected) + ', saw ' + show(actual)));
    if (ok) stepPass++; else { stepFail++; if (!stepFirstFail) stepFirstFail = detail; }
    if (!ok || !stepFail) setCheck(ok ? 'PASS' : 'FAIL', detail, ok ? GREEN : RED);
    state.log.push({ t: elapsed(), n: state.steps, check: label, ok, expected, actual });
    paint();
    await hold();
    return ok;
  };

  const listResults = () => {
    const ordered = [...results.filter(r => !r.ok), ...results.filter(r => r.ok)];
    const rows = ordered.slice(0, RESULTS_SHOWN).map(r => trailLine(r.ok ? '✓' : '✕', r.ok ? GREEN : RED, clip(r.label)));
    if (ordered.length > RESULTS_SHOWN) rows.push(trailLine('', SLATE, '... and ' + (ordered.length - RESULTS_SHOWN) + ' more in the steps log'));
    renderTrail(rows);
  };
  const conclude = () => {
    listResults();
    const total = state.pass + state.fail;
    let color, label, tag, text;
    if (state.error) { state.verdict = 'error'; color = RED; label = 'ERROR'; tag = 'ERROR'; text = clip(state.error); }
    else if (!total) { state.verdict = 'none'; color = AMBER; label = 'NO CHECKS'; tag = 'NO CHECKS'; text = 'the run reported no pass/fail checks, so nothing was asserted'; }
    else if (state.fail) { state.verdict = 'fail'; color = RED; label = 'FAIL'; tag = 'FAILED'; text = state.fail + ' of ' + total + ' checks failed: ' + clip(state.failed.slice(0, 3).join('; ')); }
    else { state.verdict = 'pass'; color = GREEN; label = 'PASS'; tag = 'PASSED'; text = 'all ' + total + ' checks'; }
    setCheck(tag, text, color);
    setStatus(label, color, false);
    tint(color);
  };

  paint();

  button.onclick = async () => {
    try {
      state.error = null;
      if (typeof state.run !== 'function') throw new Error('attach the test body to window.__rec.run before clicking start');
      state.state = 'asking';
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { max: 1920 }, height: { max: 1000 }, frameRate: { ideal: 30 } },
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: 'include',
      });
      const mime = ['video/mp4;codecs=avc1.42E01E', 'video/mp4'].find(m => MediaRecorder.isTypeSupported(m));
      if (!mime) throw new Error('this browser cannot encode mp4');
      const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2500000 });
      const chunks = [];
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      const stopped = new Promise(r => { recorder.onstop = r; });

      button.style.display = 'none';
      panel.style.display = 'block';
      if (state.corner === 'bottom-left') { panel.style.top = 'auto'; panel.style.bottom = '12px'; }
      setStatus('START', AMBER, false);
      state.show({ step: 'Capture granted', doing: 'Waiting ' + state.settle + ' ms for the tab layout to settle before recording' });
      await wait(state.settle);
      state.show({ step: 'Recording started', doing: 'Waiting 1.5 s before the test body runs' });
      recorder.start(500);
      started = performance.now();
      state.state = 'recording';
      setStatus('REC', RED, true);
      timer = setInterval(paint, 50);
      await wait(1500);

      try {
        state.result = await state.run(state);
      } catch (e) {
        state.error = String(e && e.message || e);
      }
      state.show({ step: state.error ? 'Test body failed' : 'Run complete', doing: 'Stopping the recording', saw: (state.pass + state.fail) + ' checks' });
      conclude();
      await wait(Math.min(8000, Math.max(3000, 400 * results.length)));

      clearInterval(timer);
      state.seconds = (performance.now() - started) / 1000;
      recorder.stop();
      await stopped;
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunks, { type: mime });
      state.bytes = blob.size;
      await fetch(state.uploadUrl, { method: 'POST', body: blob });
      state.state = state.error ? 'error' : 'done';
    } catch (e) {
      state.error = String(e && e.message || e);
      state.state = 'error';
    }
  };
  return { armed: true, mp4: MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42E01E') };
}
