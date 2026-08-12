// ========== MAIN — sistema de cores do mapa ==========
// vermelho=parede | amarelo=objeto | azul=porta | verde=item
// branco=interação | roxo=escadas | magenta=cartas

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const mapImg = new Image();
mapImg.src = 'assets/mapa-mansao.jpg';
const collImg = new Image();
collImg.src = 'assets/collision-map.png';
collImg.onload = () => initCollisionMap(collImg);
const ZOOM = 1.8;

let player, enemies = [];
let items = [], interactables = [], storyNotes = [];
let doors = [], objectSolids = [], stairs = [];
let keys = {};
let gameRunning = false;
let frame = 0;
let leverOn = false;
let doorUnlocked = false;
  if (typeof unlockedDoors !== "undefined") unlockedDoors = []; // beco
let chestOpened = false;
let debugCollision = false;
let speechTimer = null;
let letterOpen = false;
let typewriterTimer = null;


function initGame() {
  player = new Player(1100, 900);
  enemies = spawnMapEnemies();
  items = MAP_ITEMS.map(i => ({ ...i, taken: false }));
  interactables = INTERACTABLES.map(o => ({ ...o }));
  storyNotes = STORY_NOTES.map(n => ({ ...n, read: false }));
  doors = DOORS.map(d => ({ ...d }));
  objectSolids = OBJECT_SOLIDS.map(o => ({ ...o }));
  stairs = STAIRS.map(s => ({ ...s }));
  leverOn = false;
  doorUnlocked = false;
  chestOpened = false;
  // sync beco door
  const beco = doors.find(d => d.id === 'beco');
  if (beco) beco.locked = true;
  frame = 0;
  gameRunning = true;
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('gameover-screen').classList.add('hidden');
  showMessage('Mansão... (C = debug do mapa)', 2800);
}

function hitsBox(px, py, rad, box) {
  const nx = Math.max(box.x, Math.min(px, box.x + box.w));
  const ny = Math.max(box.y, Math.min(py, box.y + box.h));
  return (px - nx) ** 2 + (py - ny) ** 2 < rad * rad;
}

function hitsDynamic(px, py, rad) {
  for (const o of objectSolids) {
    if (hitsBox(px, py, rad, o)) return true;
  }
  for (const d of doors) {
    if (d.locked && hitsBox(px, py, rad, d)) return true;
  }
  for (const s of stairs) {
    if (s.locked && hitsBox(px, py, rad, s)) return true;
  }
  return false;
}

window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (!gameRunning) return;
  if (e.key.toLowerCase() === 'c') {
    debugCollision = !debugCollision;
    showMessage(debugCollision ? 'DEBUG mapa (C sai)' : 'Debug off', 1200);
  }
  if (e.key >= '1' && e.key <= '4') player.selectedSlot = parseInt(e.key) - 1;
  if (e.key === 'Escape') { closeLetter(); return; }
  if (e.key.toLowerCase() === 'e') {
    if (letterOpen) { closeLetter(); return; }
    const msg = player.useSelectedItem();
    if (msg) showMessage(msg);
    else interact();
  }
  if (e.key.toLowerCase() === 'f') {
    if (player.hasLantern) {
      player.lanternOn = !player.lanternOn;
      showMessage(player.lanternOn ? 'Lanterna ligada.' : 'Lanterna desligada.');
    } else showMessage('Você não tem lanterna.');
  }
  if (e.key === ' ') attack();
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('click', () => { if (gameRunning) attack(); });



function typewriter(el, fullText, speed, done) {
  clearInterval(typewriterTimer);
  el.textContent = '';
  let i = 0;
  typewriterTimer = setInterval(() => {
    i++;
    el.textContent = fullText.slice(0, i);
    if (i >= fullText.length) {
      clearInterval(typewriterTimer);
      typewriterTimer = null;
      if (done) done();
    }
  }, speed);
}

function showSpeech(text) {
  const bubble = document.getElementById('speech-bubble');
  const st = document.getElementById('speech-text');
  if (!bubble || !st) return;
  letterOpen = false;
  document.getElementById('letter-overlay')?.classList.add('hidden');
  bubble.classList.remove('hidden');
  typewriter(st, text, 28, () => {
    clearTimeout(speechTimer);
    speechTimer = setTimeout(() => bubble.classList.add('hidden'), 3200);
  });
}

function showLetter(text) {
  const ov = document.getElementById('letter-overlay');
  const lt = document.getElementById('letter-text');
  if (!ov || !lt) return;
  document.getElementById('speech-bubble')?.classList.add('hidden');
  letterOpen = true;
  ov.classList.remove('hidden');
  typewriter(lt, text, 22, null);
}

