// dr-runtime.js — bundled shared runtime для Deepreview.
// Build: 2026-05-22T20:20:22.642Z | deepreview HEAD: 7c58e563bb23
// DO NOT EDIT — генерируется через `npm run dr-runtime-build` в Yanflint/deepreview.
// Source: https://github.com/Yanflint/deepreview/tree/dev/deepreview/js/dr-runtime/
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};

// js/anim-runtime/channelRegistry.js
function toScaleObj(v) {
  if (v && typeof v === "object") {
    return { x: Number.isFinite(v.x) ? v.x : 1, y: Number.isFinite(v.y) ? v.y : 1 };
  }
  if (Number.isFinite(v)) return { x: v, y: v };
  return { x: 1, y: 1 };
}
function numberLerp(a, b, k) {
  return a + (b - a) * k;
}
function vec2Lerp(a, b, k) {
  return { x: numberLerp(a.x, b.x, k), y: numberLerp(a.y, b.y, k) };
}
function getChannel(name) {
  const ch = CHANNELS_BY_NAME.get(name);
  if (!ch) throw new Error(`Unknown channel: ${name}`);
  return ch;
}
function getChannelOrNull(name) {
  return CHANNELS_BY_NAME.get(name) || null;
}
function getAllChannels() {
  return CHANNELS.slice();
}
function getChannelsForLayerType(layerType) {
  return CHANNELS.filter((c) => c.appliesTo === null || c.appliesTo.includes(layerType));
}
function getChannelsForBlock(block) {
  return CHANNELS.filter((c) => c.ui.block === block);
}
function getInterpolatedChannels() {
  return CHANNELS.filter((c) => c.interpolated);
}
var positionChannel, rotationChannel, scaleChannel, opacityChannel, triggerChannel, CHANNELS, CHANNELS_BY_NAME;
var init_channelRegistry = __esm({
  "js/anim-runtime/channelRegistry.js"() {
    positionChannel = {
      name: "position",
      type: "vec2",
      kind: "transform",
      interpolated: true,
      defaultValue: { x: 0, y: 0 },
      idleFields: ["x", "y"],
      read: (L) => ({ x: Number(L.x) || 0, y: Number(L.y) || 0 }),
      readIdle: (idle) => idle ? { x: idle.x, y: idle.y } : null,
      write: (L, v) => {
        if (v && typeof v === "object" && Number.isFinite(v.x)) L.x = v.x;
        if (v && typeof v === "object" && Number.isFinite(v.y)) L.y = v.y;
      },
      snapshotIdleFields: (L, idle) => {
        idle.x = Number(L.x) || 0;
        idle.y = Number(L.y) || 0;
      },
      restoreIdleFields: (L, idle) => {
        L.x = idle.x;
        L.y = idle.y;
      },
      lerp: vec2Lerp,
      blendAdd: (v, idle, firstVal) => {
        if (!v || !firstVal || typeof v !== "object" || typeof firstVal !== "object") return v;
        return {
          x: (idle.x || 0) + ((v.x || 0) - (firstVal.x || 0)),
          y: (idle.y || 0) + ((v.y || 0) - (firstVal.y || 0))
        };
      },
      captureValueAt: (L) => ({ x: Number(L.x) || 0, y: Number(L.y) || 0 }),
      isAtIdle: (L, idle) => {
        const ix = Number.isFinite(idle.x) ? idle.x : 0;
        const iy = Number.isFinite(idle.y) ? idle.y : 0;
        return (L.x || 0) === ix && (L.y || 0) === iy;
      },
      writeToRec: (L, rec, { num: num2 }) => {
        rec.x = num2(L.x);
        rec.y = num2(L.y);
      },
      ui: {
        block: "transform",
        label: "\u041F\u043E\u0437\u0438\u0446\u0438\u044F",
        popupHotkey: "1",
        popupOrder: 1,
        propsPanel: {
          fields: [
            { id: "kfPosX", label: "X", step: 1 },
            { id: "kfPosY", label: "Y", step: 1 }
          ],
          read: (v) => [
            String(Math.round(v?.x ?? 0)),
            String(Math.round(v?.y ?? 0))
          ],
          write: ([xRaw, yRaw]) => {
            const x = parseFloat(xRaw || "");
            const y = parseFloat(yRaw || "");
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
            return { x, y };
          }
        }
      },
      appliesTo: null,
      cascadesToChildren: false
    };
    rotationChannel = {
      name: "rotation",
      type: "number",
      kind: "transform",
      interpolated: true,
      defaultValue: 0,
      idleFields: ["rotation"],
      read: (L) => Number.isFinite(L.rotation) ? L.rotation : 0,
      readIdle: (idle) => idle ? idle.rotation ?? 0 : null,
      write: (L, v) => {
        if (typeof v === "number" && Number.isFinite(v)) L.rotation = v;
      },
      snapshotIdleFields: (L, idle) => {
        idle.rotation = Number.isFinite(L.rotation) ? L.rotation : 0;
      },
      restoreIdleFields: (L, idle) => {
        if (idle.rotation !== 0) L.rotation = idle.rotation;
        else delete L.rotation;
      },
      lerp: numberLerp,
      blendAdd: (v, idle, firstVal) => {
        if (typeof v !== "number" || typeof firstVal !== "number" || !Number.isFinite(v) || !Number.isFinite(firstVal)) return v;
        return (idle.rotation || 0) + (v - firstVal);
      },
      captureValueAt: (L) => Number.isFinite(L.rotation) ? L.rotation : 0,
      isAtIdle: (L, idle) => {
        const ir = Number.isFinite(idle.rotation) ? idle.rotation : 0;
        const curR = Number.isFinite(L.rotation) ? L.rotation : 0;
        return Math.abs(curR - ir) < 1e-9;
      },
      writeToRec: (L, rec) => {
        const rot = L.rotation;
        if (rot != null && rot !== 0) rec.rotation = rot;
      },
      ui: {
        block: "transform",
        label: "\u041F\u043E\u0432\u043E\u0440\u043E\u0442",
        popupHotkey: "2",
        popupOrder: 2,
        propsPanel: {
          fields: [
            { id: "kfRot", label: "\u0423\u0433\u043E\u043B (\xB0)", step: 1 }
          ],
          read: (v) => [String(Number.isFinite(v) ? Math.round(v * 100) / 100 : 0)],
          write: ([raw]) => {
            const v = parseFloat(raw || "");
            return Number.isFinite(v) ? v : null;
          }
        }
      },
      appliesTo: null,
      cascadesToChildren: false
    };
    scaleChannel = {
      name: "scale",
      type: "vec2",
      kind: "transform",
      interpolated: true,
      defaultValue: { x: 1, y: 1 },
      idleFields: ["w", "h", "scaleX", "scaleY", "skewX"],
      // Scale-канал — RATIO к idle.w/idle.h. Read учитывает И raw resize (L.w/h),
      // И уже-применённый CSS scale (L.scaleX/Y). После bakeParentResize (parent с
      // children) L.w == idle.w, ratio зашит в L.scaleX/Y — считаем композицию:
      // ratio = (L.w * L.scaleX) / idle.w.
      read: (L, idle) => {
        if (idle && Number.isFinite(idle.w) && idle.w > 0 && Number.isFinite(idle.h) && idle.h > 0) {
          const curW = Number.isFinite(L.w) ? L.w : idle.w;
          const curH = Number.isFinite(L.h) ? L.h : idle.h;
          const sx = Number.isFinite(L.scaleX) ? L.scaleX : 1;
          const sy = Number.isFinite(L.scaleY) ? L.scaleY : 1;
          return { x: curW * sx / idle.w, y: curH * sy / idle.h };
        }
        return { x: 1, y: 1 };
      },
      // Identity ratio (не idle.w/idle.h — это raw size, не ratio).
      readIdle: () => ({ x: 1, y: 1 }),
      write: (L, v, idle) => {
        const ratio = toScaleObj(v);
        if (idle && Number.isFinite(idle.w) && idle.w > 0) L.w = idle.w;
        if (idle && Number.isFinite(idle.h) && idle.h > 0) L.h = idle.h;
        if (Math.abs(ratio.x - 1) < 1e-9) delete L.scaleX;
        else L.scaleX = ratio.x;
        if (Math.abs(ratio.y - 1) < 1e-9) delete L.scaleY;
        else L.scaleY = ratio.y;
      },
      // ANIM-OFFKEY-EDITS: scaleX/scaleY/skewX — internal helper editor'а (cascade
      // повёрнутого parent, baked text/hint в multi-resize). Хранение в idle —
      // ради корректного restore при close animDock.
      snapshotIdleFields: (L, idle) => {
        const sUniform = Number.isFinite(L.scale) ? L.scale : 1;
        idle.w = Number.isFinite(L.w) ? L.w : 0;
        idle.h = Number.isFinite(L.h) ? L.h : 0;
        idle.scaleX = Number.isFinite(L.scaleX) ? L.scaleX : sUniform;
        idle.scaleY = Number.isFinite(L.scaleY) ? L.scaleY : sUniform;
        idle.skewX = Number.isFinite(L.skewX) ? L.skewX : 0;
      },
      restoreIdleFields: (L, idle) => {
        if (Number.isFinite(idle.w) && idle.w > 0) L.w = idle.w;
        if (Number.isFinite(idle.h) && idle.h > 0) L.h = idle.h;
        if (Number.isFinite(idle.scaleX) && Math.abs(idle.scaleX - 1) > 1e-9) L.scaleX = idle.scaleX;
        else delete L.scaleX;
        if (Number.isFinite(idle.scaleY) && Math.abs(idle.scaleY - 1) > 1e-9) L.scaleY = idle.scaleY;
        else delete L.scaleY;
        if (Number.isFinite(idle.skewX) && Math.abs(idle.skewX) > 1e-9) L.skewX = idle.skewX;
        else delete L.skewX;
      },
      lerp: (a, b, k) => {
        const A = toScaleObj(a), B = toScaleObj(b);
        return vec2Lerp(A, B, k);
      },
      blendAdd: (v, _idle, firstVal) => {
        const V = toScaleObj(v), F = toScaleObj(firstVal);
        return {
          x: F.x !== 0 ? V.x / F.x : V.x,
          y: F.y !== 0 ? V.y / F.y : V.y
        };
      },
      captureValueAt: (L, idle) => {
        if (idle && Number.isFinite(idle.w) && idle.w > 0 && Number.isFinite(idle.h) && idle.h > 0) {
          const curW = Number.isFinite(L.w) ? L.w : idle.w;
          const curH = Number.isFinite(L.h) ? L.h : idle.h;
          const sx = Number.isFinite(L.scaleX) ? L.scaleX : 1;
          const sy = Number.isFinite(L.scaleY) ? L.scaleY : 1;
          return { x: curW * sx / idle.w, y: curH * sy / idle.h };
        }
        return { x: 1, y: 1 };
      },
      isAtIdle: (L, idle) => {
        const iw = Number.isFinite(idle.w) ? idle.w : L.w;
        const ih = Number.isFinite(idle.h) ? idle.h : L.h;
        const isx = Number.isFinite(idle.scaleX) ? idle.scaleX : 1;
        const isy = Number.isFinite(idle.scaleY) ? idle.scaleY : 1;
        const isk = Number.isFinite(idle.skewX) ? idle.skewX : 0;
        const curSx = Number.isFinite(L.scaleX) ? L.scaleX : 1;
        const curSy = Number.isFinite(L.scaleY) ? L.scaleY : 1;
        const curSk = Number.isFinite(L.skewX) ? L.skewX : 0;
        return L.w === iw && L.h === ih && Math.abs(curSx - isx) < 1e-9 && Math.abs(curSy - isy) < 1e-9 && Math.abs(curSk - isk) < 1e-9;
      },
      writeToRec: (L, rec, { dims, sc }) => {
        const lsx = sc ? sc.sx : L.scaleX;
        const lsy = sc ? sc.sy : L.scaleY;
        rec.w = dims.w;
        rec.h = dims.h;
        const skBase = L.skewX;
        if (Number.isFinite(lsx) && lsx !== 1) rec.scaleX = lsx;
        else delete rec.scaleX;
        if (Number.isFinite(lsy) && lsy !== 1) rec.scaleY = lsy;
        else delete rec.scaleY;
        if (Number.isFinite(skBase) && skBase !== 0) rec.skewX = skBase;
      },
      ui: {
        block: "scale",
        label: "\u041C\u0430\u0441\u0448\u0442\u0430\u0431",
        popupHotkey: "3",
        popupOrder: 3,
        propsPanel: {
          fields: [
            { id: "kfScaleX", label: "X", step: 0.05, min: 0 },
            { id: "kfScaleY", label: "Y", step: 0.05, min: 0 }
          ],
          read: (v) => {
            const obj = toScaleObj(v);
            const round3 = (x) => Math.round(x * 1e3) / 1e3;
            return [String(round3(obj.x ?? 1)), String(round3(obj.y ?? 1))];
          },
          write: ([xRaw, yRaw]) => {
            const x = parseFloat(xRaw || "");
            const y = parseFloat(yRaw || "");
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
            return { x, y };
          }
        }
      },
      appliesTo: null,
      cascadesToChildren: true
    };
    opacityChannel = {
      name: "opacity",
      type: "number",
      kind: "transform",
      interpolated: true,
      defaultValue: 1,
      idleFields: ["opacity"],
      read: (L) => Number.isFinite(L.opacity) ? L.opacity : 1,
      readIdle: (idle) => idle ? idle.opacity ?? 1 : null,
      write: (L, v) => {
        if (typeof v === "number" && Number.isFinite(v)) {
          L.opacity = Math.max(0, Math.min(1, v));
        }
      },
      snapshotIdleFields: (L, idle) => {
        idle.opacity = Number.isFinite(L.opacity) ? L.opacity : 1;
      },
      restoreIdleFields: (L, idle) => {
        if (idle.opacity !== 1) L.opacity = idle.opacity;
        else delete L.opacity;
      },
      lerp: numberLerp,
      blendAdd: (v, idle, firstVal) => {
        if (typeof v !== "number" || typeof firstVal !== "number" || !Number.isFinite(v) || !Number.isFinite(firstVal)) return v;
        return (idle.opacity ?? 1) + (v - firstVal);
      },
      captureValueAt: (L) => Number.isFinite(L.opacity) ? L.opacity : 1,
      isAtIdle: (L, idle) => {
        const io = Number.isFinite(idle.opacity) ? idle.opacity : 1;
        const curO = Number.isFinite(L.opacity) ? L.opacity : 1;
        return Math.abs(curO - io) < 1e-9;
      },
      writeToRec: (L, rec) => {
        const op = L.opacity;
        if (op != null && op !== 1) rec.opacity = op;
      },
      ui: {
        block: "transform",
        label: "\u041F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u043E\u0441\u0442\u044C",
        popupHotkey: "4",
        popupOrder: 4,
        propsPanel: {
          fields: [
            { id: "kfOpacity", label: "\u041F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u043E\u0441\u0442\u044C (%)", step: 1, min: 0, max: 100 }
          ],
          read: (v) => [String(Math.round((Number.isFinite(v) ? v : 1) * 100))],
          write: ([raw]) => {
            const pct = parseFloat(raw || "");
            if (!Number.isFinite(pct)) return null;
            return Math.max(0, Math.min(1, pct / 100));
          }
        }
      },
      appliesTo: null,
      cascadesToChildren: false
    };
    triggerChannel = {
      name: "trigger",
      type: "discrete",
      kind: "media-trigger",
      interpolated: false,
      defaultValue: { kind: "play" },
      idleFields: [],
      read: () => null,
      readIdle: () => null,
      write: () => {
      },
      snapshotIdleFields: () => {
      },
      restoreIdleFields: () => {
      },
      lerp: null,
      blendAdd: (v) => v,
      captureValueAt: () => ({ kind: "play" }),
      isAtIdle: () => true,
      // trigger — discrete event channel, keyframes хранятся отдельно в
      // Action.tracks[].keyframes; на Layer-record ничего писать не нужно.
      writeToRec: () => {
      },
      ui: {
        block: null,
        label: "\u0422\u0440\u0438\u0433\u0433\u0435\u0440",
        popupHotkey: null,
        popupOrder: 5,
        propsPanel: null
      },
      appliesTo: null,
      cascadesToChildren: false
    };
    CHANNELS = [
      positionChannel,
      rotationChannel,
      scaleChannel,
      opacityChannel,
      triggerChannel
    ];
    CHANNELS_BY_NAME = new Map(CHANNELS.map((c) => [c.name, c]));
  }
});

