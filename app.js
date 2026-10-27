const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const prompts = [
  'Seorang penulis menemukan tokoh ceritanya sedang antre beli seblak. Tokoh itu punya keluhan.',
  'Setiap kali kamu bernyanyi, satu benda di kamarmu berpindah tempat. Hari ini, pintunya hilang.',
  'Ada toko yang menjual keberanian dalam botol kecil. Tapi hari ini, labelnya tertukar.',
  'Kucing tetangga ternyata kritikus seni. Dan dia baru saja melihat coretanmu.',
  'Kamu menerima surat dari dirimu lima tahun lagi. Isinya cuma: “Jangan pilih yang warna kuning.”',
  'Di kota ini, langit berubah warna mengikuti suasana hati seseorang. Hari ini warnanya polkadot.',
  'Seorang tokoh utama memutuskan cuti. Kamu diminta menggantikannya selama satu hari.',
  'Toko buku itu hanya muncul saat hujan. Penjaganya bilang kamu sudah ditunggu sejak bab pertama.'
];
const messages = [
  'Oke, sebenernya nggak ada pengumuman penting. Cuma mau bilang: seneng bisa kenal kamu.',
  'Kamu tuh kayaknya susah kehabisan energi, ya. Aku yang lihat aja kadang ikut semangat.',
  'Kalau nanti bikin cerita baru, aku mau baca. Tapi jangan langsung yang 200 bab, kasih aku pemanasan dulu.',
  'Kalau lagi punya lagu yang diputer terus, rekomendasiin satu dong. Penasaran seleramu kayak apa.',
  'Udah, itu aja. Aku cuma pengin bikin kamu ketawa dikit. Kalau belum ketawa, ya anggap aja ini masih percobaan.'
];
let toastTimer;
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3200);
}
function randomDifferent(items, previous) {
  const choices = items.filter((item) => item !== previous);
  return choices[Math.floor(Math.random() * choices.length)];
}
function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

let lastOpener;
$$('[data-open]').forEach((button) => button.addEventListener('click', () => {
  lastOpener = button;
  const dialog = document.getElementById(button.dataset.open);
  if (dialog.id === 'surprise-dialog') resetSurprise();
  dialog.showModal();
}));
$$('dialog').forEach((dialog) => {
  dialog.querySelector('.close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => {
    if (dialog.id === 'music-dialog') stopBeat();
    lastOpener?.focus({ preventScroll: true });
  });
});

// Keep the draft on this device; no network or account is needed.
const draftKey = 'klub-orang-seru-story-v1';
const promptKey = 'klub-orang-seru-prompt-v1';
let storageAvailable = true;
try {
  $('#story-text').value = localStorage.getItem(draftKey) || '';
  $('#story-prompt').textContent = localStorage.getItem(promptKey) || prompts[0];
} catch {
  storageAvailable = false;
  $('#story-prompt').textContent = prompts[0];
}
function updateDraft() {
  const text = $('#story-text').value;
  $('#word-count').textContent = `${text.trim() ? text.trim().split(/\s+/u).length : 0} kata`;
  try {
    localStorage.setItem(draftKey, text);
    localStorage.setItem(promptKey, $('#story-prompt').textContent);
    storageAvailable = true;
  } catch { storageAvailable = false; }
  $('#save-status').textContent = storageAvailable ? 'Tersimpan di browser ini ✓' : 'Penyimpanan browser tidak tersedia. Unduh ceritamu, ya.';
}
$('#story-text').addEventListener('input', updateDraft);
$('#shuffle-prompt').addEventListener('click', () => {
  $('#story-prompt').textContent = randomDifferent(prompts, $('#story-prompt').textContent);
  updateDraft();
});
$('#download-story').addEventListener('click', () => {
  const text = $('#story-text').value.trim();
  if (!text) { toast('Tulis sedikit dulu. Satu kalimat juga boleh.'); $('#story-text').focus(); return; }
  download(new Blob([`CERITA VERSI AKU\n\nPemantik: ${$('#story-prompt').textContent}\n\n${text}\n`], { type: 'text/plain;charset=utf-8' }), 'cerita-versi-aku.txt');
  toast('Ceritanya siap disimpan.');
});
let clearStoryPending = false;
let clearStoryTimer;
$('#clear-story').addEventListener('click', () => {
  if (!$('#story-text').value) return;
  if (!clearStoryPending) {
    clearStoryPending = true;
    $('#clear-story').textContent = 'Yakin? Klik lagi untuk hapus';
    clearStoryTimer = setTimeout(() => { clearStoryPending = false; $('#clear-story').textContent = 'Bersihkan halaman'; }, 4000);
    return;
  }
  clearTimeout(clearStoryTimer);
  clearStoryPending = false;
  $('#story-text').value = '';
  $('#clear-story').textContent = 'Bersihkan halaman';
  updateDraft();
});
updateDraft();