function closeLetter() {
  letterOpen = false;
  clearInterval(typewriterTimer);
  document.getElementById('letter-overlay')?.classList.add('hidden');
  document.getElementById('letter-text').textContent = '';
}

function randomFlavor() {
  if (typeof FLAVOR_LINES === 'undefined' || !FLAVOR_LINES.length)
    return 'Não há nada de especial aqui.';
  return FLAVOR_LINES[Math.floor(Math.random() * FLAVOR_LINES.length)];
}



// prioriza interações num raio (não só 1 pixel do pé)
function nearbyTileType(fx, fy, rad) {
  const priority = ['note', 'item', 'interact', 'door', 'scene', 'stairs'];
  const found = {};
  const step = 4;
  for (let dy = -rad; dy <= rad; dy += step) {
    for (let dx = -rad; dx <= rad; dx += step) {
      if (dx*dx + dy*dy > rad*rad) continue;
      const c = getTileType(fx + dx, fy + dy);
      if (c && c !== 'walk' && c !== 'wall' && c !== 'object') found[c] = true;
    }
  }
  for (const p of priority) if (found[p]) return p;
  return 'walk';
}

function getNearbyPrompt() {
  if (!player) return null;
  const fx = player.x;
  const fy = player.y + player.footOffset;
  const reach = 56;

  for (const item of items) {
    if (item.taken) continue;
    if (Math.hypot(fx - item.x, fy - item.y) < reach)
      return 'Aperte E para pegar ' + item.type;
  }
  for (const n of storyNotes) {
    if (Math.hypot(fx - n.x, fy - n.y) < reach)
      return n.read ? 'Aperte E para ler novamente' : 'Aperte E para ler a carta';
  }
  for (const obj of interactables) {
    if (Math.hypot(fx - obj.x, fy - obj.y) > (obj.r || 48)) continue;
    if (obj.type === 'fogueira') return 'Aperte E para descansar na fogueira';
    if (obj.type === 'janela') return obj.open ? 'Aperte E para fechar a janela' : 'Aperte E para abrir a janela';
    if (obj.type === 'bau') return chestOpened ? 'Baú aberto' : 'Aperte E para abrir o baú';
    if (obj.type === 'alavanca') return obj.on ? 'Aperte E para desligar a alavanca' : 'Aperte E para puxar a alavanca';
  }
  for (const d of doors) {
    if (Math.hypot(fx - (d.x + d.w/2), fy - (d.y + d.h/2)) < 50) {
      if (d.locked) return 'Porta trancada';
      return 'Aperte E para examinar a porta';
    }
  }
  for (const s of stairs) {
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
    if (Math.hypot(fx - cx, fy - cy) < 36) return 'Aperte E para examinar as escadas';
  }
  if (typeof getTileType === 'function') {
    const tt = nearbyTileType(fx, fy, 18);
    if (tt === 'interact') return 'Aperte E para examinar';
    if (tt === 'note') return 'Aperte E para ler a carta';
    if (tt === 'item') return 'Aperte E para pegar';
    if (tt === 'scene') return 'Aperte E para examinar a saída';
    if (tt === 'door') {
      return isDoorUnlocked(fx, fy) ? 'Porta aberta' : 'Aperte E para usar a chave';
    }
  }
  return null;
}

function updatePrompt() {
  const el = document.getElementById('prompt');
  if (!el) return;
  const text = getNearbyPrompt();
  if (text) {
    el.textContent = text;
    el.classList.add('show');
  } else {
    el.classList.remove('show');
  }
}