// js/anim-runtime/sampler.js
function cloneVal(v) {
  if (v && typeof v === "object") return { ...v };
  return v;
}
function sampleTrack(trk, t, idle, extrapolation = "hold") {
  const kfs = trk.keyframes || [];
  const channel = getChannelOrNull(trk.channel);
  if (!channel) return null;
  if (!kfs.length) return channel.readIdle(idle);
  const first = kfs[0];
  const last = kfs[kfs.length - 1];
  if (t <= first.time) {
    if (extrapolation === "nothing") return cloneVal(channel.readIdle(idle));
    return cloneVal(first.value);
  }
  if (t >= last.time) {
    if (extrapolation === "nothing") return cloneVal(channel.readIdle(idle));
    return cloneVal(last.value);
  }
  let left = kfs[0], right = kfs[kfs.length - 1];
  for (let i = 0; i < kfs.length - 1; i++) {
    if (kfs[i].time <= t && t <= kfs[i + 1].time) {
      left = kfs[i];
      right = kfs[i + 1];
      break;
    }
  }
  const span = right.time - left.time;
  if (span <= 1e-9) return cloneVal(left.value);
  const u = (t - left.time) / span;
  const ease = EASINGS[left.easing] || EASINGS.linear;
  const k = ease(u);
  if (!channel.lerp) return cloneVal(left.value);
  return channel.lerp(left.value, right.value, k);
}
function blendValue(channelName, v, blending, idle, firstVal) {
  if (blending !== "add" || !idle || firstVal == null) return v;
  const channel = getChannelOrNull(channelName);
  if (!channel) return v;
  return channel.blendAdd(v, idle, firstVal);
}
function applyChannelValueTo(L, channelName, v, idle) {
  const channel = getChannelOrNull(channelName);
  if (!channel) return;
  channel.write(L, v, idle);
}
var EASINGS;
var init_sampler = __esm({
  "js/anim-runtime/sampler.js"() {
    init_channelRegistry();
    EASINGS = {
      linear: (t) => t,
      smooth: (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
      step: (_t) => 0
    };
  }
});

// js/anim-runtime/transformMath.js
function matIdentity() {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}
function matMultiply(m1, m2) {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    e: m1.a * m2.e + m1.c * m2.f + m1.e,
    f: m1.b * m2.e + m1.d * m2.f + m1.f
  };
}
function matInverse(m) {
  const det = m.a * m.d - m.b * m.c;
  if (Math.abs(det) < 1e-12) return matIdentity();
  const inv = 1 / det;
  return {
    a: m.d * inv,
    b: -m.b * inv,
    c: -m.c * inv,
    d: m.a * inv,
    e: (m.c * m.f - m.d * m.e) * inv,
    f: (m.b * m.e - m.a * m.f) * inv
  };
}
function matDeterminant(m) {
  return m.a * m.d - m.b * m.c;
}
function defaultVisualSize(L) {
  if (!L) return { w: 0, h: 0 };
  if (L.type === "png" && L.sprite && L.sprite.enabled) {
    const origW = L._origW || L.w || 0;
    const origH = L._origH || L.h || 0;
    const fw = L.sprite.frameW || origH || origW || 0;
    const fh = L.sprite.frameH || origW || 0;
    const scaleX = origW > 0 ? (Number(L.w) || 0) / origW : 1;
    const scaleY = origH > 0 ? (Number(L.h) || 0) / origH : 1;
    return { w: Math.round(fw * scaleX), h: Math.round(fh * scaleY) };
  }
  return { w: Number(L.w) || 0, h: Number(L.h) || 0 };
}
function layerLocalMatrix(L, getVisualSize = defaultVisualSize) {
  const { w, h } = getVisualSize(L);
  const cx = w / 2, cy = h / 2;
  const tx = Number(L.x) || 0, ty = Number(L.y) || 0;
  const rad = (Number(L.rotation) || 0) * Math.PI / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const sUniform = typeof L.scale === "number" && Number.isFinite(L.scale) ? L.scale : 1;
  const sx = typeof L.scaleX === "number" && Number.isFinite(L.scaleX) ? L.scaleX : sUniform;
  const sy = typeof L.scaleY === "number" && Number.isFinite(L.scaleY) ? L.scaleY : sUniform;
  const tanK = typeof L.skewX === "number" && Number.isFinite(L.skewX) ? Math.tan(L.skewX * Math.PI / 180) : 0;
  const a = cos * sx;
  const b = sin * sx;
  const c = (cos * tanK - sin) * sy;
  const d = (sin * tanK + cos) * sy;
  const e = tx + cx - a * cx - c * cy;
  const f = ty + cy - b * cx - d * cy;
  return { a, b, c, d, e, f };
}
function effectiveMatrix(L, getById, getVisualSize = defaultVisualSize) {
  if (!L) return matIdentity();
  let m = matIdentity();
  const chain = [];
  const visited = /* @__PURE__ */ new Set();
  let cur = L;
  while (cur && !visited.has(cur.id)) {
    visited.add(cur.id);
    chain.push(cur);
    cur = cur.parentId ? getById(cur.parentId) : null;
  }
  for (let i = chain.length - 1; i >= 0; i--) {
    m = matMultiply(m, layerLocalMatrix(chain[i], getVisualSize));
  }
  return m;
}
function effectiveOpacity(L, getById) {
  let op = 1;
  let cur = L;
  const visited = /* @__PURE__ */ new Set();
  while (cur && !visited.has(cur.id)) {
    visited.add(cur.id);
    op *= typeof cur.opacity === "number" && Number.isFinite(cur.opacity) ? cur.opacity : 1;
    cur = cur.parentId ? getById(cur.parentId) : null;
  }
  return op;
}
function decomposeMatrixFull(M, w, h) {
  const cx = w / 2, cy = h / 2;
  const a = M.a, b = M.b, c = M.c, d = M.d;
  const sw = Math.hypot(a, b);
  if (sw < 1e-12) {
    return {
      x: M.e,
      y: M.f,
      rotation: 0,
      skewX: 0,
      scaleW: 0,
      scaleH: 0
    };
  }
  const cos = a / sw;
  const sin = b / sw;
  const rotation = Math.atan2(b, a) * 180 / Math.PI;
  const dotN1 = c * cos + d * sin;
  const dotN2 = -c * sin + d * cos;
  const sh = dotN2;
  let skewX = 0;
  if (Math.abs(sh) > 1e-12) {
    const tanK = dotN1 / sh;
    skewX = Math.atan(tanK) * 180 / Math.PI;
  }
  const tx = M.e - cx + a * cx + c * cy;
  const ty = M.f - cy + b * cx + d * cy;
  return {
    x: tx,
    y: ty,
    rotation,
    skewX,
    scaleW: sw,
    scaleH: sh
  };
}
function decomposeMatrixUniform(M, w, h) {
  const dec = decomposeMatrixFull(M, w, h);
  return {
    x: dec.x,
    y: dec.y,
    rotation: dec.rotation,
    scale: dec.scaleW
  };
}
function cascadeChildResize(snapshot, sw, sh) {
  const M_local = layerLocalMatrix(
    /** @type {import('../core/index.js').Layer} */
    {
      x: snapshot.x,
      y: snapshot.y,
      rotation: snapshot.rotation,
      skewX: snapshot.skewX,
      scaleX: snapshot.scaleX,
      scaleY: snapshot.scaleY
    },
    () => ({ w: snapshot.w, h: snapshot.h })
  );
  const M = {
    a: sw * M_local.a,
    b: sh * M_local.b,
    c: sw * M_local.c,
    d: sh * M_local.d,
    e: sw * M_local.e,
    f: sh * M_local.f
  };
  return decomposeMatrixFull(M, snapshot.w, snapshot.h);
}
function cascadeTextScale(snapshot, sw, sh) {
  const dec = cascadeChildResize(snapshot, sw, sh);
  return {
    x: dec.x,
    y: dec.y,
    rotation: dec.rotation,
    skewX: dec.skewX,
    scaleX: dec.scaleW,
    scaleY: dec.scaleH
  };
}
function applyCascadeToLayer(L, snapshot, result) {
  const r2 = (n) => Math.round(n * 100) / 100;
  L.x = r2(result.x);
  L.y = r2(result.y);
  if (Math.abs(result.rotation) < 1e-6) delete L.rotation;
  else L.rotation = Math.round(result.rotation * 10) / 10;
  if (Math.abs(result.skewX) < 1e-6) delete L.skewX;
  else L.skewX = Math.round(result.skewX * 10) / 10;
  if (Math.abs(result.scaleW - 1) < 1e-9) delete L.scaleX;
  else L.scaleX = Math.round(result.scaleW * 1e4) / 1e4;
  if (Math.abs(result.scaleH - 1) < 1e-9) delete L.scaleY;
  else L.scaleY = Math.round(result.scaleH * 1e4) / 1e4;
}
var init_transformMath = __esm({
  "js/anim-runtime/transformMath.js"() {
  }
});

