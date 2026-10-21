// Popup logic. All network calls are executed inside the active YouTube Studio tab (MAIN world)
// so they use the page's own session + ytcfg, exactly like the Claim overview page does.

// ---------- functions injected into the page (must be self-contained: no outer references) ----------

// Each injected function carries its own copy of the API helper: the page's Trusted Types CSP
// forbids eval/new Function, so helpers cannot be installed into the page once and reused.

async function pageInfo() {
  const m = location.pathname.match(/\/video\/([A-Za-z0-9_-]{11})/);
  const c = location.pathname.match(/\/channel\/(UC[A-Za-z0-9_-]+)/);
  return {
    videoId: m ? m[1] : null,
    channelId: (c && c[1]) || (window.ytcfg && window.ytcfg.get('CHANNEL_ID')) || null,
    ok: !!(window.ytcfg && window.ytcfg.get('INNERTUBE_CONTEXT')),
  };
}

async function pageListClaims(videoId) {
  async function api(endpoint, body) {
    const ORIGIN = 'https://studio.youtube.com';
    const m = document.cookie.match(/(?:^|;\s*)SAPISID=([^;]+)/);
    if (!m) throw new Error('SAPISID cookie not found – sign in to Studio');
    const ts = Math.floor(Date.now() / 1000);
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`${ts} ${m[1]} ${ORIGIN}`));
    const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    const ctx = window.ytcfg && window.ytcfg.get('INNERTUBE_CONTEXT');
    if (!ctx) throw new Error('ytcfg not available – is this a YouTube Studio tab?');
    const headers = { 'Content-Type': 'application/json', 'Authorization': `SAPISIDHASH ${ts}_${hex}`, 'X-Origin': ORIGIN };
    const idx = window.ytcfg.get('SESSION_INDEX');
    if (idx !== undefined && idx !== null) headers['X-Goog-AuthUser'] = String(idx);
    const r = await fetch(`${ORIGIN}/youtubei/v1/creator/${endpoint}?alt=json`, {
      method: 'POST', credentials: 'same-origin', headers, body: JSON.stringify({ context: ctx, ...body }),
    });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(`${endpoint}: HTTP ${r.status} ${j.error ? j.error.message : ''}`);
    return j;
  }
  const j = await api('list_creator_received_claims', {
    videoId, criticalRead: false, includeLicensingOptions: false, pageSize: 500,
  });
  const owners = {};
  (j.contentOwners || []).forEach(o => { owners[o.contentOwnerId] = o.displayName; });
  // return only what we need (keeps the serialized result small)
  return {
    owners,
    claims: (j.receivedClaims || []).map(c => ({
      type: c.type || '',
      owners: c.contentOwnerIds || [],
      md: (c.asset && c.asset.metadata) || {},
      match: c.matchDetails || null,
    })),
  };
}

async function pageListVideos(channelId, pageToken) {
  const body = {
    channelId, pageSize: 50,
    mask: { videoId: true, title: true, lengthSeconds: true },
    order: 'VIDEO_ORDER_DISPLAY_TIME_DESC',
  };
  if (pageToken) body.pageToken = pageToken;
  async function api(endpoint, body) {
    const ORIGIN = 'https://studio.youtube.com';
    const m = document.cookie.match(/(?:^|;\s*)SAPISID=([^;]+)/);
    if (!m) throw new Error('SAPISID cookie not found – sign in to Studio');
    const ts = Math.floor(Date.now() / 1000);
    const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`${ts} ${m[1]} ${ORIGIN}`));
    const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    const ctx = window.ytcfg && window.ytcfg.get('INNERTUBE_CONTEXT');
    if (!ctx) throw new Error('ytcfg not available – is this a YouTube Studio tab?');
    const headers = { 'Content-Type': 'application/json', 'Authorization': `SAPISIDHASH ${ts}_${hex}`, 'X-Origin': ORIGIN };
    const idx = window.ytcfg.get('SESSION_INDEX');
    if (idx !== undefined && idx !== null) headers['X-Goog-AuthUser'] = String(idx);
    const r = await fetch(`${ORIGIN}/youtubei/v1/creator/${endpoint}?alt=json`, {
      method: 'POST', credentials: 'same-origin', headers, body: JSON.stringify({ context: ctx, ...body }),
    });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(`${endpoint}: HTTP ${r.status} ${j.error ? j.error.message : ''}`);
    return j;
  }
  const j = await api('list_creator_videos', body);
  return {
    videos: (j.videos || []).map(v => ({ videoId: v.videoId, title: v.title || '', lengthSeconds: Number(v.lengthSeconds || 0) })),
    next: j.nextPageToken || null,
  };
}

// ---------- popup side ----------

const $ = id => document.getElementById(id);
const out = $('out'), status = $('status');
const setStatus = (t, err) => { status.textContent = t; status.className = err ? 'err' : ''; };
const busy = on => { $('this').disabled = $('all').disabled = on; };

let tabId = null;

async function getStudioTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https:\/\/studio\.youtube\.com\//.test(tab.url || '')) {
    throw new Error('Active tab is not YouTube Studio. Open studio.youtube.com in this window, then click the extension.');
  }
  return tab.id;
}

async function run(func, args = []) {
  const [res] = await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func, args });
  if (!res) throw new Error('No result from page');
  return res.result;
}

async function init() {
  tabId = await getStudioTab();
  const info = await run(pageInfo);
  if (!info.ok) throw new Error('ytcfg missing – reload the Studio tab');
  return info;
}

// ---------- formatting ----------

function fmt(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return (h ? `${h}:` : '') + `${mm}:${String(s).padStart(2, '0')}`;
}