function interact() {
  if (letterOpen) { closeLetter(); return; }
  const fx = player.x, fy = player.y + player.footOffset;

  // itens verdes
  for (const item of items) {
    if (item.taken) continue;
    if (Math.hypot(fx - item.x, fy - item.y) < 56) {
      if (player.addItem(item.type)) {
        item.taken = true;
        showSpeech('Peguei: ' + item.type + '.');
      } else showSpeech('Inventário cheio.');
      return;
    }
  }

  // cartas magenta → papel
  for (const n of storyNotes) {
    if (Math.hypot(fx - n.x, fy - n.y) < 56) {
      n.read = true;
      showLetter(n.text);
      return;
    }
  }

  // objetos brancos (fogueira, alavanca, baú, janela)
  for (const obj of interactables) {
    if (Math.hypot(fx - obj.x, fy - obj.y) > (obj.r || 48)) continue;
    if (obj.type === 'fogueira') {
      player.heal(100);
      enemies = spawnMapEnemies();
      showSpeech('O calor da fogueira acalma a mente. Sanidade restaurada.');
      return;
    }
    if (obj.type === 'janela') {
      obj.open = !obj.open;
      showSpeech(obj.open
        ? 'Abri a janela. Um vento gelado corta a pele...'
        : 'Fechei a janela. O silêncio volta.');
      if (obj.open) player.takeDamage(10);
      return;
    }
    if (obj.type === 'bau') {
      if (chestOpened) { showSpeech('O baú já está aberto.'); return; }
      if (player.hasItem('chave')) {
        chestOpened = true;
        const idx = player.inventory.indexOf('chave');
        if (idx >= 0) player.inventory[idx] = null;
        player.addItem('cafe');
        showSpeech('A chave girou. Achei um café dentro.');
      } else showSpeech('Trancado. Preciso de uma chave.');
      return;
    }
    if (obj.type === 'alavanca') {
      obj.on = !obj.on;
      leverOn = obj.on;
      doorUnlocked = leverOn;
      const beco = doors.find(d => d.id === 'beco');
      if (beco) beco.locked = !leverOn;
      showSpeech(leverOn
        ? 'A alavanca cedeu. Ouvi algo destrancar no beco.'
        : 'Alavanca desligada.');
      return;
    }
  }

  // portas AZUIS (mapa de cor) — precisam de CHAVE
  if (typeof getTileType === 'function' && nearbyTileType(fx, fy, 22) === 'door') {
    if (isDoorUnlocked(fx, fy)) {
      showSpeech('A porta já está aberta.');
      return;
    }
    if (player.hasItem('chave')) {
      unlockDoorAt(fx, fy);
      const idx = player.inventory.indexOf('chave');
      if (idx >= 0) player.inventory[idx] = null;
      showSpeech('Usei a chave. A porta destrancou.');
    } else {
      showSpeech('Trancada. Preciso de uma chave.');
    }
    return;
  }
  // portas da lista (fallback)
  for (const d of doors) {
    if (Math.hypot(fx - (d.x + d.w / 2), fy - (d.y + d.h / 2)) < 55) {
      if (d.locked && !isDoorUnlocked(d.x + d.w/2, d.y + d.h/2)) {
        if (player.hasItem('chave')) {
          unlockDoorAt(d.x + d.w/2, d.y + d.h/2);
          d.locked = false;
          const idx = player.inventory.indexOf('chave');
          if (idx >= 0) player.inventory[idx] = null;
          showSpeech('Usei a chave. A porta destrancou.');
        } else showSpeech('Trancada. Preciso de uma chave.');
      } else showSpeech('A porta está livre.');
      return;
    }
  }

  // escadas
  for (const s of stairs) {
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
    if (Math.hypot(fx - cx, fy - cy) < 36) {
      showSpeech('Escadas para o segundo andar... ainda não.');
      return;
    }
  }

  // cores do mapa sob o pé
  if (typeof getTileType === 'function') {
    const tt = nearbyTileType(fx, fy, 18);
    if (tt === 'note') {
      showLetter('O papel está ilegível, só resta o medo manchado na tinta.');
      return;
    }
    if (tt === 'interact') {
      showSpeech(randomFlavor());
      return;
    }
    if (tt === 'item') {
      showSpeech('Tem algo aqui... mas já peguei o que havia?');
      return;
    }
    if (tt === 'scene') {
      showSpeech('Uma saída para outro lugar. Ainda não é a hora.');
      return;
    }
    if (tt === 'door') {
      showSpeech('Uma porta.');
      return;
    }
  }
}

function attack() {
  if (player.attackCooldown > 0) return;
  player.attackCooldown = player.hasItem('faca') ? 14 : 22;
  let hit = false;
  for (const e of enemies) {
    if (!e.alive) continue;
    if (Math.hypot(player.x - e.x, player.y - e.y) < player.attackRange + e.size * 0.4) {
      e.takeDamage(player.hasItem('faca') ? 26 : 12);
      hit = true;
    }
  }
  if (hit) showMessage('Acertou!', 500);
}

function getZoneName() {
  for (const z of ZONES) {
    if (player.x >= z.x && player.x <= z.x + z.w && player.y >= z.y && player.y <= z.y + z.h)
      return z.name;
  }
  return 'Mansão';
}