// js/anim-runtime/interpolator.js
function createInterpolator(deps) {
  const {
    getAction: getAction2,
    getLayerById: getLayerById2,
    getLayers: getLayers2,
    getDescendantIds: getDescendantIds2,
    dispatchBatched: dispatchBatched2 = () => {
    }
  } = deps || {};
  if (typeof getAction2 !== "function" || typeof getLayerById2 !== "function" || typeof getLayers2 !== "function" || typeof getDescendantIds2 !== "function") {
    throw new Error("createInterpolator: deps must include getAction, getLayerById, getLayers, getDescendantIds");
  }
  function _snapshotLayerEditorState(L) {
    const snap = (
      /** @type {any} */
      {}
    );
    for (const channel of getAllChannels()) {
      channel.snapshotIdleFields(L, snap);
    }
    return snap;
  }
  let _editorState = null;
  const _priorityLock = /* @__PURE__ */ new Map();
  let _runIdN = 0;
  function snapshotEditorState(actionId) {
    _editorState = /* @__PURE__ */ new Map();
    const a = getAction2(actionId);
    if (!a) return;
    for (const L of getLayers2()) {
      if (!L || !L.id) continue;
      _editorState.set(L.id, _snapshotLayerEditorState(L));
    }
  }
  function isEditorStateSnapshotted() {
    return _editorState !== null;
  }
  function ensureEditorStateForLayer(layerId) {
    if (!_editorState || !layerId || _editorState.has(layerId)) return;
    const L = getLayerById2(layerId);
    if (!L) return;
    _editorState.set(layerId, _snapshotLayerEditorState(L));
  }
  function _restoreLayerToEditorState(L, snap) {
    for (const channel of getAllChannels()) {
      channel.restoreIdleFields(L, snap);
    }
  }
  function restoreEditorState() {
    if (!_editorState) return;
    for (const [layerId, snap] of _editorState.entries()) {
      const L = getLayerById2(layerId);
      if (!L) continue;
      _restoreLayerToEditorState(L, snap);
    }
    _editorState = null;
    dispatchBatched2("layers-changed");
  }
  function applyInterpolation(actionId, currentTime, opts = {}) {
    if (!_editorState) return;
    const a = getAction2(actionId);
    if (!a) return;
    const t = Math.max(0, Number.isFinite(currentTime) ? currentTime : 0);
    const extrapolation = opts.extrapolation === "nothing" ? "nothing" : "hold";
    const blending = opts.blending === "add" ? "add" : "replace";
    const priority = Number.isFinite(opts.priority) ? opts.priority : 0;
    const runId = opts.runId;
    for (const trk of a.tracks || []) {
      if (!trk.layerId) continue;
      const channel = getChannelOrNull(trk.channel);
      if (!channel || !channel.interpolated) continue;
      if (runId != null) {
        const cur = _priorityLock.get(trk.layerId);
        if (cur && cur.priority > priority && cur.runId !== runId) continue;
        _priorityLock.set(trk.layerId, { priority, runId });
      }
      const L = getLayerById2(trk.layerId);
      if (!L) continue;
      const snap = _editorState.get(trk.layerId);
      if (!snap) continue;
      const v = sampleTrack(trk, t, snap, extrapolation);
      if (v == null) continue;
      const final = blendValue(trk.channel, v, blending, snap, trk.keyframes?.[0]?.value);
      applyChannelValueTo(L, trk.channel, final, snap);
      if (channel.cascadesToChildren) {
        for (const dId of getDescendantIds2(trk.layerId)) {
          const dL = getLayerById2(dId);
          const dSnap = _editorState.get(dId);
          if (dL && dSnap) _restoreLayerToEditorState(dL, dSnap);
        }
      }
    }
    if (a.overrides && a.overrides.byLayerId) {
      for (const layerId of Object.keys(a.overrides.byLayerId)) {
        const layerMap = a.overrides.byLayerId[layerId];
        if (!layerMap) continue;
        const L = getLayerById2(layerId);
        if (!L) continue;
        const snap = _editorState.get(layerId);
        if (!snap) continue;
        for (const channelName of Object.keys(layerMap)) {
          const hasKf = (a.tracks || []).some(
            (trk) => trk.layerId === layerId && trk.channel === channelName && (trk.keyframes || []).length > 0
          );
          if (hasKf) continue;
          const channel = getChannelOrNull(channelName);
          if (!channel || !channel.interpolated) continue;
          if (runId != null) {
            const cur = _priorityLock.get(layerId);
            if (cur && cur.priority > priority && cur.runId !== runId) continue;
            _priorityLock.set(layerId, { priority, runId });
          }
          applyChannelValueTo(
            L,
            /** @type {any} */
            channelName,
            layerMap[channelName],
            snap
          );
          if (channel.cascadesToChildren) {
            for (const dId of getDescendantIds2(layerId)) {
              const dL = getLayerById2(dId);
              const dSnap = _editorState.get(dId);
              if (dL && dSnap) _restoreLayerToEditorState(dL, dSnap);
            }
          }
        }
      }
    }
    dispatchBatched2("layers-changed");
  }
  function getEditorStateFor(layerId) {
    if (_editorState && _editorState.has(layerId)) {
      const snap = _editorState.get(layerId);
      return snap == null ? null : snap;
    }
    return null;
  }
  function playActionRun(actionId, opts = {}) {
    const actionMaybe = getAction2(actionId);
    if (!actionMaybe) {
      try {
        opts.onDone?.();
      } catch (_) {
      }
      return () => {
      };
    }
    const action = actionMaybe;
    if (!_editorState) _editorState = /* @__PURE__ */ new Map();
    for (const t of action.tracks || []) {
      if (!t.layerId || _editorState.has(t.layerId)) continue;
      const L = getLayerById2(t.layerId);
      if (!L) continue;
      _editorState.set(t.layerId, _snapshotLayerEditorState(L));
    }
    const playMode = opts.mode === "loop" || opts.mode === "once" ? opts.mode : action.playMode === "loop" ? "loop" : "once";
    const r0 = Array.isArray(action.range) && Number.isFinite(action.range[0]) ? action.range[0] : 0;
    const r1 = Array.isArray(action.range) && Number.isFinite(action.range[1]) ? action.range[1] : action.duration || 0;
    const rs = Math.max(0, Math.min(r0, r1));
    const re = Math.max(rs, Math.max(r0, r1));
    let stopped = false;
    let rafId = 0;
    let wallStart = 0;
    let doneFired = false;
    const fireDone = () => {
      if (doneFired) return;
      doneFired = true;
      try {
        opts.onDone?.();
      } catch (_) {
      }
    };
    const runId = ++_runIdN;
    const reversed = !!opts.reversed;
    const blendIn = typeof opts.blendIn === "number" && Number.isFinite(opts.blendIn) && opts.blendIn > 0 ? opts.blendIn : 0;
    const blendOut = typeof opts.blendOut === "number" && Number.isFinite(opts.blendOut) && opts.blendOut > 0 ? opts.blendOut : 0;
    const toSampleTime = (tWall) => reversed ? rs + (re - tWall) : tWall;
    const blendAlpha = (tWall) => {
      let a = 1;
      if (blendIn > 0) a = Math.min(a, Math.min(1, (tWall - rs) / blendIn));
      if (blendOut > 0) a = Math.min(a, Math.min(1, (re - tWall) / blendOut));
      return Math.max(0, a);
    };
    const interpBase = {
      extrapolation: opts.extrapolation,
      blending: opts.blending,
      priority: opts.priority,
      runId
    };
    const applyAt = (tWall) => {
      const alpha = blendAlpha(tWall);
      if (alpha <= 1e-3) return;
      const sampleT = toSampleTime(tWall);
      applyInterpolation(actionId, sampleT, interpBase);
    };
    const _firedTriggers = /* @__PURE__ */ new Set();
    let _prevApplyT = -Infinity;
    function fireTriggers(curT) {
      for (const trk of action.tracks || []) {
        if (trk.channel !== "trigger") continue;
        if (!trk.layerId) continue;
        const kfs = trk.keyframes || [];
        for (let i = 0; i < kfs.length; i++) {
          const kf = kfs[i];
          if (kf.time <= _prevApplyT) continue;
          if (kf.time > curT) break;
          const key = `${trk.id}:${i}`;
          if (_firedTriggers.has(key)) continue;
          _firedTriggers.add(key);
          const L = getLayerById2(trk.layerId);
          if (!L) continue;
          const kind = kf.value && kf.value.kind ? kf.value.kind : "play";
          if (kind === "play") L.playing = true;
          else if (kind === "stop") L.playing = false;
          else if (kind === "toggle") L.playing = !L.playing;
        }
      }
      _prevApplyT = curT;
    }
    applyAt(rs);
    fireTriggers(rs);
    try {
      opts.onRender?.();
    } catch (_) {
    }
    const isStatic = (action.tracks || []).every((t) => (t.keyframes || []).length <= 1);
    if (isStatic) {
      stopped = true;
      for (const [lid, info] of _priorityLock) {
        if (info && info.runId === runId) _priorityLock.delete(lid);
      }
      fireDone();
      return () => {
      };
    }
    const tick = (now) => {
      if (stopped) return;
      if (!wallStart) wallStart = typeof now === "number" ? now : performance.now();
      const cur = typeof now === "number" ? now : performance.now();
      let tWall = rs + (cur - wallStart) / 1e3;
      if (tWall >= re) {
        if (playMode === "once") {
          applyAt(re);
          fireTriggers(re);
          try {
            opts.onRender?.();
          } catch (_) {
          }
          stopped = true;
          fireDone();
          return;
        }
        wallStart = cur;
        tWall = rs;
        _firedTriggers.clear();
        _prevApplyT = -Infinity;
        fireDone();
      }
      applyAt(tWall);
      fireTriggers(tWall);
      try {
        opts.onRender?.();
      } catch (_) {
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      if (stopped) return;
      stopped = true;
      if (rafId) {
        try {
          cancelAnimationFrame(rafId);
        } catch (_) {
        }
      }
      rafId = 0;
      for (const [lid, info] of _priorityLock) {
        if (info && info.runId === runId) _priorityLock.delete(lid);
      }
    };
  }
  function _getEditorStateMap() {
    return _editorState ? new Map(_editorState) : null;
  }
  function _resetEditorState() {
    _editorState = null;
  }
  return {
    snapshotEditorState,
    isEditorStateSnapshotted,
    ensureEditorStateForLayer,
    restoreEditorState,
    applyInterpolation,
    getEditorStateFor,
    playActionRun,
    _getEditorStateMap,
    _resetEditorState
  };
}
var init_interpolator = __esm({
  "js/anim-runtime/interpolator.js"() {
    init_sampler();
    init_channelRegistry();
  }
});

// js/anim-runtime/resolution.js
function _cloneValue(v) {
  if (v == null) return v;
  if (typeof v === "object") return { ...v };
  return v;
}
function resolveChannelValue(action, L, channelName, t, idle = null) {
  const channel = getChannelOrNull(channelName);
  if (!channel) return null;
  if (action && Array.isArray(action.tracks) && L && L.id) {
    for (const trk of action.tracks) {
      if (trk.layerId !== L.id) continue;
      if (trk.channel !== channelName) continue;
      if (Array.isArray(trk.keyframes) && trk.keyframes.length > 0) {
        return sampleTrack(trk, t, idle);
      }
    }
  }
  if (action && action.overrides && action.overrides.byLayerId && L && L.id) {
    const layerMap = action.overrides.byLayerId[L.id];
    if (layerMap && layerMap[channelName] !== void 0) {
      return _cloneValue(layerMap[channelName]);
    }
  }
  return channel.read(L, idle);
}
var init_resolution = __esm({
  "js/anim-runtime/resolution.js"() {
    init_sampler();
    init_channelRegistry();
  }
});

// js/anim-runtime/index.js
var init_anim_runtime = __esm({
  "js/anim-runtime/index.js"() {
    init_sampler();
    init_transformMath();
    init_interpolator();
    init_channelRegistry();
    init_resolution();
  }
});

// js/event-graph/runtime.js
function createRuntime() {
  const animations = [];
  const transitions = [];
  const listeners2 = { sourceTrigger: [], hintTrigger: [] };
  function registerAnimation(spec) {
    animations.push(spec);
  }
  function triggerHint(hintId) {
    let matched = false;
    for (const a of animations) {
      if (a.loop) continue;
      if (a.triggerHintId != null && a.triggerHintId !== hintId) continue;
      matched = true;
      try {
        a.play();
      } catch (_) {
      }
    }
    for (const fn of listeners2.hintTrigger) {
      try {
        fn({ hintId });
      } catch (_) {
      }
    }
    if (hintId && triggerSource(hintId)) matched = true;
    return matched;
  }
  function registerTransition(spec) {
    transitions.push(spec);
  }
  function triggerSource(layerId) {
    let matched = false;
    for (const t of transitions) {
      if (t.fromLayerId !== layerId) continue;
      matched = true;
      try {
        t.play();
      } catch (_) {
      }
    }
    for (const fn of listeners2.sourceTrigger) {
      try {
        fn({ layerId });
      } catch (_) {
      }
    }
    return matched;
  }
  function on(event, fn) {
    if (!listeners2[event]) listeners2[event] = [];
    listeners2[event].push(fn);
    return () => {
      const arr = listeners2[event];
      if (!arr) return;
      const i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    };
  }
  function getAnimations() {
    return animations.slice();
  }
  function getTransitions() {
    return transitions.slice();
  }
  const triggerHandlers = /* @__PURE__ */ new Map();
  function registerTrigger(name, fn) {
    if (!name || typeof fn !== "function") return () => {
    };
    let set = triggerHandlers.get(name);
    if (!set) {
      set = /* @__PURE__ */ new Set();
      triggerHandlers.set(name, set);
    }
    set.add(fn);
    return () => {
      triggerHandlers.get(name)?.delete(fn);
    };
  }
  function triggerByName(name) {
    const set = triggerHandlers.get(name);
    if (!set || set.size === 0) return false;
    for (const fn of set) {
      try {
        fn({});
      } catch (_) {
      }
    }
    return true;
  }
  return {
    registerAnimation,
    registerTransition,
    triggerHint,
    triggerSource,
    registerTrigger,
    triggerByName,
    on,
    getAnimations,
    getTransitions
  };
}
var init_runtime = __esm({
  "js/event-graph/runtime.js"() {
  }
});

// js/event-graph/dock/model.js
function setNodeRegistry(registry) {
  _nodeRegistry = registry;
}
function layerSubtype(L) {
  if (!L) return "\u2014";
  if (L.type === "lottie") return "Lottie";
  if (L.type === "png") return L.sprite && L.sprite.enabled ? "Sprite" : "PNG";
  if (L.type === "video") {
    return (L.mimeType || "").toLowerCase() === "image/gif" ? "GIF" : "\u0412\u0438\u0434\u0435\u043E";
  }
  if (L.type === "hint") return "\u0425\u0438\u043D\u0442";
  if (L.type === "text") return "\u0422\u0435\u043A\u0441\u0442";
  if (L.type === "interactive-animation") return "\u0418\u043D\u0442\u0435\u0440\u0430\u043A\u0442\u0438\u0432\u043D\u0430\u044F";
  return L.type;
}
var NODE_EVENT, NODE_ANIMATION, NODE_LAYER, NODE_DELAY, NODE_ACTION, NODE_START, NODE_INTERACTIVE_ANIMATION, _nodeRegistry;
var init_model = __esm({
  "js/event-graph/dock/model.js"() {
    NODE_EVENT = "event";
    NODE_ANIMATION = "animation";
    NODE_LAYER = "layer";
    NODE_DELAY = "delay";
    NODE_ACTION = "action";
    NODE_START = "start";
    NODE_INTERACTIVE_ANIMATION = "interactive-animation";
    _nodeRegistry = null;
  }
});

// js/event-graph/compileNodes.js
function flatChildren(childrenBySocket) {
  const out = [];
  for (const k of Object.keys(childrenBySocket || {})) {
    const arr = childrenBySocket[k];
    if (Array.isArray(arr)) out.push(...arr);
  }
  return out;
}
function compileEvent(_spec, childrenBySocket) {
  const children = flatChildren(childrenBySocket);
  if (children.length === 0) return null;
  return (ctx) => {
    for (const c of children) c(ctx);
  };
}
function compileStart(_spec, childrenBySocket) {
  const fireKids = childrenBySocket.fire || [];
  if (fireKids.length === 0) return null;
  return (ctx) => {
    for (const c of fireKids) {
      try {
        c(ctx);
      } catch (_) {
      }
    }
  };
}
function compileAnimation(spec, childrenBySocket, api) {
  const playKids = childrenBySocket.play || [];
  const doneKids = childrenBySocket.done || [];
  if (playKids.length === 0 && doneKids.length === 0) return null;
  if (playKids.length === 0) return null;
  const mode = spec.mode === "loop" ? "loop" : "once";
  const cycles = Number.isInteger(spec.cycles) && spec.cycles >= 1 ? spec.cycles : 1;
  const addCycleListener2 = api && typeof api.addCycleListener === "function" ? api.addCycleListener : null;
  const playByLayerId = api && api.playByLayerId;
  return (ctx) => {
    const next = { ...ctx, mode };
    if (doneKids.length === 0 || !addCycleListener2) {
      for (const c of playKids) c(next);
      return;
    }
    const triggered = [];
    const collectCtx = { ...next, collectLayer: (id) => {
      if (id) triggered.push(id);
    } };
    for (const c of playKids) c(collectCtx);
    if (triggered.length === 0) return;
    const pending = triggered.map((lid) => new Promise((resolve) => {
      let n = 0;
      const unsub = addCycleListener2(lid, () => {
        n += 1;
        if (n >= cycles) {
          unsub();
          resolve();
          return;
        }
        if (mode === "once" && playByLayerId) {
          const playFn = playByLayerId.get(lid);
          if (playFn) {
            try {
              playFn("once");
            } catch (_) {
            }
          }
        }
      });
    }));
    Promise.all(pending).then(() => {
      for (const c of doneKids) c(ctx);
    }).catch(() => {
    });
  };
}
function compileAction(spec, childrenBySocket, api) {
  const playAction = api && api.playAction;
  if (!spec.actionId || typeof playAction !== "function") return null;
  const doneKids = childrenBySocket.done || [];
  return (ctx) => {
    const mode = ctx.mode || spec.mode || "once";
    playAction(spec.actionId, {
      mode,
      extrapolation: spec.extrapolation || "hold",
      blending: spec.blending || "replace",
      priority: Number.isFinite(spec.priority) ? spec.priority : 0,
      reversed: spec.reversed === "rev",
      blendIn: Number.isFinite(spec.blendIn) ? spec.blendIn : 0,
      blendOut: Number.isFinite(spec.blendOut) ? spec.blendOut : 0,
      onDone: () => {
        for (const c of doneKids) {
          try {
            c(ctx);
          } catch (_) {
          }
        }
      }
    });
  };
}
function compileLayer(spec, childrenBySocket, api) {
  const children = flatChildren(childrenBySocket);
  const playByLayerId = api && api.playByLayerId;
  const play = spec.layerId && playByLayerId ? playByLayerId.get(spec.layerId) : null;
  if (!play && children.length === 0) return null;
  return (ctx) => {
    if (play) {
      try {
        play(ctx.mode || "once");
      } catch (_) {
      }
      if (spec.layerId && typeof ctx.collectLayer === "function") {
        ctx.collectLayer(spec.layerId);
      }
    }
    for (const c of children) c(ctx);
  };
}
function compileInteractiveAnimation(spec, _children, api) {
  const layerId = spec.layerId;
  if (!layerId) return null;
  const routeIaTrigger = api && typeof api.routeIaTrigger === "function" ? api.routeIaTrigger : null;
  if (!routeIaTrigger) return null;
  return (ctx) => {
    const name = ctx && ctx._targetSocket;
    if (typeof name !== "string" || !name) return;
    try {
      routeIaTrigger(layerId, name);
    } catch (_) {
    }
  };
}
function compileDelay(spec, childrenBySocket) {
  const children = flatChildren(childrenBySocket);
  if (children.length === 0) return null;
  const ms = Math.max(0, Number.isFinite(spec.ms) ? Math.floor(spec.ms) : 500);
  return (ctx) => {
    setTimeout(() => {
      for (const c of children) c(ctx);
    }, ms);
  };
}
var NODE_COMPILERS;
var init_compileNodes = __esm({
  "js/event-graph/compileNodes.js"() {
    init_model();
    NODE_COMPILERS = {
      [NODE_EVENT]: compileEvent,
      [NODE_START]: compileStart,
      [NODE_ANIMATION]: compileAnimation,
      [NODE_ACTION]: compileAction,
      [NODE_LAYER]: compileLayer,
      [NODE_INTERACTIVE_ANIMATION]: compileInteractiveAnimation,
      [NODE_DELAY]: compileDelay
    };
  }
});

// js/event-graph/compileGraph.js
function indexEdges(edges) {
  const edgesFrom = /* @__PURE__ */ new Map();
  for (const [, e] of edges) {
    if (!e || !e.from || !e.to) continue;
    let list = edgesFrom.get(e.from.nodeId);
    if (!list) {
      list = [];
      edgesFrom.set(e.from.nodeId, list);
    }
    list.push(e);
  }
  return edgesFrom;
}
function compileNode(nodeId, nodes, edgesFrom, memo, api) {
  if (memo.has(nodeId)) {
    const v = memo.get(nodeId);
    if (v === "__inprogress__") return null;
    return (
      /** @type {CompiledFn} */
      v ?? null
    );
  }
  memo.set(nodeId, "__inprogress__");
  const spec = nodes.get(nodeId);
  if (!spec) {
    memo.set(nodeId, null);
    return null;
  }
  const compile = NODE_COMPILERS[spec.kind];
  if (typeof compile !== "function") {
    memo.set(nodeId, null);
    return null;
  }
  const outgoing = edgesFrom.get(nodeId) || [];
  const childrenBySocket = {};
  for (const e of outgoing) {
    const childFn = compileNode(e.to.nodeId, nodes, edgesFrom, memo, api);
    if (typeof childFn !== "function") continue;
    const sock = e.from.socket || "";
    const targetSocket = e.to.socket || "";
    const wrapped = targetSocket ? (ctx) => childFn({ ...ctx || {}, _targetSocket: targetSocket }) : childFn;
    if (!childrenBySocket[sock]) childrenBySocket[sock] = [];
    childrenBySocket[sock].push(wrapped);
  }
  const fn = compile(spec, childrenBySocket, api) || null;
  memo.set(nodeId, fn);
  return fn;
}
function compileEventGraph(graph, api = {}) {
  const nodes = graph?.nodes;
  const edges = graph?.edges;
  if (!nodes || !edges) return [];
  const edgesFrom = indexEdges(edges);
  const memo = /* @__PURE__ */ new Map();
  const transitions = [];
  for (const [evId, evSpec] of nodes) {
    if (!evSpec || evSpec.kind !== NODE_EVENT) continue;
    const sourceType = evSpec.sourceType || "layer";
    if (sourceType !== "layer") continue;
    if (!evSpec.layerId) continue;
    const fn = compileNode(evId, nodes, edgesFrom, memo, api);
    if (!fn) continue;
    transitions.push({
      fromLayerId: evSpec.layerId,
      play: () => {
        try {
          fn({});
        } catch (_) {
        }
      }
    });
  }
  return transitions;
}
function compileTriggers(graph, api = {}) {
  const nodes = graph?.nodes;
  const edges = graph?.edges;
  if (!nodes || !edges) return [];
  const edgesFrom = indexEdges(edges);
  const memo = /* @__PURE__ */ new Map();
  const handlers = [];
  for (const [evId, evSpec] of nodes) {
    if (!evSpec || evSpec.kind !== NODE_EVENT) continue;
    if (evSpec.sourceType !== "trigger") continue;
    const name = evSpec.triggerName;
    if (typeof name !== "string" || !name) continue;
    const fn = compileNode(evId, nodes, edgesFrom, memo, api);
    if (!fn) continue;
    handlers.push({
      name,
      fn: () => {
        try {
          fn({});
        } catch (_) {
        }
      }
    });
  }
  return handlers;
}
function compileStarts(graph, api = {}) {
  const nodes = graph?.nodes;
  const edges = graph?.edges;
  if (!nodes || !edges) return [];
  const edgesFrom = indexEdges(edges);
  const memo = /* @__PURE__ */ new Map();
  const starts = [];
  for (const [nid, spec] of nodes) {
    if (!spec || spec.kind !== NODE_START) continue;
    const fn = compileNode(nid, nodes, edgesFrom, memo, api);
    if (!fn) continue;
    starts.push(() => {
      try {
        fn({});
      } catch (_) {
      }
    });
  }
  return starts;
}
var init_compileGraph = __esm({
  "js/event-graph/compileGraph.js"() {
    init_compileNodes();
    init_model();
  }
});

// js/event-graph/playController.js
var init_playController = __esm({
  "js/event-graph/playController.js"() {
  }
});

// js/event-graph/hintPulse.js
var init_hintPulse = __esm({
  "js/event-graph/hintPulse.js"() {
  }
});

// js/event-graph/layerCycleBus.js
function addCycleListener(layerId, fn) {
  if (!layerId || typeof fn !== "function") return () => {
  };
  let set = listeners.get(layerId);
  if (!set) {
    set = /* @__PURE__ */ new Set();
    listeners.set(layerId, set);
  }
  set.add(fn);
  return () => {
    const s = listeners.get(layerId);
    if (!s) return;
    s.delete(fn);
    if (s.size === 0) listeners.delete(layerId);
  };
}
function fireCycle(layerId) {
  const set = listeners.get(layerId);
  if (!set) return;
  for (const fn of Array.from(set)) {
    try {
      fn();
    } catch (_) {
    }
  }
}
function clearCycleListeners() {
  listeners.clear();
}
var listeners;
var init_layerCycleBus = __esm({
  "js/event-graph/layerCycleBus.js"() {
    listeners = /* @__PURE__ */ new Map();
  }
});

// js/core/eventBatch.js
var init_eventBatch = __esm({
  "js/core/eventBatch.js"() {
  }
});

// js/core/editorContext.js
function createEditorContext() {
  return {
    layers: [],
    sel: null,
    idn: 1,
    selectedIds: /* @__PURE__ */ new Set(),
    _layerById: /* @__PURE__ */ new Map(),
    _history: [],
    _future: [],
    _suppressUndo: false,
    // UI-ASSETS-PANEL Stage 1 (2026-05-18) → Stage 8d (2026-05-18, root-only):
    // canonical store ассетов. Используется только на root context'е —
    // inner-context'ы получают пустой Map для structural compat'а с typedef'ом,
    // assetLibrary.js всегда обращается к `getRootContext()._assetLibrary`.
    _assetLibrary: /* @__PURE__ */ new Map(),
    _assetIdn: 1,
    eventGraph: { nodes: /* @__PURE__ */ new Map(), edges: /* @__PURE__ */ new Map(), layout: /* @__PURE__ */ new Map() },
    _actions: /* @__PURE__ */ new Map(),
    _actionIdN: 1,
    _graphView: { panX: 0, panY: 0, zoom: 1 },
    _workspace: {
      graph: { open: false, height: 0 },
      animDock: { open: false, height: 0 },
      leftPanel: { tab: "layers" }
    },
    canvas: { w: 400, h: 400 }
  };
}
function getCurrentContext() {
  return _state;
}
function getRootContext() {
  return _contextStack[0];
}
function _readContextStack() {
  return _contextStack.slice();
}
var _contextStack, _state;
var init_editorContext = __esm({
  "js/core/editorContext.js"() {
    _contextStack = [createEditorContext()];
    _state = _contextStack[0];
  }
});

// js/core/layerBuilder.js
var init_layerBuilder = __esm({
  "js/core/layerBuilder.js"() {
  }
});

// js/core/assetLibrary.js
function _root() {
  return getRootContext();
}
function getAsset(assetId) {
  return _root()._assetLibrary.get(assetId) || null;
}
var init_assetLibrary = __esm({
  "js/core/assetLibrary.js"() {
    init_editorContext();
    init_eventBatch();
    init_undoHistory();
    init_fileManager();
    init_layerBuilder();
  }
});

// js/core/undoHistory.js
function _onInnerHistoryChange(fn) {
  _innerHistoryChangeHooks.push(fn);
}
function _currentPersistKey() {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem("dr_session_active_v1");
    if (!raw) return null;
    const rec = JSON.parse(raw);
    return rec && rec.id ? String(rec.id) : null;
  } catch (_) {
    return null;
  }
}
var _innerHistoryChangeHooks;
var init_undoHistory = __esm({
  "js/core/undoHistory.js"() {
    init_editorContext();
    init_eventBatch();
    init_assetLibrary();
    _innerHistoryChangeHooks = [];
  }
});