// Publishers / collecting societies / rights admins – never an "artist".
const PUBLISHER_RE = /publish|latinautor|umpg|umpi|sony|warner|kobalt|teosto|tono|stef|pedl|wcm|amra|solar music|audiam|concord|downtown|hexacorp|broma|merlin|uniao brasileira|união brasileira|umg|believe|orchard|fuga|cd baby|distrokid|the orchard|rights|music services|sacem|gema|prs|ascap|bmi|socan|jasrac|apra|buma|sabam|stim|koda|zaiks|rao|\bcs\b/i;
const looksLikePublisher = s => PUBLISHER_RE.test(s) || /_/.test(s);

function assetInfo(c, owners) {
  const md = c.md || {};
  const rec = md.soundRecording || md.musicVideo || md.composition || md.webVideo || md.movie || md.episode || {};
  let title = rec.title || rec.name || '(untitled)';
  if (/metadata is hidden/i.test(title)) title = '(hidden track)';
  let artist = (rec.artists || []).filter(a => !looksLikePublisher(a)).join(', ');
  // No performer in the claim (typical for composition/publisher claims): leave artist empty
  // rather than listing labels or publishers.
  return { title, artist };
}

function buildLines(data, opts) {
  const rows = data.claims
    .filter(c => c.match && c.match.longestMatchStartTimeSeconds !== undefined)
    .map(c => {
      const start = Number(c.match.longestMatchStartTimeSeconds);
      const dur = Number(c.match.longestMatchDurationSeconds || 0);
      const { title, artist } = assetInfo(c, data.owners);
      return { start, end: start + dur, title, artist, type: c.type };
    })
    .filter(r => !opts.audioOnly || !r.type || /AUDIO|MUSIC|COMPOSITION/.test(r.type))
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const dedup = [];
  for (const r of rows) {
    const prev = dedup[dedup.length - 1];
    if (prev && prev.title.toLowerCase() === r.title.toLowerCase() && r.start <= prev.end + opts.mergeGap) {
      prev.end = Math.max(prev.end, r.end);
      if (!prev.artist && r.artist) prev.artist = r.artist;
      continue;
    }
    dedup.push({ ...r });
  }
  return dedup.map(r => opts.compact
    ? `${fmt(r.start)} ${r.title}${r.artist ? ' - ' + r.artist : ''}`
    : `${fmt(r.start)} – ${fmt(r.end)} - ${r.title}${r.artist ? ' - ' + r.artist : ''}`);
}

// Join lines; in compact mode cut at the last whole line that fits the limit.
function joinLimited(lines, opts) {
  let text = lines.join('\n');
  if (!opts.compact || text.length <= opts.limit) return { text, cut: 0 };
  let kept = 0, len = 0;
  for (const l of lines) {
    const add = (kept ? 1 : 0) + l.length;
    if (len + add > opts.limit) break;
    len += add; kept++;
  }
  return { text: lines.slice(0, kept).join('\n'), cut: lines.length - kept };
}

const opts = () => ({
  audioOnly: $('audio').checked,
  mergeGap: Number($('gap').value) || 0,
  compact: $('compact').checked,
  limit: Number($('limit').value) || 5000,
});

// ---------- actions ----------

$('this').onclick = async () => {
  busy(true); out.value = ''; setStatus('fetching claims…');
  try {
    const info = await init();
    if (!info.videoId) throw new Error('Not on a video page. Open the video in Studio (…/video/<id>/…) first.');
    const data = await run(pageListClaims, [info.videoId]);
    const lines = buildLines(data, opts());
    out.value = lines.join('\n');
    setStatus(`${data.claims.length} claims → ${lines.length} lines (video ${info.videoId})`);
  } catch (e) { setStatus('Error: ' + e.message, true); }
  busy(false);
};

$('all').onclick = async () => {
  busy(true); out.value = ''; setStatus('listing videos…');
  try {
    const info = await init();
    if (!info.channelId) throw new Error('Channel ID not found – open the channel dashboard/content page and retry.');
    let re = null;
    const f = $('filter').value.trim();
    if (f) re = new RegExp(f, 'i');

    const videos = [];
    let token = null;
    do {
      const page = await run(pageListVideos, [info.channelId, token]);
      page.videos.forEach(v => { if (!re || re.test(v.title)) videos.push(v); });
      token = page.next;
      setStatus(`listed ${videos.length} matching videos…`);
    } while (token);

    const chunks = [];
    let i = 0;
    for (const v of videos) {
      i++;
      setStatus(`${i}/${videos.length}: ${v.title}`);
      try {
        const data = await run(pageListClaims, [v.videoId]);
        const lines = buildLines(data, opts());
        chunks.push(`### ${v.title}\nhttps://www.youtube.com/watch?v=${v.videoId}  (${fmt(v.lengthSeconds)}, ${data.claims.length} claims)\n\n${lines.join('\n') || '(no claims with timings)'}\n`);
      } catch (e) {
        chunks.push(`### ${v.title}\nhttps://www.youtube.com/watch?v=${v.videoId}\nError: ${e.message}\n`);
      }
      out.value = chunks.join('\n');
      out.scrollTop = out.scrollHeight;
      await new Promise(r => setTimeout(r, 400));
    }
    setStatus(`done: ${videos.length} videos`);
  } catch (e) { setStatus('Error: ' + e.message, true); }
  busy(false);
};

$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText(out.value); setStatus('copied to clipboard'); }
  catch (e) { out.select(); document.execCommand('copy'); setStatus('copied (fallback)'); }
};

$('dl').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([out.value], { type: 'text/plain;charset=utf-8' }));
  a.download = 'tracklist.txt';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