function update() {
  if (!gameRunning) return;
  frame++;
  player.update();
  
  let dx = 0, dy = 0;
  if (keys['w'] || keys['arrowup']) dy = -1;
  if (keys['s'] || keys['arrowdown']) dy = 1;
  if (keys['a'] || keys['arrowleft']) dx = -1;
  if (keys['d'] || keys['arrowright']) dx = 1;

  // Movimento centralizado no Player (sem corrida)
  player.move(dx, dy);

  for (const e of enemies) e.update(player);
  if (!player.lanternOn && frame % 100 === 0) player.sanity = Math.max(0, player.sanity - 1);
  for (const obj of interactables) {
    if (obj.type === 'janela' && obj.open && frame % 45 === 0)
      player.sanity = Math.max(0, player.sanity - 2);
  }
  if (player.sanity <= 0) {
    gameRunning = false;
    document.getElementById('gameover-screen').classList.remove('hidden');
  }
  updateHUD(player, getZoneName());
  updatePrompt();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!player) return;

  // Câmera centrada no jogador
  const camX = player.x - (canvas.width / ZOOM) / 2;
  const camY = player.y - (canvas.height / ZOOM) / 2;
  
  // Limites da câmera
  const maxCamX = MAP_W - (canvas.width / ZOOM);
  const maxCamY = MAP_H - (canvas.height / ZOOM);
  const finalCamX = Math.max(0, Math.min(maxCamX, camX));
  const finalCamY = Math.max(0, Math.min(maxCamY, camY));

  // Desenho do Mundo
  ctx.save();
  ctx.scale(ZOOM, ZOOM);
  ctx.translate(-finalCamX, -finalCamY);

  // Mapa Visual
  if (mapImg.complete) ctx.drawImage(mapImg, 0, 0);

  // Debug de Colisão
  if (debugCollision && collCanvas) {
    ctx.globalAlpha = 0.5;
    ctx.drawImage(collCanvas, 0, 0);
    ctx.globalAlpha = 1;
  }

  // Itens, Notas e Objetos
  for (const it of items) {
    if (it.taken) continue;
    const pulse = 1 + Math.sin(frame * 0.12) * 0.1;
    ctx.beginPath();
    ctx.arc(it.x, it.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,255,80,0.25)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(it.x, it.y, 7 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = '#40e060';
    ctx.fill();
    ctx.font = '12px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0a1a08';
    const icons = { cafe: '☕', faca: '🔪', lanterna: '🔦', chave: '🔑' };
    ctx.fillText(icons[it.type] || '?', it.x, it.y + 1);
  }

  for (const n of storyNotes) {
    ctx.fillStyle = n.read ? '#8060a0' : '#ff40c0';
    ctx.fillRect(n.x - 7, n.y - 5, 14, 10);
  }

  for (const obj of interactables) {
    if (obj.type === 'fogueira') {
      const f = Math.sin(frame * 0.2) * 3;
      ctx.fillStyle = 'rgba(255,120,30,0.6)';
      ctx.beginPath();
      ctx.arc(obj.x, obj.y - 4 + f * 0.2, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    if (obj.type === 'alavanca') {
      ctx.fillStyle = obj.on ? '#3a8a3a' : '#8a3a2a';
      ctx.fillRect(obj.x - 5, obj.y - 9, 10, 18);
      ctx.fillStyle = '#e0b040';
      ctx.fillRect(obj.x - 7, obj.y - (obj.on ? 11 : 1), 14, 4);
    }
    if (obj.type === 'bau') {
      ctx.fillStyle = chestOpened ? '#2a5a2a' : '#5a2a10';
      ctx.fillRect(obj.x - 11, obj.y - 7, 22, 14);
    }
  }

  for (const e of enemies) e.drawWorld(ctx);
  
  // Desenha o Jogador
  player.drawWorld(ctx);
  
  ctx.restore();

  // Efeito de Lanterna / Escuridão (Tela Cheia)
  const screenPX = (player.x - finalCamX) * ZOOM;
  const screenPY = (player.y - finalCamY) * ZOOM;
  const radius = player.vision * ZOOM;

  const grd = ctx.createRadialGradient(screenPX, screenPY, radius * 0.5, screenPX, screenPY, radius);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(0,0,0,0.75)');
  
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.arc(screenPX, screenPY, radius, 0, Math.PI * 2, true);
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fill();
  
  ctx.beginPath();
  ctx.arc(screenPX, screenPY, radius, 0, Math.PI * 2);
  ctx.fillStyle = grd;
  ctx.fill();
  ctx.restore();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

document.getElementById('btn-start').addEventListener('click', initGame);
document.getElementById('btn-restart').addEventListener('click', initGame);
loop();