// js/core/hierarchy.js
var init_hierarchy = __esm({
  "js/core/hierarchy.js"() {
    init_editorContext();
    init_eventBatch();
    init_undoHistory();
    init_anim_runtime();
  }
});

// js/core/fileManager.js
var getAction;
var init_fileManager = __esm({
  "js/core/fileManager.js"() {
    init_eventBatch();
    init_hierarchy();
    init_undoHistory();
    init_editorContext();
    getAction = (id) => _state._actions.get(id) || null;
  }
});

// js/core/layerFactories.js
var init_layerFactories = __esm({
  "js/core/layerFactories.js"() {
    init_editorContext();
    init_eventBatch();
    init_undoHistory();
    init_fileManager();
    init_assetLibrary();
    init_layerBuilder();
  }
});

// js/core/alignment.js
var init_alignment = __esm({
  "js/core/alignment.js"() {
    init_editorContext();
    init_eventBatch();
    init_undoHistory();
    init_fileManager();
    init_hierarchy();
  }
});

// js/core/duplication.js
var init_duplication = __esm({
  "js/core/duplication.js"() {
    init_editorContext();
    init_eventBatch();
    init_undoHistory();
    init_fileManager();
    init_hierarchy();
  }
});

// js/core/actionQueries.js
var init_actionQueries = __esm({
  "js/core/actionQueries.js"() {
    init_editorContext();
  }
});