// Record strokes as vectors so undo does not require huge bitmap snapshots.
const canvas = $('#drawing-canvas');
const context = canvas.getContext('2d');
let strokes = [];
let currentStroke = null;
let activePointer = null;
let color = '#292923';
function pointFrom(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height };
}
function renderDrawing() {
  context.fillStyle = '#fffdf7';
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (const stroke of strokes) {
    context.strokeStyle = stroke.color;
    context.fillStyle = stroke.color;
    context.lineWidth = stroke.size;
    context.lineJoin = context.lineCap = 'round';
    context.beginPath();
    if (stroke.points.length === 1) {
      const point = stroke.points[0];
      context.arc(point.x, point.y, stroke.size / 2, 0, Math.PI * 2);
      context.fill();
    } else {
      context.moveTo(stroke.points[0].x, stroke.points[0].y);
      stroke.points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      context.stroke();
    }
  }
  $('#undo-drawing').disabled = strokes.length === 0;
  $('#clear-drawing').disabled = strokes.length === 0;
}
canvas.addEventListener('pointerdown', (event) => {
  if (activePointer !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
  event.preventDefault();
  activePointer = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
  currentStroke = { color, size: Number($('#brush-size').value) * 2, points: [pointFrom(event)] };
  strokes.push(currentStroke);
  renderDrawing();
});
canvas.addEventListener('pointermove', (event) => {
  if (event.pointerId !== activePointer || !currentStroke) return;
  currentStroke.points.push(pointFrom(event));
  renderDrawing();
});
function endStroke(event) {
  if (event.pointerId === activePointer) { activePointer = null; currentStroke = null; }
}
canvas.addEventListener('pointerup', endStroke);
canvas.addEventListener('pointercancel', endStroke);
canvas.addEventListener('lostpointercapture', endStroke);
$$('[data-color]').forEach((button) => button.addEventListener('click', () => {
  color = button.dataset.color;
  $$('[data-color]').forEach((swatch) => { swatch.classList.toggle('active', swatch === button); swatch.setAttribute('aria-pressed', String(swatch === button)); });
}));
$('#undo-drawing').addEventListener('click', () => { strokes.pop(); renderDrawing(); });
$('#clear-drawing').addEventListener('click', () => { strokes = []; renderDrawing(); });
$('#download-drawing').addEventListener('click', () => canvas.toBlob((blob) => {
  if (!blob) { toast('Gambarnya belum bisa disimpan. Coba lagi, ya.'); return; }
  download(blob, 'mahakarya-iseng.png');
  toast('Gambarnya siap disimpan.');
}));
renderDrawing();

// Sound is synthesized only after a user gesture. No microphone is requested.
let audioContext;
let masterGain;
let beatTimer;
let beatStep = 0;
const frequencies = [261.63, 293.66, 329.63, 349.23, 392, 440, 493.88, 523.25];
async function ensureAudio() {
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  if (!AudioEngine) { toast('Browser ini belum mendukung audio. Coba browser lain, ya.'); return false; }
  try {
    if (!audioContext) {
      audioContext = new AudioEngine();
      masterGain = audioContext.createGain();
      masterGain.connect(audioContext.destination);
    }
    masterGain.gain.value = Number($('#music-volume').value) / 100;
    if (audioContext.state === 'suspended') await audioContext.resume();
    return true;
  } catch { toast('Audio belum bisa diputar. Coba klik nadanya lagi.'); return false; }
}
function tone(frequency, duration = .45, type = 'sine', loudness = .45) {
  const start = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(loudness, start + .012);
  gain.gain.exponentialRampToValueAtTime(.001, start + duration);
  oscillator.connect(gain);
  gain.connect(masterGain);
  oscillator.start(start);
  oscillator.stop(start + duration + .03);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}
async function playNote(index) {
  if (!await ensureAudio()) return;
  if (!$('#music-dialog').open) return;
  tone(frequencies[index]);
  const button = $(`[data-note="${index}"]`);
  button.classList.add('active');
  setTimeout(() => button.classList.remove('active'), 180);
  $('#music-status').textContent = ['Do.', 'Re.', 'Mi.', 'Fa.', 'Sol.', 'La.', 'Si.', 'Do tinggi.'][index];
}
$$('[data-note]').forEach((button) => button.addEventListener('click', () => playNote(Number(button.dataset.note))));
document.addEventListener('keydown', (event) => {
  if ($('#music-dialog').open && /^[1-8]$/.test(event.key) && !event.repeat && !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault(); playNote(Number(event.key) - 1);
  }
});
$('#music-volume').addEventListener('input', () => {
  if (masterGain) masterGain.gain.setTargetAtTime(Number($('#music-volume').value) / 100, audioContext.currentTime, .02);
});
function stopBeat() {
  clearInterval(beatTimer);
  beatTimer = undefined;
  $('#toggle-beat').textContent = '▶ Tambahin irama';
  $('#toggle-beat').setAttribute('aria-pressed', 'false');
  $('.music-inner').classList.remove('playing');
}
$('#toggle-beat').addEventListener('click', async () => {
  if (beatTimer) { stopBeat(); return; }
  if (!await ensureAudio() || !$('#music-dialog').open) return;
  beatStep = 0;
  const beat = () => { tone(beatStep % 4 === 0 ? 100 : 180, .13, 'triangle', .55); if (beatStep % 2 === 1) tone(1100, .035, 'sine', .10); beatStep += 1; };
  beat();
  beatTimer = setInterval(beat, 375);
  $('#toggle-beat').textContent = '■ Cukup iramanya';
  $('#toggle-beat').setAttribute('aria-pressed', 'true');
  $('.music-inner').classList.add('playing');
});
document.addEventListener('visibilitychange', () => { if (document.hidden) stopBeat(); });

let dodgeCount = 0;
let lastMessage = '';
let surpriseOpened = false;
function resetSurprise() {
  dodgeCount = 0;
  surpriseOpened = false;
  $('#surprise-title').innerHTML = 'Yakin mau <em>dibuka?</em>';
  $('#surprise-intro').textContent = 'Katanya penasaran. Coba tangkap tombolnya dulu.';
  $('#prank-area').hidden = false;
  $('#revealed-letter').hidden = true;
  $('#skip-prank').hidden = false;
  $('#another-surprise').hidden = true;
  $('#catch-surprise').removeAttribute('style');
  $('#catch-surprise').textContent = 'Buka amplopnya ✉';
}
function dodge() {
  if (dodgeCount >= 3 || surpriseOpened) return false;
  dodgeCount += 1;
  const area = $('#prank-area');
  const button = $('#catch-surprise');
  const maxX = Math.max(0, area.clientWidth - button.offsetWidth - 12);
  const maxY = Math.max(0, area.clientHeight - button.offsetHeight - 12);
  button.style.left = `${6 + (dodgeCount % 2 ? maxX : 0)}px`;
  button.style.top = `${6 + (dodgeCount % 2 ? 0 : maxY)}px`;
  button.textContent = ['Eits, ke sini dulu →', 'Hehe, belum kena!', 'Oke oke, aku diam 😌'][dodgeCount - 1];
  $('#surprise-intro').textContent = dodgeCount === 3 ? 'Oke, jahilnya selesai. Sekarang beneran bisa dibuka.' : 'Tombolnya lagi banyak energi. Mirip siapa, ya?';
  return true;
}
$('#catch-surprise').addEventListener('pointerenter', (event) => {
  if (event.pointerType === 'mouse' && !matchMedia('(prefers-reduced-motion: reduce)').matches) dodge();
});
$('#catch-surprise').addEventListener('click', (event) => {
  if (event.detail > 0 && !matchMedia('(hover: hover)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches && dodge()) return;
  revealSurprise();
});
function revealSurprise() {
  surpriseOpened = true;
  lastMessage = randomDifferent(messages, lastMessage);
  $('#surprise-message').textContent = lastMessage;
  $('#surprise-title').innerHTML = 'Ternyata, <em>cuma ini.</em>';
  $('#surprise-intro').textContent = 'Udah heboh ngejar tombol, isinya cuma begini.';
  $('#prank-area').hidden = true;
  $('#revealed-letter').hidden = false;
  $('#skip-prank').hidden = true;
  $('#another-surprise').hidden = false;
  $('#another-surprise').focus({ preventScroll: true });
  confetti();
}
$('#skip-prank').addEventListener('click', revealSurprise);
$('#another-surprise').addEventListener('click', revealSurprise);
function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  $('#confetti').replaceChildren();
  for (let index = 0; index < 45; index += 1) {
    const piece = document.createElement('i');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = ['#e67452', '#f3cf50', '#78856c', '#9a84b5'][index % 4];
    piece.style.setProperty('--drift', `${Math.random() * 180 - 90}px`);
    piece.style.animationDelay = `${Math.random() * .5}s`;
    $('#confetti').append(piece);
  }
  setTimeout(() => $('#confetti').replaceChildren(), 3300);
}