// js/core/actionOverrides.js
var init_actionOverrides = __esm({
  "js/core/actionOverrides.js"() {
    init_editorContext();
    init_eventBatch();
    init_undoHistory();
    init_anim_runtime();
  }
});

// js/core/interactiveLayer.js
function _scheduleIaHistoryPersist() {
  if (typeof localStorage === "undefined") return;
  if (_iaSuppressPersistOnce) {
    _iaSuppressPersistOnce = false;
    return;
  }
  if (_iaPersistTimer) clearTimeout(_iaPersistTimer);
  _iaPersistTimer = /** @type {any} */
  setTimeout(_persistIaHistory, 300);
}
function _persistIaHistory() {
  if (typeof localStorage === "undefined") return;
  const pid = _currentPersistKey();
  if (!pid) return;
  try {
    const payload = {};
    for (const [assetId, h] of _iaHistoryByAsset) {
      if ((h.history?.length || 0) === 0 && (h.future?.length || 0) === 0) continue;
      payload[assetId] = h;
    }
    if (Object.keys(payload).length === 0) {
      localStorage.removeItem("dr_undo_inner_" + pid);
    } else {
      localStorage.setItem("dr_undo_inner_" + pid, JSON.stringify(payload));
    }
  } catch (_) {
  }
}
function purgeStaleIaHistory() {
  if (_iaHistoryByAsset.size === 0) return;
  const alive = /* @__PURE__ */ new Set();
  for (const rec of getRootContext()._assetLibrary.values()) {
    if (rec && rec.kind === "ia") alive.add(rec.id);
  }
  let changed = false;
  for (const assetId of _iaHistoryByAsset.keys()) {
    if (!alive.has(assetId)) {
      _iaHistoryByAsset.delete(assetId);
      changed = true;
    }
  }
  if (changed) _scheduleIaHistoryPersist();
}
function isInsideInteractiveLayer() {
  return !!getCurrentContext()._parentLayerId;
}
function getLayerByIdAnywhere(layerId) {
  for (const ctx of _allContexts()) {
    const L = ctx._layerById?.get(layerId);
    if (L) return L;
  }
  return null;
}
function _allContexts() {
  return _readContextStack();
}
var _iaHistoryByAsset, _iaPersistTimer, _iaSuppressPersistOnce;
var init_interactiveLayer = __esm({
  "js/core/interactiveLayer.js"() {
    init_editorContext();
    init_undoHistory();
    init_eventBatch();
    init_assetLibrary();
    init_layerBuilder();
    _iaHistoryByAsset = /* @__PURE__ */ new Map();
    _iaPersistTimer = 0;
    _iaSuppressPersistOnce = false;
    _onInnerHistoryChange(() => {
      const ctx = getCurrentContext();
      const aid = ctx._parentAssetId;
      if (!aid) return;
      _iaHistoryByAsset.set(aid, {
        history: ctx._history.slice(),
        future: ctx._future.slice()
      });
      _scheduleIaHistoryPersist();
    });
    if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
      document.addEventListener("layers-changed", purgeStaleIaHistory);
      document.addEventListener("project-loaded", purgeStaleIaHistory);
      document.addEventListener("assets-changed", purgeStaleIaHistory);
    }
  }
});

// js/core/errorHandler.js
var init_errorHandler = __esm({
  "js/core/errorHandler.js"() {
  }
});

// js/core/layerKinds.js
function isSpritePng(L) {
  return !!(L && L.type === "png" && L.sprite && L.sprite.enabled);
}
function isPinned(L) {
  return !!(L && L.type === "solid" && (L.mode === "fill" || !L.mode));
}
function isMedia(L) {
  if (!L) return false;
  if (L.type === "png" || L.type === "lottie" || L.type === "video") return true;
  if (L.type === "solid" && L.mode === "layer") return true;
  if (L.type === "null") return true;
  return false;
}
function hasIntrinsicContent(L) {
  if (!L) return false;
  return L.type === "png" || L.type === "lottie" || L.type === "video";
}
function isAnimated(L) {
  if (!L) return false;
  if (L.type === "lottie" || L.type === "video") return true;
  if (isSpritePng(L)) return true;
  return false;
}
function isScalable(L) {
  if (!L) return false;
  return L.type === "png" || L.type === "lottie" || L.type === "video" || L.type === "hint" || L.type === "text" || L.type === "solid";
}
function isNull(L) {
  return !!(L && L.type === "null");
}
var init_layerKinds = __esm({
  "js/core/layerKinds.js"() {
  }
});

// js/core/projectUtils.js
function escapeHTML(s) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
  return String(s || "").replace(/[&<>"]/g, (c) => map[c]);
}
function makeCopyTitle(original, existingTitles) {
  const base = original.replace(/\s*\(копия(?:\s*\d+)?\)\s*$/, "").trim();
  let n = 1;
  while (true) {
    const candidate = `${base} (\u043A\u043E\u043F\u0438\u044F ${n})`;
    if (!existingTitles.includes(candidate)) return candidate;
    n++;
  }
}
function parsePx(v) {
  if (v == null || v === "") return 0;
  const n = parseFloat(String(v).replace("px", ""));
  return isFinite(n) ? Math.round(n) : 0;
}
function dimsOf(o) {
  const w = [o.w, o.width, o.displayW, o.dw, o.frame?.w, o.bounds?.w, o.size?.w].find((v) => typeof v === "number" && isFinite(v));
  const h = [o.h, o.height, o.displayH, o.dh, o.frame?.h, o.bounds?.h, o.size?.h].find((v) => typeof v === "number" && isFinite(v));
  return { w: num(w), h: num(h) };
}
function scaleOf(o) {
  const sx = [o.scaleX, o.sx, o.scale?.x, o.transform?.scaleX].find((v) => typeof v === "number" && isFinite(v));
  const sy = [o.scaleY, o.sy, o.scale?.y, o.transform?.scaleY].find((v) => typeof v === "number" && isFinite(v));
  return { sx: typeof sx === "number" ? sx : 1, sy: typeof sy === "number" ? sy : 1 };
}
var num;
var init_projectUtils = __esm({
  "js/core/projectUtils.js"() {
    num = (v) => typeof v === "number" && isFinite(v) ? v : 0;
  }
});

// js/core/rafThrottle.js
var init_rafThrottle = __esm({
  "js/core/rafThrottle.js"() {
  }
});

// js/core/zoom.js
var init_zoom = __esm({
  "js/core/zoom.js"() {
  }
});

// js/core/utils.js
var init_utils = __esm({
  "js/core/utils.js"() {
  }
});

// js/core/listeners.js
var init_listeners = __esm({
  "js/core/listeners.js"() {
    init_eventBatch();
    init_undoHistory();
  }
});

// js/core/index.js
var init_core = __esm({
  "js/core/index.js"() {
    init_fileManager();
    init_undoHistory();
    init_layerFactories();
    init_alignment();
    init_duplication();
    init_hierarchy();
    init_actionQueries();
    init_actionOverrides();
    init_interactiveLayer();
    init_assetLibrary();
    init_eventBatch();
    init_errorHandler();
    init_layerKinds();
    init_projectUtils();
    init_rafThrottle();
    init_zoom();
    init_utils();
    init_listeners();
  }
});

// js/ui/inputCommit.js
var init_inputCommit = __esm({
  "js/ui/inputCommit.js"() {
  }
});

// js/event-graph/dock/nodes.js
function _readIaTriggers(L) {
  if (!L || L.type !== "interactive-animation") return [];
  const rec = L.assetId ? getAsset(L.assetId) : null;
  const payload = (
    /** @type {import('../../core/index.js').IaPayload | null} */
    rec && rec.kind === "ia" ? rec.payload : null
  );
  if (payload && Array.isArray(payload.triggers)) return payload.triggers.slice();
  return [];
}
function viewModelWithLayer(id, spec, { layerById }, { typeLabel }) {
  const L = spec.layerId ? layerById.get(spec.layerId) : null;
  return {
    id,
    kind: spec.kind,
    layerId: spec.layerId || null,
    label: L ? L.name || L.id : "\u2014 \u0441\u043B\u043E\u0439 \u043D\u0435 \u0432\u044B\u0431\u0440\u0430\u043D",
    subtype: L ? layerSubtype(L) : "\u2014",
    typeLabel
  };
}
var NODE_ICONS, NODE_TYPES, KIND_DOT_COLOR;
var init_nodes = __esm({
  "js/event-graph/dock/nodes.js"() {
    init_model();
    init_core();
    init_inputCommit();
    init_playController();
    init_compileNodes();
    NODE_ICONS = {
      [NODE_EVENT]: '<svg class="sm-node-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M6 2l6 7h-4l2 5L4 7h4z"/></svg>',
      [NODE_ANIMATION]: '<svg class="sm-node-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3 8h10M11 5l3 3-3 3"/></svg>',
      [NODE_DELAY]: '<svg class="sm-node-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2" stroke-linecap="round"/></svg>',
      [NODE_LAYER]: '<svg class="sm-node-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M8 2l6 3-6 3-6-3 6-3zM2 8l6 3 6-3M2 11l6 3 6-3"/></svg>',
      [NODE_ACTION]: '<svg class="sm-node-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M3 8h2M11 8h2M5 4l3 4-3 4M11 4l-3 4 3 4"/></svg>',
      [NODE_START]: '<svg class="sm-node-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M5 3l8 5-8 5V3z"/></svg>',
      // IA-NODE: тот же символ что у IA-слоя в layer-list (плоская рамка с
      // линиями внутри — «контейнер с собственной анимацией»).
      [NODE_INTERACTIVE_ANIMATION]: '<svg class="sm-node-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M5 7h6M5 10h4" stroke-linecap="round"/></svg>'
    };
    NODE_TYPES = {
      [NODE_EVENT]: {
        typeLabel: "\u0421\u043E\u0431\u044B\u0442\u0438\u0435",
        layoutColumn: 0,
        sockets: [
          { name: "onClick", dir: "output", dataType: "trigger", label: "\u041F\u0440\u0438 \u043A\u043B\u0438\u043A\u0435" }
        ],
        template: {
          title: (n) => n.label,
          // Hdr уже показывает «Событие» — чтобы не дублировать, subtitle даёт
          // instance-специфичную часть. Для layer-source — тип слоя + «клик».
          // Для trigger-source (MS3a) — слово «триггер».
          subtitle: (n) => n.sourceType === "trigger" ? "\u0442\u0440\u0438\u0433\u0433\u0435\u0440" : (n.subtype || "\u2014") + " \xB7 \u043A\u043B\u0438\u043A"
        },
        defaults(deps) {
          return {
            kind: NODE_EVENT,
            sourceType: "layer",
            layerId: deps.firstEventSource()?.id || null
          };
        },
        toViewModel(id, spec, deps) {
          const sourceType = spec.sourceType || "layer";
          if (sourceType === "trigger") {
            const triggerName = typeof spec.triggerName === "string" ? spec.triggerName : "";
            return {
              id,
              kind: spec.kind,
              sourceType: "trigger",
              triggerName,
              label: triggerName ? "\u26A1 " + triggerName : "\u2014 \u0442\u0440\u0438\u0433\u0433\u0435\u0440 \u043D\u0435 \u0432\u044B\u0431\u0440\u0430\u043D",
              subtype: null,
              typeLabel: "\u0421\u043E\u0431\u044B\u0442\u0438\u0435"
            };
          }
          const vm = viewModelWithLayer(id, spec, deps, { typeLabel: "\u0421\u043E\u0431\u044B\u0442\u0438\u0435" });
          vm.sourceType = "layer";
          return vm;
        },
        propsFields: [
          // IA-CIRCLE-3 MS3a (2026-05-13): переключатель источника.
          // Виден ТОЛЬКО внутри IA-слоя (там есть L.triggers parent'а). В parent
          // графе редактора превью sourceType всегда 'layer' — переключатель скрыт,
          // чтобы не вводить дизайнера в заблуждение «откуда триггеры если их нет».
          {
            type: "select",
            key: "sourceType",
            label: "\u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A",
            options: [
              { value: "layer", label: "\u041A\u043B\u0438\u043A \u043D\u0430 \u0441\u043B\u043E\u0435" },
              { value: "trigger", label: "\u0422\u0440\u0438\u0433\u0433\u0435\u0440 \u043F\u043E \u0438\u043C\u0435\u043D\u0438" }
            ],
            visibleWhen: () => isInsideInteractiveLayer()
          },
          // layerSelect: видим когда sourceType='layer' (default для legacy).
          {
            type: "layerSelect",
            key: "layerId",
            label: "\u0421\u043B\u043E\u0439-\u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A",
            filter: "eventSource",
            visibleWhen: (n) => (n.sourceType || "layer") === "layer"
          },
          // triggerSelect (MS3a): динамический dropdown с именами из L.triggers
          // parent IA-слоя. Видим когда sourceType='trigger' И внутри IA-слоя.
          {
            type: "triggerSelect",
            key: "triggerName",
            label: "\u0422\u0440\u0438\u0433\u0433\u0435\u0440",
            visibleWhen: (n) => n.sourceType === "trigger" && isInsideInteractiveLayer()
          }
        ],
        propsHint(n) {
          if (n.sourceType === "trigger") {
            return '\u0421\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u0435\u0442 \u043A\u043E\u0433\u0434\u0430 \u0434\u0451\u0440\u0433\u0430\u044E\u0442 \u0442\u0440\u0438\u0433\u0433\u0435\u0440 \u0441 \u044D\u0442\u0438\u043C \u0438\u043C\u0435\u043D\u0435\u043C \u2014 \u0447\u0435\u0440\u0435\u0437 \u0442\u0435\u0441\u0442-\u043F\u0430\u043D\u0435\u043B\u044C \u0432 Play-mode \u0438\u043B\u0438 (\u0432 \u0431\u0443\u0434\u0443\u0449\u0435\u043C) `player.trigger("name")` \u0432 \u043F\u043B\u0435\u0435\u0440\u0435 ok.ru.';
          }
          return "\u041A\u043B\u0438\u043A \u043F\u043E \u044D\u0442\u043E\u043C\u0443 \u0441\u043B\u043E\u044E \u0432 Preview \u2192 \u0441\u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u0446\u0435\u043F\u043E\u0447\u043A\u0430.";
        },
        // Event — корень subgraph'а. Pure compile живёт в `event-graph/compileNodes.js`
        // (Stage 5). compileEventGraph / compileTriggers фильтруют по sourceType
        // на верхнем уровне; сам compile — pure, через NODE_COMPILERS.
        compile: NODE_COMPILERS[NODE_EVENT]
      },
      [NODE_START]: {
        typeLabel: "\u0421\u0442\u0430\u0440\u0442",
        layoutColumn: 0,
        sockets: [
          // Только output — start не имеет триггер-входа. compileStarts
          // в compileGraph.js отдельно собирает Start-ноды как entry points.
          { name: "fire", dir: "output", dataType: "trigger", label: "\u0417\u0430\u043F\u0443\u0441\u043A" }
        ],
        template: {
          title: () => "\u0421\u0442\u0430\u0440\u0442",
          subtitle: () => "\u0430\u0432\u0442\u043E \u043F\u0440\u0438 Preview",
          badge: () => null
        },
        defaults() {
          return { kind: NODE_START };
        },
        toViewModel(id) {
          return { id, kind: NODE_START, label: "\u0421\u0442\u0430\u0440\u0442" };
        },
        propsFields: [],
        propsHint: "\u041F\u0440\u0438 \u0432\u0445\u043E\u0434\u0435 \u0432 Preview \u044D\u0442\u0430 \u043D\u043E\u0434\u0430 \u0444\u0430\u0439\u0440\u0438\u0442\u0441\u044F \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u2014 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u043D\u043E \u0414\u041E \u043F\u0435\u0440\u0432\u043E\u0433\u043E \u043A\u0430\u0434\u0440\u0430. \u0423\u0434\u043E\u0431\u043D\u043E \u0447\u0442\u043E\u0431\u044B \u0441\u0442\u0430\u0440\u0442\u043E\u0432\u0430\u0442\u044C \u0441 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u043E\u0433\u043E Action \u0438 \u043D\u0435 \xAB\u043C\u0435\u043B\u044C\u043A\u0430\u0442\u044C\xBB idle-\u0441\u0446\u0435\u043D\u043E\u0439.",
        // Pure compile — `event-graph/compileNodes.js`.
        compile: NODE_COMPILERS[NODE_START]
      },
      [NODE_ANIMATION]: {
        typeLabel: "\u0410\u043D\u0438\u043C\u0430\u0446\u0438\u044F",
        layoutColumn: 1,
        sockets: [
          // accepts: whitelist kind'ов откуда допустимо соединение. Без него
          // generic isCompatibleEdge разрешит event→layer, animation→animation
          // и прочие пары, которые runtime не умеет развернуть в transitions.
          { name: "trigger", dir: "input", dataType: "trigger", labelVisible: true, accepts: [NODE_EVENT, NODE_START, NODE_ANIMATION, NODE_DELAY, NODE_ACTION], label: "\u0422\u0440\u0438\u0433\u0433\u0435\u0440" },
          // play — output, но визуально слева + зелёный (косметика: метафора
          // «слой как объект-вход» для Animation; data flow по-прежнему
          // Animation→Layer, side/tone — только override позиции/цвета).
          { name: "play", dir: "output", dataType: "trigger", side: "left", tone: "green", labelVisible: true, label: "\u041B\u043E\u0442\u0442\u0438/Sprite" },
          // Стреляет когда play-ветка завершила spec.cycles циклов (Promise.all
          // по всем Layer'ам, до которых дотягивается play). Для loop-режима
          // анимация продолжает крутиться — cycles влияет ТОЛЬКО на момент done.
          { name: "done", dir: "output", dataType: "trigger", labelVisible: true, label: "\u041A\u043E\u043D\u0435\u0446" }
        ],
        template: {
          // Body с режимом — одна строка вместо compact, чтобы два output-сокета
          // (play, done) не слипались на одной линии. Вертикальный паддинг body
          // задаётся CSS-ом `.sm-node--animation .sm-node-body`.
          title: (n) => n.cycles > 1 ? `${n.mode} \xB7 ${n.cycles} \u0446\u0438\u043A\u043B\u0430` : n.mode,
          subtitle: () => null,
          badge: () => null
        },
        defaults() {
          return { kind: NODE_ANIMATION, mode: "once", cycles: 1 };
        },
        toViewModel(id, spec) {
          const cycles = Number.isInteger(spec.cycles) && spec.cycles >= 1 ? spec.cycles : 1;
          return {
            id,
            kind: NODE_ANIMATION,
            mode: spec.mode === "loop" ? "loop" : "once",
            cycles,
            label: "\u0410\u043D\u0438\u043C\u0430\u0446\u0438\u044F"
          };
        },
        propsFields: [
          {
            type: "select",
            key: "mode",
            label: "\u0420\u0435\u0436\u0438\u043C",
            options: [
              { value: "once", label: "\u0420\u0430\u0437\u043E\u0432\u0430\u044F" },
              { value: "loop", label: "\u0426\u0438\u043A\u043B" }
            ]
          },
          { type: "number", key: "cycles", label: "\u0426\u0438\u043A\u043B\u043E\u0432", min: 1, step: 1 }
        ],
        propsHint: "\u0426\u0438\u043A\u043B\u043E\u0432 \u2014 \u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0440\u0430\u0437 \u043F\u0440\u043E\u0438\u0433\u0440\u0430\u0442\u044C \u043F\u0435\u0440\u0435\u0434 \u0441\u043E\u0431\u044B\u0442\u0438\u0435\u043C \xAB\u041A\u043E\u043D\u0435\u0446\xBB. \u0414\u043B\u044F loop \u0430\u043D\u0438\u043C\u0430\u0446\u0438\u044F \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0430\u0435\u0442 \u043A\u0440\u0443\u0442\u0438\u0442\u044C\u0441\u044F, \xAB\u041A\u043E\u043D\u0435\u0446\xBB \u0441\u0442\u0440\u0435\u043B\u044F\u0435\u0442 \u043E\u0434\u0438\u043D \u0440\u0430\u0437 \u043F\u043E\u0441\u043B\u0435 N \u0446\u0438\u043A\u043B\u043E\u0432.",
        // Pure compile — `event-graph/compileNodes.js`.
        // Animation: play без 'done' — fire-and-forget ctx в play-ветку. С 'done' —
        // сбор layerId'ов через ctx.collectLayer, подписка на layerCycleBus на
        // cycles циклов, done-ветка после Promise.all.
        compile: NODE_COMPILERS[NODE_ANIMATION]
      },
      [NODE_ACTION]: {
        typeLabel: "Action",
        layoutColumn: 1,
        sockets: [
          {
            name: "trigger",
            dir: "input",
            dataType: "trigger",
            accepts: [NODE_EVENT, NODE_START, NODE_ANIMATION, NODE_DELAY, NODE_ACTION],
            label: "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C"
          },
          // done — для последовательностей: Action → Action / Action → Layer.
          // T8 завершит цепочку когда anim доиграет до конца (playMode === 'once'
          // или после первого цикла для loop).
          { name: "done", dir: "output", dataType: "trigger", label: "\u041A\u043E\u043D\u0435\u0446" }
        ],
        template: {
          title: (n) => n.actionName || "\u2014 Action \u043D\u0435 \u0432\u044B\u0431\u0440\u0430\u043D \u2014",
          subtitle: () => null,
          badge: () => null
        },
        defaults() {
          return {
            kind: NODE_ACTION,
            actionId: null,
            mode: "once",
            extrapolation: "hold",
            blending: "replace",
            priority: 0,
            // N3-full: дополнительные Strip-параметры.
            reversed: "",
            // '' = прямое; 'rev' = обратное (re→rs).
            blendIn: 0,
            // sec — fade-in от idle к value на старте.
            blendOut: 0
            // sec — fade-out от value к idle на конце.
          };
        },
        toViewModel(id, spec) {
          const a = spec.actionId ? getAction(spec.actionId) : null;
          return {
            id,
            kind: NODE_ACTION,
            actionId: spec.actionId || null,
            actionName: a?.name || null,
            mode: spec.mode || null,
            extrapolation: spec.extrapolation || "hold",
            blending: spec.blending || "replace",
            priority: Number.isFinite(spec.priority) ? spec.priority : 0,
            reversed: spec.reversed === "rev",
            blendIn: Number.isFinite(spec.blendIn) ? spec.blendIn : 0,
            blendOut: Number.isFinite(spec.blendOut) ? spec.blendOut : 0,
            label: "Action"
          };
        },
        propsFields: [
          { type: "actionSelect", key: "actionId", label: "Action" },
          {
            type: "select",
            key: "mode",
            label: "\u041F\u0440\u043E\u0438\u0433\u0440\u044B\u0432\u0430\u043D\u0438\u0435",
            options: [
              { value: "once", label: "\u041E\u0434\u0438\u043D \u0440\u0430\u0437" },
              { value: "loop", label: "\u041F\u043E\u0432\u0442\u043E\u0440\u044F\u0442\u044C" }
            ]
          },
          {
            type: "select",
            key: "extrapolation",
            label: "\u0412\u043D\u0435 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0430",
            options: [
              { value: "hold", label: "\u0423\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0442\u044C" },
              { value: "nothing", label: "\u0421\u0431\u0440\u0430\u0441\u044B\u0432\u0430\u0442\u044C" }
            ]
          },
          {
            type: "select",
            key: "blending",
            label: "\u0421\u043C\u0435\u0448\u0438\u0432\u0430\u043D\u0438\u0435",
            options: [
              { value: "replace", label: "\u0417\u0430\u043C\u0435\u043D\u044F\u0442\u044C" },
              { value: "add", label: "\u0414\u043E\u0431\u0430\u0432\u043B\u044F\u0442\u044C" }
            ]
          },
          { type: "number", key: "priority", label: "\u041F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442", step: 1 },
          {
            type: "select",
            key: "reversed",
            label: "\u041D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435",
            options: [
              { value: "", label: "\u041F\u0440\u044F\u043C\u043E\u0435" },
              { value: "rev", label: "\u041E\u0431\u0440\u0430\u0442\u043D\u043E\u0435" }
            ]
          },
          { type: "number", key: "blendIn", label: "\u041F\u043B\u0430\u0432\u043D\u044B\u0439 \u0432\u0445\u043E\u0434 (\u0441\u0435\u043A)", min: 0, step: 0.05 },
          { type: "number", key: "blendOut", label: "\u041F\u043B\u0430\u0432\u043D\u044B\u0439 \u0432\u044B\u0445\u043E\u0434 (\u0441\u0435\u043A)", min: 0, step: 0.05 }
        ],
        // Группировка полей по категориям. Action — единственная нода с
        // достаточно полей чтобы их сворачивать; остальные рендерятся плоско.
        propsCategories: [
          { name: "\u041E\u0441\u043D\u043E\u0432\u043D\u043E\u0435", keys: ["actionId", "mode"] },
          { name: "\u041C\u0438\u043A\u0448\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435", keys: ["blending", "priority"] },
          { name: "\u0414\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u043E", keys: ["extrapolation", "reversed", "blendIn", "blendOut"], collapsed: true }
        ],
        propsHint: "\u041F\u0440\u043E\u0438\u0433\u0440\u044B\u0432\u0430\u043D\u0438\u0435 \u2014 \u0438\u0433\u0440\u0430\u0442\u044C \u043E\u0434\u0438\u043D \u0440\u0430\u0437 \u0438\u043B\u0438 \u0437\u0430\u0446\u0438\u043A\u043B\u0438\u0442\u044C. \u0412\u043D\u0435 \u0434\u0438\u0430\u043F\u0430\u0437\u043E\u043D\u0430: \u0443\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0442\u044C \u043A\u0440\u0430\u0439\u043D\u0438\u0439 \u043A\u0430\u0434\u0440 \u0438\u043B\u0438 \u0441\u0431\u0440\u0430\u0441\u044B\u0432\u0430\u0442\u044C \u0432 idle. \u0421\u043C\u0435\u0448\u0438\u0432\u0430\u043D\u0438\u0435: \u0437\u0430\u043C\u0435\u043D\u044F\u0442\u044C idle \u0438\u043B\u0438 \u043F\u0440\u0438\u0431\u0430\u0432\u043B\u044F\u0442\u044C. \u041F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442: \u043F\u0440\u0438 \u043D\u0430\u0441\u043B\u043E\u0435\u043D\u0438\u0438 \u043F\u043E\u0431\u0435\u0436\u0434\u0430\u0435\u0442 \u0432\u044B\u0448\u0435. \u041D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435: \u043E\u0431\u0440\u0430\u0442\u043D\u043E\u0435 \u0438\u0433\u0440\u0430\u0435\u0442 \u0441 \u043A\u043E\u043D\u0446\u0430. \u041F\u043B\u0430\u0432\u043D\u044B\u0439 \u0432\u0445\u043E\u0434/\u0432\u044B\u0445\u043E\u0434: crossfade \u0441 idle \u043D\u0430 \u0433\u0440\u0430\u043D\u0438\u0446\u0430\u0445.",
        // Pure compile — `event-graph/compileNodes.js`. Запускает Action по id
        // через api.playAction; default mode 'once' для event-цепочек.
        compile: NODE_COMPILERS[NODE_ACTION]
      },
      [NODE_LAYER]: {
        typeLabel: "\u0421\u043B\u043E\u0439",
        layoutColumn: 3,
        sockets: [
          // play — input, но визуально справа + зелёный (косметика: парный с
          // Animation.play.left — чтобы связь Animation→Layer выглядела как
          // «layer-link», а не обычный trigger).
          { name: "play", dir: "input", dataType: "trigger", side: "right", tone: "green", accepts: [NODE_START, NODE_ANIMATION, NODE_DELAY, NODE_ACTION], label: "\u0418\u0433\u0440\u0430\u0442\u044C" }
        ],
        template: {
          title: (n) => n.label,
          subtitle: (n) => n.subtype || "\u2014"
        },
        defaults(deps) {
          return { kind: NODE_LAYER, layerId: deps.firstPlayable()?.id || null };
        },
        toViewModel(id, spec, deps) {
          return viewModelWithLayer(id, spec, deps, { typeLabel: "\u0421\u043B\u043E\u0439" });
        },
        propsFields: [
          { type: "layerSelect", key: "layerId", label: "\u0410\u043D\u0438\u043C\u0438\u0440\u0443\u0435\u043C\u044B\u0439 \u0441\u043B\u043E\u0439", filter: "playable" }
        ],
        propsHint(n) {
          return n.layerId ? null : "\u0412\u044B\u0431\u0435\u0440\u0438 Lottie \u0438\u043B\u0438 PNG \u0441\u043E \u0441\u043F\u0440\u0430\u0439\u0442\u043E\u043C.";
        },
        // Pure compile — `event-graph/compileNodes.js`. Терминал: вызывает
        // playByLayerId(ctx.mode); если Animation 'done' собирает layerId'ы — Layer
        // регистрируется через ctx.collectLayer.
        compile: NODE_COMPILERS[NODE_LAYER]
      },
      // IA-NODE-IN-PARENT-GRAPH (2026-05-13). Нода-приёмник триггеров interactive-
      // animation слоя. Динамические input-сокеты по `L.triggers` выбранного слоя
      // (через `getSockets`). Compile отправляет `ia-trigger` postMessage в
      // iframe выбранного слоя (через `api.routeIaTrigger`). Out-сокетов нет
      // (out-события из IA наружу — решим в Кругу 4+).
      [NODE_INTERACTIVE_ANIMATION]: {
        typeLabel: "IA-\u0441\u043B\u043E\u0439",
        // Колонка 3 как NODE_LAYER — IA-нода тоже terminal (sink), её удобно
        // помещать в правую крайнюю колонку графа. Layer и IA-нода в одной
        // колонке: разные kind'ы (разные akcent header'а + иконка), но
        // одинаковая «семантика конца цепочки» → одинаковая X-координата.
        layoutColumn: 3,
        // Статические сокеты пусто — реальные считаются динамически от
        // triggers выбранного IA-ассета. См. getSockets.
        sockets: (
          /** @type {import('./model.js').SocketSpec[]} */
          []
        ),
        /**
         * @param {import('../../core/index.js').EventGraphNode} spec
         * @param {{ layerById?: Map<string, import('../../core/index.js').Layer> }} [deps]
         * @returns {import('./model.js').SocketSpec[]}
         */
        getSockets(spec, deps) {
          const layerId = spec && /** @type {any} */
          spec.layerId;
          if (!layerId) return [];
          const L = deps && deps.layerById && deps.layerById.get(layerId) ? deps.layerById.get(layerId) : getLayerByIdAnywhere(layerId);
          const triggers = _readIaTriggers(L);
          if (triggers.length === 0) return [];
          const out = triggers.map((name) => (
            /** @type {import('./model.js').SocketSpec} */
            {
              name,
              dir: "input",
              dataType: "trigger",
              labelVisible: true,
              accepts: [NODE_EVENT, NODE_START, NODE_ANIMATION, NODE_DELAY, NODE_ACTION],
              label: name
            }
          ));
          return out;
        },
        template: {
          title: (n) => n.label,
          // Subtitle — слово «триггеры» (количество видно по сокетам справа).
          subtitle: () => "\u0442\u0440\u0438\u0433\u0433\u0435\u0440\u044B"
        },
        defaults() {
          return { kind: NODE_INTERACTIVE_ANIMATION, layerId: null };
        },
        toViewModel(id, spec, deps) {
          const L = spec.layerId ? deps.layerById.get(spec.layerId) : null;
          return {
            id,
            kind: spec.kind,
            layerId: spec.layerId || null,
            label: L ? L.name || L.id : "\u2014 IA-\u0441\u043B\u043E\u0439 \u043D\u0435 \u0432\u044B\u0431\u0440\u0430\u043D",
            subtype: L ? "\u0418\u043D\u0442\u0435\u0440\u0430\u043A\u0442\u0438\u0432\u043D\u0430\u044F" : "\u2014",
            typeLabel: "IA-\u0441\u043B\u043E\u0439"
          };
        },
        propsFields: [
          { type: "layerSelect", key: "layerId", label: "IA-\u0441\u043B\u043E\u0439", filter: "interactiveAnimation" },
          // Test-кнопки для удобства проверки в Play-mode: те же триггеры что
          // в floating iaTestPanel, только привязаны к выбранной IA-ноде.
          // Видны при выбранном слое и наличии триггеров; срабатывают через
          // postToPreview (нужен запущенный Preview). Скрываются если триггеров
          // нет.
          {
            type: "iaTestButtons",
            key: "layerId",
            label: "\u041F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u0442\u0440\u0438\u0433\u0433\u0435\u0440\u043E\u0432",
            visibleWhen: (n) => !!n.layerId
          }
        ],
        propsHint(n) {
          if (!n.layerId) return "\u0412\u044B\u0431\u0435\u0440\u0438 IA-\u0441\u043B\u043E\u0439 \u2014 \u043D\u0430 \u043D\u043E\u0434\u0435 \u043F\u043E\u044F\u0432\u044F\u0442\u0441\u044F \u0441\u043E\u043A\u0435\u0442\u044B \u043F\u043E \u0435\u0433\u043E \u0442\u0440\u0438\u0433\u0433\u0435\u0440\u0430\u043C.";
          return "\u0422\u0440\u0438\u0433\u0433\u0435\u0440\u044B \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0433\u043E \u0441\u043B\u043E\u044F \u2014 \u044D\u0442\u043E \u0432\u0445\u043E\u0434\u044B \u043D\u043E\u0434\u044B. \u0421\u043E\u0435\u0434\u0438\u043D\u0438 Event-\u043D\u043E\u0434\u0430 / Action / \u0410\u043D\u0438\u043C\u0430\u0446\u0438\u044F \u0441 \u0441\u043E\u043A\u0435\u0442\u043E\u043C \u2192 \u0432 Play-mode \u0441\u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 trigger \u0432\u043D\u0443\u0442\u0440\u0438 IA.";
        },
        // Pure compile — `event-graph/compileNodes.js`. IA-нода — terminal:
        // routeIaTrigger(spec.layerId, ctx._targetSocket) — имя сокета = имя
        // триггера IA-слоя.
        compile: NODE_COMPILERS[NODE_INTERACTIVE_ANIMATION]
      },
      [NODE_DELAY]: {
        typeLabel: "\u0417\u0430\u0434\u0435\u0440\u0436\u043A\u0430",
        layoutColumn: 2,
        sockets: [
          { name: "trigger", dir: "input", dataType: "trigger", accepts: [NODE_EVENT, NODE_START, NODE_ANIMATION, NODE_DELAY, NODE_ACTION], label: "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C" },
          { name: "done", dir: "output", dataType: "trigger", label: "\u041A\u043E\u043D\u0435\u0446" }
        ],
        template: {
          // Body показывает ms — чтобы нода не была плоским header-pill'ом и
          // высота совпадала с остальными в цепочке.
          title: (n) => `${n.ms} \u043C\u0441`,
          subtitle: () => null,
          badge: () => null
        },
        defaults() {
          return { kind: NODE_DELAY, ms: 500 };
        },
        toViewModel(id, spec) {
          const ms = Number.isFinite(spec.ms) ? Math.max(0, Math.floor(spec.ms)) : 500;
          return { id, kind: NODE_DELAY, ms, label: "\u0417\u0430\u0434\u0435\u0440\u0436\u043A\u0430" };
        },
        propsFields: [
          { type: "number", key: "ms", label: "\u041C\u0438\u043B\u043B\u0438\u0441\u0435\u043A\u0443\u043D\u0434\u044B", min: 0, step: 50 }
        ],
        propsHint: "\u0427\u0435\u0440\u0435\u0437 \u0443\u043A\u0430\u0437\u0430\u043D\u043D\u043E\u0435 \u0432\u0440\u0435\u043C\u044F \u0441\u0440\u0430\u0431\u043E\u0442\u0430\u044E\u0442 \u0432\u0441\u0435 \u0438\u0441\u0445\u043E\u0434\u044F\u0449\u0438\u0435 \u0432\u0435\u0442\u043A\u0438.",
        // Pure compile — `event-graph/compileNodes.js`. setTimeout(ctx.ms) обёртка
        // вокруг детей.
        compile: NODE_COMPILERS[NODE_DELAY]
      }
    };
    KIND_DOT_COLOR = {
      [NODE_EVENT]: "#6490ff",
      [NODE_START]: "#a78bfa",
      [NODE_ANIMATION]: "#a78bfa",
      [NODE_ACTION]: "#ec4899",
      [NODE_DELAY]: "#94a3b8",
      [NODE_LAYER]: "#4ade80",
      // IA-NODE: тот же accent что у `.layer-type-badge--interactive-animation`
      // в editor.css (orange `#fb923c`) — узнаваемо и не сливается с
      // Animation/Layer/Action.
      [NODE_INTERACTIVE_ANIMATION]: "#fb923c"
    };
    setNodeRegistry(
      /** @type {import('./model.js').NodeRegistry} */
      /** @type {unknown} */
      NODE_TYPES
    );
  }
});

// js/event-graph/dock/edges.js
var init_edges = __esm({
  "js/event-graph/dock/edges.js"() {
    init_model();
    init_nodes();
  }
});

// js/event-graph/dock/dock.js
var init_dock = __esm({
  "js/event-graph/dock/dock.js"() {
    init_model();
    init_nodes();
    init_edges();
    init_core();
    init_playController();
    init_core();
  }
});

// js/event-graph/index.js
var init_event_graph = __esm({
  "js/event-graph/index.js"() {
    init_runtime();
    init_compileGraph();
    init_playController();
    init_hintPulse();
    init_layerCycleBus();
    init_dock();
    init_model();
    init_nodes();
    init_edges();
  }
});

// js/dr-runtime/assetLibraryReadOnly.js
function lookupAsset(library, assetId) {
  if (!library || typeof library.get !== "function") return null;
  if (!assetId) return null;
  return library.get(assetId) || null;
}
function findAssetIdByHash(library, hash) {
  if (!library || typeof library.entries !== "function") return null;
  if (!hash) return null;
  for (const [id, rec] of library) {
    if (rec && rec.contentHash === hash) return id;
  }
  return null;
}
function hydrateLibraryFromEntries(entries) {
  const out = /* @__PURE__ */ new Map();
  if (!Array.isArray(entries)) return out;
  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const [id, rec] = entry;
    if (typeof id !== "string" || !id) continue;
    if (!rec || typeof rec !== "object") continue;
    try {
      out.set(id, JSON.parse(JSON.stringify(rec)));
    } catch (_) {
    }
  }
  return out;
}
function serializeLibraryToEntries(library) {
  if (!library || typeof library.entries !== "function") return [];
  const out = [];
  for (const [id, rec] of library) {
    try {
      out.push([id, JSON.parse(JSON.stringify(rec))]);
    } catch (_) {
    }
  }
  return out;
}
function listAllAssets(library) {
  if (!library || typeof library.values !== "function") return [];
  return [...library.values()];
}
var init_assetLibraryReadOnly = __esm({
  "js/dr-runtime/assetLibraryReadOnly.js"() {
  }
});

// js/dr-runtime/deserializeIaSnapshot.js
function _toMap(entries) {
  const m = /* @__PURE__ */ new Map();
  if (!Array.isArray(entries)) return m;
  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const [k, v] = entry;
    if (typeof k !== "string" || !k) continue;
    m.set(k, v);
  }
  return m;
}
function deserializeIaSnapshot(cfg) {
  const src = cfg && typeof cfg === "object" ? cfg : {};
  const rawCanvas = src.canvas || {};
  const cw = rawCanvas.width;
  const ch = rawCanvas.height;
  const validCanvas = Number.isFinite(cw) && Number.isFinite(ch) && cw > 0 && ch > 0;
  const canvas = validCanvas ? { width: cw, height: ch } : { width: 200, height: 200 };
  const layers = [];
  if (Array.isArray(src.layers)) {
    for (const L of src.layers) {
      if (!L || typeof L !== "object") continue;
      try {
        layers.push(JSON.parse(JSON.stringify(L)));
      } catch (_) {
      }
    }
  }
  const rawEg = src.eventGraph || {};
  const eventGraph = {
    nodes: _toMap(rawEg.nodes),
    edges: _toMap(rawEg.edges),
    layout: _toMap(rawEg.layout)
  };
  const actions = _toMap(src.actions);
  const rawMeta = src.meta || {};
  const meta = {
    title: typeof rawMeta.title === "string" ? rawMeta.title : "",
    desc: typeof rawMeta.desc === "string" ? rawMeta.desc : ""
  };
  const library = hydrateLibraryFromEntries(src._assets);
  return { canvas, layers, eventGraph, actions, meta, library };
}
var init_deserializeIaSnapshot = __esm({
  "js/dr-runtime/deserializeIaSnapshot.js"() {
    init_assetLibraryReadOnly();
  }
});

// js/dr-runtime/index.js
var init_index = __esm({
  "js/dr-runtime/index.js"() {
    init_anim_runtime();
    init_event_graph();
    init_event_graph();
    init_event_graph();
    init_core();
    init_deserializeIaSnapshot();
    init_assetLibraryReadOnly();
  }
});
init_index();
export {
  addCycleListener,
  applyCascadeToLayer,
  applyChannelValueTo,
  blendValue,
  cascadeChildResize,
  cascadeTextScale,
  clearCycleListeners,
  compileEventGraph,
  compileStarts,
  compileTriggers,
  createInterpolator,
  createRuntime,
  decomposeMatrixFull,
  decomposeMatrixUniform,
  defaultVisualSize,
  deserializeIaSnapshot,
  dimsOf,
  effectiveMatrix,
  effectiveOpacity,
  escapeHTML,
  findAssetIdByHash,
  fireCycle,
  getAllChannels,
  getChannel,
  getChannelOrNull,
  getChannelsForBlock,
  getChannelsForLayerType,
  getInterpolatedChannels,
  hasIntrinsicContent,
  hydrateLibraryFromEntries,
  isAnimated,
  isMedia,
  isNull,
  isPinned,
  isScalable,
  isSpritePng,
  layerLocalMatrix,
  listAllAssets,
  lookupAsset,
  makeCopyTitle,
  matDeterminant,
  matIdentity,
  matInverse,
  matMultiply,
  num,
  parsePx,
  resolveChannelValue,
  sampleTrack,
  scaleOf,
  serializeLibraryToEntries
};
