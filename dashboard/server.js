const express      = require('express');
const fs           = require('fs').promises;
const fsSync       = require('fs');
const path         = require('path');
const os           = require('os');
const crypto       = require('crypto');
const { exec, spawn } = require('child_process');
const nodemailer   = require('nodemailer');
const { ImapFlow } = require('imapflow');
const cron         = require('node-cron');
const jwt          = require('jsonwebtoken');
const bcrypt       = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const cookieParser = require('cookie-parser');
const multer       = require('multer');
const pdfParse     = require('pdf-parse');
const mammoth      = require('mammoth');

const app  = express();
const PORT = 3000;

// ─── Directorios ──────────────────────────────────────────────────────────────
const HOME          = os.homedir();
const OPENCLAW_HOME = path.join(HOME, '.openclaw');   // para openclaw CLI
const DATA_DIR      = path.join(__dirname, 'data');
const HOTELS_DIR    = path.join(DATA_DIR, 'hotels');
const ADMIN_FILE    = path.join(DATA_DIR, 'admin.json');
const LOG_PATH      = path.join(os.tmpdir(), 'hotelclaw-gateway.log');

let JWT_SECRET = 'hotelclaw-fallback-secret-change-me';

// ─── Helpers de ruta por hotel ────────────────────────────────────────────────
function hotelDir(hotelId) {
  return path.join(HOTELS_DIR, hotelId);
}
function hotelPath(hotelId, ...segs) {
  return path.join(hotelDir(hotelId), ...segs);
}

// ─── Bootstrap admin ─────────────────────────────────────────────────────────
async function getOrCreateAdminCredentials() {
  try {
    const admin = JSON.parse(await fs.readFile(ADMIN_FILE, 'utf-8'));
    if (admin.jwtSecret) JWT_SECRET = admin.jwtSecret;
    return admin;
  } catch {
    const admin = {
      email: 'admin@hotelclaw.ai',
      passwordHash: await bcrypt.hash('hotelclaw2026', 10),
      jwtSecret: crypto.randomBytes(32).toString('hex'),
      createdAt: new Date().toISOString(),
    };
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(ADMIN_FILE, JSON.stringify(admin, null, 2));
    JWT_SECRET = admin.jwtSecret;
    console.log('\n[Auth] ✅ Super admin creado:');
    console.log(`  Email:    ${admin.email}`);
    console.log(`  Password: hotelclaw2026`);
    console.log('  ⚠️  Cambia la contraseña en /admin\n');
    return admin;
  }
}

// ─── Estado multi-tenant (Maps por hotelId) ───────────────────────────────────
const autoresponderJobs = new Map();  // hotelId → CronJob
const outreachJobs      = new Map();  // hotelId → CronJob
const adminBots         = new Map();  // hotelId → { running, offset, sessions, intervalId }
const processedMsgIds   = new Map();  // hotelId → Set<string>

// ─── openclaw CLI helper ──────────────────────────────────────────────────────
const getEnv = () => {
  const npmGlobal = path.join(HOME, 'AppData', 'Roaming', 'npm');
  const nodeDir   = 'C:\\Program Files\\nodejs';
  const gitBin    = 'C:\\Program Files\\Git\\mingw64\\bin';
  const extra     = [npmGlobal, nodeDir, gitBin].join(path.delimiter);
  return { ...process.env, PATH: extra + path.delimiter + (process.env.PATH || '') };
};
const runCmd = (cmd) =>
  new Promise((resolve) => {
    exec(cmd, { env: getEnv(), timeout: 15000 }, (err, stdout, stderr) => {
      resolve({ ok: !err, out: (stdout || '') + (stderr || ''), err: err?.message || '' });
    });
  });

// ─── Multer (file uploads) ────────────────────────────────────────────────────
const upload = multer({
  dest: path.join(__dirname, 'tmp_uploads'),
  limits: { fileSize: 20 * 1024 * 1024 },
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.hotelId = payload.hotelId;
    req.role    = payload.role;
    next();
  } catch {
    res.status(401).json({ error: 'Sesión expirada' });
  }
}
function requireAdmin(req, res, next) {
  if (req.role !== 'admin') return res.status(403).json({ error: 'Sin permisos de administrador' });
  next();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Auth
// ═══════════════════════════════════════════════════════════════════════════════
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

  // Super admin
  try {
    const admin = JSON.parse(await fs.readFile(ADMIN_FILE, 'utf-8'));
    if (email === admin.email && await bcrypt.compare(password, admin.passwordHash)) {
      const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
      res.cookie('token', token, { httpOnly: true, maxAge: 86400000, sameSite: 'lax' });
      return res.json({ ok: true, role: 'admin', name: 'Super Admin' });
    }
  } catch {}

  // Hotel
  let found = null;
  try {
    const dirs = await fs.readdir(HOTELS_DIR);
    for (const hotelId of dirs) {
      try {
        const cfg = JSON.parse(await fs.readFile(hotelPath(hotelId, 'config.json'), 'utf-8'));
        if (cfg.email === email && await bcrypt.compare(password, cfg.passwordHash)) {
          found = { hotelId, name: cfg.nombre, plan: cfg.plan };
          break;
        }
      } catch {}
    }
  } catch {}

  if (!found) return res.status(401).json({ error: 'Credenciales incorrectas' });
  const token = jwt.sign({ hotelId: found.hotelId, role: 'hotel' }, JWT_SECRET, { expiresIn: '24h' });
  res.cookie('token', token, { httpOnly: true, maxAge: 86400000, sameSite: 'lax' });
  res.json({ ok: true, role: 'hotel', hotelId: found.hotelId, name: found.name, plan: found.plan });
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

app.get('/api/auth/me', async (req, res) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role === 'admin') return res.json({ role: 'admin', name: 'Super Admin' });
    const cfg = JSON.parse(await fs.readFile(hotelPath(payload.hotelId, 'config.json'), 'utf-8'));
    res.json({ role: 'hotel', hotelId: payload.hotelId, name: cfg.nombre, plan: cfg.plan, email: cfg.email });
  } catch {
    res.status(401).json({ error: 'Sesión inválida' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Admin — panel y CRUD de hoteles
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin/api/hotels', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const dirs = await fs.readdir(HOTELS_DIR);
    const hotels = [];
    for (const hotelId of dirs) {
      try {
        const cfg = JSON.parse(await fs.readFile(hotelPath(hotelId, 'config.json'), 'utf-8'));
        let contacts = 0, sequences = 0;
        try { contacts  = JSON.parse(await fs.readFile(hotelPath(hotelId, 'outreach', 'contacts.json'), 'utf-8')).length; } catch {}
        try { sequences = JSON.parse(await fs.readFile(hotelPath(hotelId, 'outreach', 'sequences.json'), 'utf-8')).length; } catch {}
        const { passwordHash: _, ...safeCfg } = cfg;
        hotels.push({ ...safeCfg, contacts, sequences, staffBotActive: adminBots.get(hotelId)?.running || false });
      } catch {}
    }
    res.json(hotels);
  } catch { res.json([]); }
});

app.post('/admin/api/hotels', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { nombre, email, password, plan = 'starter' } = req.body;
    if (!nombre || !email || !password) return res.status(400).json({ error: 'Nombre, email y contraseña requeridos' });
    const hotelId = 'h_' + uuidv4().replace(/-/g, '').slice(0, 8);
    const cfg = { id: hotelId, nombre, email, passwordHash: await bcrypt.hash(password, 10), plan, createdAt: new Date().toISOString() };
    await fs.mkdir(hotelPath(hotelId, 'outreach'), { recursive: true });
    await fs.writeFile(hotelPath(hotelId, 'config.json'), JSON.stringify(cfg, null, 2));
    await fs.writeFile(hotelPath(hotelId, 'credentials.json'), JSON.stringify({}, null, 2));
    res.json({ ok: true, hotelId, nombre, email, plan });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/api/hotels/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const cfg = JSON.parse(await fs.readFile(hotelPath(req.params.id, 'config.json'), 'utf-8'));
    const { passwordHash: _, ...safeCfg } = cfg;
    res.json(safeCfg);
  } catch { res.status(404).json({ error: 'Hotel no encontrado' }); }
});

app.patch('/admin/api/hotels/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const cfg = JSON.parse(await fs.readFile(hotelPath(req.params.id, 'config.json'), 'utf-8'));
    const { nombre, email, password, plan } = req.body;
    if (nombre)   cfg.nombre = nombre;
    if (email)    cfg.email  = email;
    if (plan)     cfg.plan   = plan;
    if (password) cfg.passwordHash = await bcrypt.hash(password, 10);
    await fs.writeFile(hotelPath(req.params.id, 'config.json'), JSON.stringify(cfg, null, 2));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/admin/api/hotels/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const hotelId = req.params.id;
    const bot = adminBots.get(hotelId);
    if (bot?.intervalId) clearInterval(bot.intervalId);
    adminBots.delete(hotelId);
    const arJob = autoresponderJobs.get(hotelId);
    if (arJob) { arJob.stop(); autoresponderJobs.delete(hotelId); }
    const orJob = outreachJobs.get(hotelId);
    if (orJob) { orJob.stop(); outreachJobs.delete(hotelId); }
    await fs.rm(hotelDir(hotelId), { recursive: true, force: true });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/api/stats', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const dirs = await fs.readdir(HOTELS_DIR);
    let totalContacts = 0, totalSequences = 0, totalSent = 0;
    for (const hotelId of dirs) {
      try {
        const contacts = JSON.parse(await fs.readFile(hotelPath(hotelId, 'outreach', 'contacts.json'), 'utf-8'));
        totalContacts += contacts.length;
        for (const c of contacts) for (const s of Object.values(c.sequences || {})) totalSent += (s.sentSteps || []).length;
      } catch {}
      try { totalSequences += JSON.parse(await fs.readFile(hotelPath(hotelId, 'outreach', 'sequences.json'), 'utf-8')).length; } catch {}
    }
    res.json({ hotels: dirs.length, contacts: totalContacts, sequences: totalSequences, sent: totalSent });
  } catch { res.json({ hotels: 0, contacts: 0, sequences: 0, sent: 0 }); }
});

app.patch('/admin/api/password', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ error: 'Contraseña demasiado corta (mínimo 6 caracteres)' });
    const admin = JSON.parse(await fs.readFile(ADMIN_FILE, 'utf-8'));
    admin.passwordHash = await bcrypt.hash(password, 10);
    await fs.writeFile(ADMIN_FILE, JSON.stringify(admin, null, 2));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers de negocio
// ═══════════════════════════════════════════════════════════════════════════════
function defaultHotel() {
  return {
    nombre: '', direccion: '', telefono: '', whatsapp: '', email: '', web: '',
    checkin: '3:00 PM', checkout: '12:00 PM',
    early_checkin: 'Consultar disponibilidad', late_checkout: 'Consultar disponibilidad',
    recepcion_24h: 'Sí',
    desayuno_incluido: 'Sí', desayuno_horario: '7:00 AM – 10:30 AM', desayuno_tipo: 'Buffet',
    wifi_ssid: '', wifi_pass: '',
    estacionamiento: 'Sí, gratuito', mascotas: 'No permitidas',
    piscina: '', spa: '',
    politica_cancelacion: 'Cancelación gratuita hasta 48h antes',
    formas_pago: 'Tarjeta de crédito y efectivo',
    transfer_aeropuerto: 'Disponible, consultar precio',
    googleReviewUrl: '', bookingReviewUrl: '',
  };
}

async function regenerateFaq(hotelId, h) {
  const md = `---
name: hotel-faq
description: "Answer hotel guest FAQ automatically. Auto-detects language (ES/EN). Uses real hotel data."
metadata: { "openclaw": { "emoji": "💬" } }
---

# FAQ — ${h.nombre || 'Mi Hotel'}

Usa **únicamente** la información de abajo para responder preguntas de huéspedes.
Detecta el idioma del huésped y responde en ese mismo idioma.
Tono: cálido, conciso y profesional. Termina siempre con "¿Hay algo más en lo que pueda ayudarle? 🛎️"
Si no tienes la información exacta, di: "Permítame verificar eso con nuestro equipo."

## Datos del Hotel

- **Nombre:** ${h.nombre}
- **Dirección:** ${h.direccion}
- **Teléfono:** ${h.telefono}
- **WhatsApp:** ${h.whatsapp}
- **Email:** ${h.email}
- **Sitio web:** ${h.web}

## Horarios

- **Check-in:** ${h.checkin}
- **Check-out:** ${h.checkout}
- **Early check-in:** ${h.early_checkin}
- **Late check-out:** ${h.late_checkout}
- **Recepción 24h:** ${h.recepcion_24h}

## Desayuno

- **Incluido:** ${h.desayuno_incluido}
- **Horario:** ${h.desayuno_horario}
- **Tipo:** ${h.desayuno_tipo}

## WiFi

- **Red (SSID):** ${h.wifi_ssid || 'Se proporciona al hacer check-in'}
- **Contraseña:** ${h.wifi_pass || 'Se proporciona al hacer check-in'}

## Estacionamiento

${h.estacionamiento}

## Mascotas

${h.mascotas}

## Piscina y Spa

- **Piscina:** ${h.piscina || 'Consultar disponibilidad'}
- **Spa:** ${h.spa || 'Consultar disponibilidad'}

## Políticas

- **Cancelación:** ${h.politica_cancelacion}
- **Formas de pago:** ${h.formas_pago}
- **Transfer aeropuerto:** ${h.transfer_aeropuerto}
`;
  // Guardar en directorio del hotel
  const faqPath = hotelPath(hotelId, 'skills', 'hotel-faq', 'SKILL.md');
  await fs.mkdir(path.dirname(faqPath), { recursive: true });
  await fs.writeFile(faqPath, md);
  // También escribir en ~/.openclaw/ para compatibilidad con openclaw CLI
  const openclawFaq = path.join(OPENCLAW_HOME, 'skills', 'hotel-faq', 'SKILL.md');
  await fs.mkdir(path.dirname(openclawFaq), { recursive: true });
  await fs.writeFile(openclawFaq, md);
}

async function getEmailSettings(hotelId) {
  try { return JSON.parse(await fs.readFile(hotelPath(hotelId, 'email.json'), 'utf-8')); }
  catch { return null; }
}

// ─── Knowledge Base helpers ───────────────────────────────────────────────────
async function getKBIndex(hotelId) {
  try { return JSON.parse(await fs.readFile(hotelPath(hotelId, 'kb', 'index.json'), 'utf-8')); }
  catch { return []; }
}

async function getKBChunks(hotelId) {
  try { return JSON.parse(await fs.readFile(hotelPath(hotelId, 'kb', 'chunks.json'), 'utf-8')); }
  catch { return []; }
}

async function saveKBIndex(hotelId, index) {
  const dir = hotelPath(hotelId, 'kb');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'index.json'), JSON.stringify(index, null, 2));
}

async function saveKBChunks(hotelId, chunks) {
  const dir = hotelPath(hotelId, 'kb');
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'chunks.json'), JSON.stringify(chunks, null, 2));
}

function chunkText(text, source, docId, chunkSize = 500, overlap = 50) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 20) {
      chunks.push({ id: `chunk_${docId}_${chunks.length}`, docId, text: chunk, source });
    }
    if (end >= text.length) break;
    start = end - overlap;
  }
  return chunks;
}

async function getKBContext(hotelId, query, maxChunks = 5) {
  const chunks = await getKBChunks(hotelId);
  if (!chunks.length) return '';
  // BM25-simplified: score each chunk by query term frequency
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  if (!terms.length) return chunks.slice(0, maxChunks).map(c => c.text).join('\n\n---\n\n');
  const scored = chunks.map(c => {
    const lc = c.text.toLowerCase();
    const score = terms.reduce((s, t) => {
      const matches = (lc.match(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      return s + matches;
    }, 0);
    return { ...c, score };
  });
  const top = scored.filter(c => c.score > 0).sort((a, b) => b.score - a.score).slice(0, maxChunks);
  if (!top.length) return '';
  return top.map(c => `[${c.source}]\n${c.text}`).join('\n\n---\n\n');
}

// ─── KB: scrape URL ──────────────────────────────────────────────────────────
async function scrapeUrl(url) {
  const r = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HotelClaw/1.0; +https://hotelclaw.ai)' },
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error(`No se pudo acceder a la URL (HTTP ${r.status})`);
  const html = await r.text();
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, 50000); // cap 50k chars
}

// ─── KB: describir imagen con IA ─────────────────────────────────────────────
async function describeImageWithAI(hotelId, imagePath) {
  const creds = JSON.parse(await fs.readFile(hotelPath(hotelId, 'credentials.json'), 'utf-8'));
  if (!creds.anthropicKey) throw new Error('API key de Anthropic no configurada');
  const imageData = await fs.readFile(imagePath);
  const base64 = imageData.toString('base64');
  const ext = path.extname(imagePath).toLowerCase();
  const mediaType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': creds.anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: 'Eres el asistente de un hotel boutique. Describe esta imagen en detalle: qué se ve, colores, ambiente y características relevantes para un huésped. Responde en español, máximo 200 palabras.' },
        ],
      }],
    }),
  });
  if (!response.ok) throw new Error(`Anthropic Vision: ${await response.text()}`);
  return (await response.json()).content[0].text;
}

// ─── Servicios del hotel ─────────────────────────────────────────────────────
const SERVICE_CATEGORIES = {
  spa:        'Spa & Wellness',
  restaurant: 'Restaurante',
  tour:       'Tours y Excursiones',
  transport:  'Transporte',
  activity:   'Actividades',
  other:      'Otros servicios',
};

async function getServices(hotelId) {
  try { return JSON.parse(await fs.readFile(hotelPath(hotelId, 'services.json'), 'utf-8')); }
  catch { return []; }
}
async function saveServices(hotelId, list) {
  await fs.mkdir(hotelDir(hotelId), { recursive: true });
  await fs.writeFile(hotelPath(hotelId, 'services.json'), JSON.stringify(list, null, 2));
}

async function getServicesContext(hotelId) {
  const services = (await getServices(hotelId)).filter(s => s.active !== false);
  if (!services.length) return '';
  return services.map(s => {
    const cat = SERVICE_CATEGORIES[s.category] || s.category || 'Servicio';
    let txt = `### ${s.name} (${cat})\n`;
    if (s.description) txt += `${s.description}\n`;
    if (s.price)       txt += `Precio: ${s.price}\n`;
    if (s.schedule)    txt += `Horario: ${s.schedule}\n`;
    if (s.includes)    txt += `Incluye: ${s.includes}\n`;
    if (s.contact)     txt += `Contacto/Reservas: ${s.contact}\n`;
    if (s.notes)       txt += `Notas: ${s.notes}\n`;
    // Inject image descriptions so Aria can describe them
    if (s.images?.length) {
      const descs = s.images.filter(i => i.description).map(i => i.description);
      if (descs.length) txt += `Imágenes del servicio: ${descs.join(' | ')}\n`;
    }
    return txt;
  }).join('\n---\n');
}

// ─── Menú Digital ─────────────────────────────────────────────────────────────
const MENU_CATEGORIES = {
  entrada: 'Entradas', principal: 'Plato Principal', postre: 'Postre',
  bebida: 'Bebida', especial: 'Especial del día', otro: 'Otros',
};

async function getMenu(hotelId) {
  try { return JSON.parse(await fs.readFile(hotelPath(hotelId, 'menu.json'), 'utf-8')); }
  catch { return []; }
}
async function saveMenu(hotelId, list) {
  await fs.mkdir(hotelDir(hotelId), { recursive: true });
  await fs.writeFile(hotelPath(hotelId, 'menu.json'), JSON.stringify(list, null, 2));
}

// ─── Tablero de Habitaciones ───────────────────────────────────────────────────
const ROOM_STATUSES = { libre: 'Libre', ocupada: 'Ocupada', limpieza: 'Limpieza', mantenimiento: 'Mantenimiento' };
const ROOM_TYPES    = { individual: 'Individual', doble: 'Doble', suite: 'Suite', familiar: 'Familiar', otro: 'Otro' };

async function getRooms(hotelId) {
  try { return JSON.parse(await fs.readFile(hotelPath(hotelId, 'rooms.json'), 'utf-8')); }
  catch { return []; }
}
async function saveRooms(hotelId, list) {
  await fs.mkdir(hotelDir(hotelId), { recursive: true });
  await fs.writeFile(hotelPath(hotelId, 'rooms.json'), JSON.stringify(list, null, 2));
}

// ─── Chat Web de Huéspedes ────────────────────────────────────────────────────
async function getChats(hotelId) {
  try { return JSON.parse(await fs.readFile(hotelPath(hotelId, 'chats.json'), 'utf-8')); }
  catch { return []; }
}
async function saveChats(hotelId, list) {
  await fs.mkdir(hotelDir(hotelId), { recursive: true });
  await fs.writeFile(hotelPath(hotelId, 'chats.json'), JSON.stringify(list, null, 2));
}

// ─── Helper de fecha: desplazamiento en días ──────────────────────────────────
function offsetDate(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ─── Búsqueda web (DuckDuckGo) ───────────────────────────────────────────────
const WEB_SEARCH_KEYWORDS = [
  'recomiend', 'recomendaci', 'donde ', 'dónde ', 'qué hacer', 'que hacer',
  'lugares', 'restaurant', 'bar ', 'café', 'cafe ', 'actividad', 'excursi',
  'tour local', 'paseo', 'visitar', 'cerca', 'alrededor', 'what to do',
  'where to', 'recommend', 'nearby', 'local restaurant', 'places to visit',
];

function needsWebSearch(prompt) {
  const lower = prompt.toLowerCase();
  return WEB_SEARCH_KEYWORDS.some(kw => lower.includes(kw));
}

async function webSearch(query) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=es-es`;
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'es,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return '';
    const html = await r.text();
    // Extract title + snippet pairs
    const titles   = [...html.matchAll(/class="result__a"[^>]*>([\s\S]*?)<\/a>/g)]
      .map(m => m[1].replace(/<[^>]+>/g, '').trim()).slice(0, 5);
    const snippets = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)]
      .map(m => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()).slice(0, 5);
    const results = [];
    for (let i = 0; i < Math.min(titles.length, snippets.length, 4); i++) {
      if (titles[i] && snippets[i]) results.push(`${titles[i]}: ${snippets[i]}`);
    }
    return results.join('\n\n');
  } catch (e) {
    console.warn('[WebSearch]', e.message);
    return '';
  }
}

// ─── Tickets de solicitudes ───────────────────────────────────────────────────
const TICKET_PRIORITY = { urgent: '🔴 Urgente', high: '🟠 Alto', normal: '🟡 Normal', low: '🟢 Bajo' };
const TICKET_STATUS   = { pending: '⏳ Pendiente', in_progress: '🔧 En proceso', resolved: '✅ Resuelto' };

async function getTickets(hotelId) {
  try { return JSON.parse(await fs.readFile(hotelPath(hotelId, 'tickets.json'), 'utf-8')); }
  catch { return []; }
}
async function saveTickets(hotelId, list) {
  await fs.mkdir(hotelDir(hotelId), { recursive: true });
  await fs.writeFile(hotelPath(hotelId, 'tickets.json'), JSON.stringify(list, null, 2));
}
function newTicketId() { return uuidv4().slice(0, 6).toUpperCase(); }

// ─── Huéspedes activos ────────────────────────────────────────────────────────
const VISIT_LABELS = {
  anniversary: 'Aniversario 💍', honeymoon: 'Luna de miel 🌙',
  birthday: 'Cumpleaños 🎂', family: 'Familia con niños 👨‍👩‍👧',
  business: 'Viaje de negocios 💼', leisure: 'Vacaciones 🌴',
};

async function getGuests(hotelId) {
  try { return JSON.parse(await fs.readFile(hotelPath(hotelId, 'guests.json'), 'utf-8')); }
  catch { return []; }
}
async function saveGuests(hotelId, list) {
  await fs.mkdir(hotelDir(hotelId), { recursive: true });
  await fs.writeFile(hotelPath(hotelId, 'guests.json'), JSON.stringify(list, null, 2));
}

function detectVisitType(notes, explicitType) {
  if (explicitType && explicitType !== 'auto') return explicitType;
  const lower = (notes || '').toLowerCase();
  if (/aniversar|anniversar/.test(lower))       return 'anniversary';
  if (/luna de miel|honeymoon/.test(lower))     return 'honeymoon';
  if (/cumplea|birthday/.test(lower))           return 'birthday';
  if (/niño|familia|kid|child|hijos/.test(lower)) return 'family';
  if (/negocio|trabajo|business|conferencia/.test(lower)) return 'business';
  return 'leisure';
}

function midStayDate(checkin, checkout) {
  const ci = new Date(checkin + 'T12:00:00Z');
  const co = new Date(checkout + 'T12:00:00Z');
  const mid = new Date((ci.getTime() + co.getTime()) / 2);
  return mid.toISOString().split('T')[0];
}

function todayStr() { return new Date().toISOString().split('T')[0]; }

// ─── fal.ai helpers ───────────────────────────────────────────────────────────
async function getFalKey(hotelId) {
  try {
    const creds = JSON.parse(await fs.readFile(hotelPath(hotelId, 'credentials.json'), 'utf-8'));
    return creds.falApiKey || null;
  } catch { return null; }
}

async function generateImageFal(hotelId, prompt) {
  const key = await getFalKey(hotelId);
  if (!key) throw new Error('fal.ai API key no configurada. Agrégala en Credenciales.');
  const r = await fetch('https://fal.run/fal-ai/flux/schnell', {
    method: 'POST',
    headers: { 'Authorization': `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, image_size: 'square_hd', num_images: 1 }),
  });
  if (!r.ok) throw new Error(`fal.ai error: ${await r.text()}`);
  const data = await r.json();
  const url = data.images?.[0]?.url;
  if (!url) throw new Error('fal.ai no devolvió imagen');
  return url;
}

async function generateVideoFal(hotelId, prompt) {
  const key = await getFalKey(hotelId);
  if (!key) throw new Error('fal.ai API key no configurada. Agrégala en Credenciales.');
  // Submit job
  const r = await fetch('https://queue.fal.run/fal-ai/kling-video/v2/standard/text-to-video', {
    method: 'POST',
    headers: { 'Authorization': `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!r.ok) throw new Error(`fal.ai error: ${await r.text()}`);
  const { request_id } = await r.json();
  if (!request_id) throw new Error('fal.ai no devolvió request_id');
  // Poll for result
  for (let i = 0; i < 24; i++) {
    await new Promise(res => setTimeout(res, 5000));
    const poll = await fetch(`https://queue.fal.run/requests/${request_id}`, {
      headers: { 'Authorization': `Key ${key}` },
    });
    const data = await poll.json();
    if (data.status === 'COMPLETED') {
      const url = data.video?.url;
      if (!url) throw new Error('fal.ai completó pero no hay URL de video');
      return url;
    }
    if (data.status === 'FAILED') throw new Error('fal.ai falló al generar el video');
  }
  throw new Error('Timeout: el video tardó más de 2 minutos');
}

async function generateWithAria(hotelId, system, userPrompt, opts = {}) {
  const creds = JSON.parse(await fs.readFile(hotelPath(hotelId, 'credentials.json'), 'utf-8'));
  if (!creds.anthropicKey) throw new Error('API key de Anthropic no configurada');
  const kbCtx  = await getKBContext(hotelId, userPrompt);
  const svcCtx = await getServicesContext(hotelId);
  const webCtx = (opts.searchWeb !== false && needsWebSearch(userPrompt))
    ? await webSearch(userPrompt)
    : '';
  let fullSystem = system;
  if (kbCtx)  fullSystem += '\n\n## Base de Conocimiento del Hotel\n\n' + kbCtx;
  if (svcCtx) fullSystem += '\n\n## Servicios del Hotel\n\nCuando un huésped pregunte sobre servicios, tours, restaurante, spa u otras actividades, usa ESTA información. Si el huésped quiere reservar, dile cómo contactar según el campo "Contacto/Reservas".\n\n' + svcCtx;
  if (webCtx) fullSystem += '\n\n## Información Web Actualizada (recomendaciones locales)\n\nUsa esta información para dar recomendaciones de lugares, restaurantes y actividades locales FUERA del hotel. Cita las fuentes de forma natural.\n\n' + webCtx;
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': creds.anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6', max_tokens: 1500,
      system: fullSystem, messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!response.ok) throw new Error(`Anthropic API: ${await response.text()}`);
  return (await response.json()).content[0].text;
}

async function sendEmailMsg(settings, to, subject, text) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: settings.email, pass: settings.appPassword },
  });
  await transporter.sendMail({
    from: `"${settings.senderName || 'Aria — HotelClaw'}" <${settings.email}>`,
    to, subject, text,
  });
}

async function pollInbox(hotelId) {
  const settings = await getEmailSettings(hotelId);
  if (!settings?.email || !settings?.appPassword) return;
  let msgIds = processedMsgIds.get(hotelId);
  if (!msgIds) { msgIds = new Set(); processedMsgIds.set(hotelId, msgIds); }
  const client = new ImapFlow({
    host: 'imap.gmail.com', port: 993, secure: true,
    auth: { user: settings.email, pass: settings.appPassword },
    logger: false,
  });
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const uids = await client.search({ seen: false }, { uid: true });
      for (const uid of uids.slice(-10)) {
        const msg = await client.fetchOne(uid, { envelope: true, bodyText: true }, { uid: true });
        if (!msg) continue;
        const msgId = msg.envelope?.messageId || String(uid);
        if (msgIds.has(msgId)) continue;
        const fromAddr = msg.envelope?.from?.[0]?.address || '';
        if (!fromAddr || fromAddr.toLowerCase() === settings.email.toLowerCase()) { msgIds.add(msgId); continue; }
        const subject  = msg.envelope?.subject || 'Sin asunto';
        const bodyText = (msg.bodyText || '').slice(0, 3000) || '(correo sin texto)';
        let hotelCtx = '';
        try {
          const h = JSON.parse(await fs.readFile(hotelPath(hotelId, 'hotel-data.json'), 'utf-8'));
          hotelCtx = `Hotel: ${h.nombre}. Tel: ${h.telefono}. Email: ${h.email}.`;
        } catch {}
        const system = `Eres Aria, asistente virtual del hotel. ${hotelCtx} Responde correos de forma profesional y cálida. Escribe SOLO el cuerpo del correo, sin asunto. Detecta el idioma del remitente y responde en ese mismo idioma.`;
        const reply = await generateWithAria(hotelId, system, `Responde este correo:\n\nDe: ${fromAddr}\nAsunto: ${subject}\n\n${bodyText}`);
        await sendEmailMsg(settings, fromAddr, `Re: ${subject}`, reply);
        await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
        msgIds.add(msgId);
        console.log(`[AutoResponder:${hotelId}] ✅ Respondido a ${fromAddr}`);
      }
    } finally { lock.release(); }
  } catch (e) { console.error(`[AutoResponder:${hotelId}] ❌`, e.message); }
  finally { await client.logout().catch(() => {}); }
}

async function processOutreach(hotelId) {
  let contacts, sequences;
  try {
    contacts  = JSON.parse(await fs.readFile(hotelPath(hotelId, 'outreach', 'contacts.json'), 'utf-8'));
    sequences = JSON.parse(await fs.readFile(hotelPath(hotelId, 'outreach', 'sequences.json'), 'utf-8'));
  } catch { return; }
  const settings = await getEmailSettings(hotelId);
  if (!settings?.email) return;
  const today = new Date();
  let updated = false;
  for (const seq of sequences.filter(s => s.status === 'active')) {
    for (const contact of contacts) {
      contact.sequences = contact.sequences || {};
      if (!contact.sequences[seq.id]) {
        contact.sequences[seq.id] = { startDate: today.toISOString(), sentSteps: [] };
        updated = true;
      }
      const cs = contact.sequences[seq.id];
      if (cs.unsubscribed) continue;
      const startDate = new Date(cs.startDate);
      for (const step of seq.steps) {
        if (cs.sentSteps.includes(step.id)) continue;
        const sendDate = new Date(startDate);
        sendDate.setDate(sendDate.getDate() + step.dayOffset);
        if (sendDate.toDateString() !== today.toDateString()) continue;
        try {
          const nombre  = contact.nombre || contact.name || contact.email.split('@')[0];
          const empresa = contact.empresa || contact.company || '';
          const body    = await generateWithAria(hotelId,
            'Eres Aria, redactas correos de outreach profesionales y personalizados. Escribe SOLO el cuerpo del correo.',
            `${step.prompt}\n\nDatos del contacto:\n- Nombre: ${nombre}\n- Email: ${contact.email}${empresa ? `\n- Empresa: ${empresa}` : ''}`
          );
          await sendEmailMsg(settings, contact.email, step.subject.replace(/\{\{nombre\}\}/gi, nombre), body);
          cs.sentSteps.push(step.id);
          updated = true;
          console.log(`[Outreach:${hotelId}] ✅ "${step.id}" enviado a ${contact.email}`);
        } catch (e) { console.error(`[Outreach:${hotelId}] ❌ ${contact.email}:`, e.message); }
      }
    }
  }
  if (updated) await fs.writeFile(hotelPath(hotelId, 'outreach', 'contacts.json'), JSON.stringify(contacts, null, 2));
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
  return lines.slice(1).map((line, i) => {
    const vals = line.split(',').map(v => v.replace(/^"|"$/g, '').trim());
    const obj  = { _id: `c_${Date.now()}_${i}` };
    headers.forEach((h, idx) => { obj[h] = vals[idx] || ''; });
    return obj;
  }).filter(c => c.email);
}

async function getOutreachStats(hotelId) {
  try {
    const contacts  = JSON.parse(await fs.readFile(hotelPath(hotelId, 'outreach', 'contacts.json'), 'utf-8'));
    const sequences = JSON.parse(await fs.readFile(hotelPath(hotelId, 'outreach', 'sequences.json'), 'utf-8'));
    let sent = 0;
    for (const c of contacts) for (const s of Object.values(c.sequences || {})) sent += (s.sentSteps || []).length;
    return { contacts: contacts.length, sequences: sequences.length, active: sequences.filter(s => s.status === 'active').length, sent };
  } catch { return { contacts: 0, sequences: 0, active: 0, sent: 0 }; }
}

async function importContacts(hotelId, csv) {
  const incoming = parseCSV(csv);
  if (!incoming.length) return { ok: false, error: 'CSV vacío o sin columna "email"' };
  let existing = [];
  try { existing = JSON.parse(await fs.readFile(hotelPath(hotelId, 'outreach', 'contacts.json'), 'utf-8')); } catch {}
  const existEmails = new Set(existing.map(c => c.email));
  const newOnes = incoming.filter(c => !existEmails.has(c.email));
  const merged = [...existing, ...newOnes];
  await fs.mkdir(hotelPath(hotelId, 'outreach'), { recursive: true });
  await fs.writeFile(hotelPath(hotelId, 'outreach', 'contacts.json'), JSON.stringify(merged, null, 2));
  return { ok: true, added: newOnes.length, total: merged.length };
}

async function createSequence(hotelId, name, steps) {
  let sequences = [];
  try { sequences = JSON.parse(await fs.readFile(hotelPath(hotelId, 'outreach', 'sequences.json'), 'utf-8')); } catch {}
  const seq = {
    id: `seq_${Date.now()}`, name, status: 'paused',
    createdAt: new Date().toISOString(),
    steps: steps.map((s, i) => ({ ...s, id: `step_${i}` })),
  };
  sequences.push(seq);
  await fs.mkdir(hotelPath(hotelId, 'outreach'), { recursive: true });
  await fs.writeFile(hotelPath(hotelId, 'outreach', 'sequences.json'), JSON.stringify(sequences, null, 2));
  return { ok: true, id: seq.id };
}

// ═══════════════════════════════════════════════════════════════════════════════
// API: Datos del hotel
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/hotel', requireAuth, async (req, res) => {
  try {
    const raw = await fs.readFile(hotelPath(req.hotelId, 'hotel-data.json'), 'utf-8');
    res.json(JSON.parse(raw));
  } catch { res.json(defaultHotel()); }
});

app.post('/api/hotel', requireAuth, async (req, res) => {
  try {
    await fs.mkdir(hotelDir(req.hotelId), { recursive: true });
    await fs.writeFile(hotelPath(req.hotelId, 'hotel-data.json'), JSON.stringify(req.body, null, 2));
    await regenerateFaq(req.hotelId, req.body);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// API: Credenciales
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/credentials', requireAuth, async (req, res) => {
  try {
    const creds = JSON.parse(await fs.readFile(hotelPath(req.hotelId, 'credentials.json'), 'utf-8'));
    const a = creds.anthropicKey || '';
    const t = creds.telegramBotToken || '';
    const f = creds.falApiKey || '';
    res.json({
      anthropic_set: !!a, anthropic_hint: a ? a.slice(0, 22) + '...' : '',
      telegram_set: !!t, telegram_hint: t ? t.slice(0, 15) + '...' : '',
      fal_set: !!f, fal_hint: f ? f.slice(0, 12) + '...' : '',
    });
  } catch { res.json({ anthropic_set: false, telegram_set: false, fal_set: false }); }
});

app.post('/api/credentials', requireAuth, async (req, res) => {
  try {
    const { anthropic, telegram, gateway, fal } = req.body;
    let creds = {};
    try { creds = JSON.parse(await fs.readFile(hotelPath(req.hotelId, 'credentials.json'), 'utf-8')); } catch {}
    if (anthropic) creds.anthropicKey = anthropic;
    if (telegram)  creds.telegramBotToken = telegram;
    if (gateway)   creds.gatewayToken = gateway || 'hotelclaw-gateway-secret-2026';
    if (fal)       creds.falApiKey = fal;
    await fs.mkdir(hotelDir(req.hotelId), { recursive: true });
    await fs.writeFile(hotelPath(req.hotelId, 'credentials.json'), JSON.stringify(creds, null, 2));
    // Compatibilidad con openclaw CLI
    const lines = [
      `OPENCLAW_GATEWAY_TOKEN=${creds.gatewayToken || 'hotelclaw-gateway-secret-2026'}`,
      creds.anthropicKey    ? `ANTHROPIC_API_KEY=${creds.anthropicKey}` : null,
      creds.telegramBotToken ? `TELEGRAM_BOT_TOKEN=${creds.telegramBotToken}` : null,
    ].filter(Boolean);
    await fs.mkdir(OPENCLAW_HOME, { recursive: true });
    await fs.writeFile(path.join(OPENCLAW_HOME, '.env'), lines.join('\n') + '\n');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// API: Servicios del hotel
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/services
app.get('/api/services', requireAuth, async (req, res) => {
  try { res.json(await getServices(req.hotelId)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/services → crear servicio
app.post('/api/services', requireAuth, async (req, res) => {
  try {
    const { name, category, description, price, schedule, includes, contact, notes } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });
    const list = await getServices(req.hotelId);
    const svc = {
      id: `svc_${uuidv4().slice(0, 8)}`,
      name, category: category || 'other',
      description: description || '', price: price || '',
      schedule: schedule || '', includes: includes || '',
      contact: contact || '', notes: notes || '',
      images: [], active: true,
      createdAt: new Date().toISOString(),
    };
    list.push(svc);
    await saveServices(req.hotelId, list);
    res.json({ ok: true, service: svc });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/services/:id → actualizar servicio
app.put('/api/services/:id', requireAuth, async (req, res) => {
  try {
    const list = await getServices(req.hotelId);
    const idx = list.findIndex(s => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Servicio no encontrado' });
    const allowed = ['name','category','description','price','schedule','includes','contact','notes','active'];
    allowed.forEach(k => { if (req.body[k] !== undefined) list[idx][k] = req.body[k]; });
    await saveServices(req.hotelId, list);
    res.json({ ok: true, service: list[idx] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/services/:id → eliminar servicio
app.delete('/api/services/:id', requireAuth, async (req, res) => {
  try {
    let list = await getServices(req.hotelId);
    const svc = list.find(s => s.id === req.params.id);
    if (!svc) return res.status(404).json({ error: 'Servicio no encontrado' });
    // Borrar imágenes del disco
    for (const img of svc.images || []) {
      try { await fs.unlink(hotelPath(req.hotelId, 'services', 'images', img.filename)); } catch {}
    }
    list = list.filter(s => s.id !== req.params.id);
    await saveServices(req.hotelId, list);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/services/:id/image → subir imagen al servicio (con visión IA)
app.post('/api/services/:id/image', requireAuth, upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'Archivo requerido' });
  try {
    const list = await getServices(req.hotelId);
    const svc = list.find(s => s.id === req.params.id);
    if (!svc) return res.status(404).json({ error: 'Servicio no encontrado' });
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.jpg','.jpeg','.png','.webp'].includes(ext))
      return res.status(400).json({ error: 'Solo JPG, PNG o WEBP' });
    const imgDir  = hotelPath(req.hotelId, 'services', 'images');
    await fs.mkdir(imgDir, { recursive: true });
    const filename = `img_${req.params.id}_${uuidv4().slice(0, 8)}${ext}`;
    const destFile = path.join(imgDir, filename);
    await fs.rename(file.path, destFile);
    // Describir con Claude Vision
    let description = '';
    try { description = await describeImageWithAI(req.hotelId, destFile); } catch {}
    svc.images = svc.images || [];
    svc.images.push({ filename, description });
    await saveServices(req.hotelId, list);
    res.json({ ok: true, filename, description });
  } catch (e) {
    try { await fs.unlink(file.path); } catch {}
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/services/:id/image/:filename → eliminar imagen
app.delete('/api/services/:id/image/:filename', requireAuth, async (req, res) => {
  try {
    const list = await getServices(req.hotelId);
    const svc = list.find(s => s.id === req.params.id);
    if (!svc) return res.status(404).json({ error: 'Servicio no encontrado' });
    svc.images = (svc.images || []).filter(i => i.filename !== req.params.filename);
    try { await fs.unlink(hotelPath(req.hotelId, 'services', 'images', req.params.filename)); } catch {}
    await saveServices(req.hotelId, list);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/services/image/:filename → servir imagen
app.get('/api/services/image/:filename', requireAuth, async (req, res) => {
  const imgPath = hotelPath(req.hotelId, 'services', 'images', req.params.filename);
  try { await fs.access(imgPath); res.sendFile(imgPath); }
  catch { res.status(404).json({ error: 'Imagen no encontrada' }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// API: Tickets de solicitudes
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/tickets', requireAuth, async (req, res) => {
  try {
    let tickets = await getTickets(req.hotelId);
    const { status } = req.query;
    if (status) tickets = tickets.filter(t => t.status === status);
    res.json(tickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tickets', requireAuth, async (req, res) => {
  try {
    const { description, room, guestName, priority, source } = req.body || {};
    if (!description) return res.status(400).json({ error: 'Descripción requerida' });
    const list = await getTickets(req.hotelId);
    const ticket = {
      id: newTicketId(), description,
      room: room || '', guestName: guestName || '',
      priority: priority || 'normal', status: 'pending',
      source: source || 'dashboard',
      createdAt: new Date().toISOString(), resolvedAt: null, notes: '',
    };
    list.push(ticket);
    await saveTickets(req.hotelId, list);
    res.json({ ok: true, ticket });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/tickets/:id', requireAuth, async (req, res) => {
  try {
    const list = await getTickets(req.hotelId);
    const t = list.find(t => t.id === req.params.id);
    if (!t) return res.status(404).json({ error: 'Ticket no encontrado' });
    ['status','priority','notes','guestName','room'].forEach(k => {
      if (req.body[k] !== undefined) t[k] = req.body[k];
    });
    if (req.body.status === 'resolved' && !t.resolvedAt) t.resolvedAt = new Date().toISOString();
    if (req.body.status !== 'resolved') t.resolvedAt = null;
    await saveTickets(req.hotelId, list);
    res.json({ ok: true, ticket: t });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/tickets/:id', requireAuth, async (req, res) => {
  try {
    const list = (await getTickets(req.hotelId)).filter(t => t.id !== req.params.id);
    await saveTickets(req.hotelId, list);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// API: Huéspedes activos
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/guests', requireAuth, async (req, res) => {
  try { res.json(await getGuests(req.hotelId)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/guests', requireAuth, async (req, res) => {
  try {
    const { name, room, checkin, checkout, type, notes, contact, channel } = req.body || {};
    if (!name || !checkin || !checkout) return res.status(400).json({ error: 'Nombre, check-in y check-out son obligatorios' });
    const list  = await getGuests(req.hotelId);
    const vtype = detectVisitType(notes, type);
    // Detectar huésped frecuente
    const today2   = todayStr();
    const nameLow  = (name || '').toLowerCase().trim();
    const pastList = list.filter(g => g.checkout < today2);
    const prevMatch = pastList.find(g =>
      g.name.toLowerCase().trim() === nameLow ||
      (contact && g.contact && g.contact.trim() === (contact || '').trim())
    );
    const isReturning = !!prevMatch;
    const returnCount = isReturning ? (prevMatch.returnCount || 0) + 1 : 0;
    const prevNotes   = isReturning ? (prevMatch.notes || '') : '';
    const guest = {
      id: `g_${uuidv4().slice(0, 8)}`, name, room: room || '',
      checkin, checkout, type: vtype, notes: notes || '',
      contact: contact || '', channel: channel || 'whatsapp',
      pulseStatus: null, pulseSentAt: null,
      upsellSent: false, active: true,
      precheckinSent: false,
      isReturning, returnCount, prevNotes,
      reviewStatus: null, reviewSentAt: null, reviewFeedback: '',
      createdAt: new Date().toISOString(),
    };
    list.push(guest);
    await saveGuests(req.hotelId, list);
    res.json({ ok: true, guest });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/guests/:id', requireAuth, async (req, res) => {
  try {
    const list = await getGuests(req.hotelId);
    const g = list.find(g => g.id === req.params.id);
    if (!g) return res.status(404).json({ error: 'Huésped no encontrado' });
    ['name','room','checkin','checkout','type','notes','contact','channel','active','pulseStatus','upsellSent'].forEach(k => {
      if (req.body[k] !== undefined) g[k] = req.body[k];
    });
    if (req.body.notes || req.body.type) g.type = detectVisitType(g.notes, g.type);
    await saveGuests(req.hotelId, list);
    res.json({ ok: true, guest: g });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/guests/:id', requireAuth, async (req, res) => {
  try {
    const list = (await getGuests(req.hotelId)).filter(g => g.id !== req.params.id);
    await saveGuests(req.hotelId, list);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/guests/:id/pulse → genera mensaje de pulso de satisfacción
app.post('/api/guests/:id/pulse', requireAuth, async (req, res) => {
  try {
    const list = await getGuests(req.hotelId);
    const g = list.find(g => g.id === req.params.id);
    if (!g) return res.status(404).json({ error: 'Huésped no encontrado' });
    let cfg = {};
    try { cfg = JSON.parse(await fs.readFile(hotelPath(req.hotelId, 'config.json'), 'utf-8')); } catch {}
    const hotelName = cfg.nombre || 'el hotel';
    const msg = await generateWithAria(req.hotelId,
      `Eres Aria, concierge virtual de ${hotelName}. Redacta un mensaje corto, cálido y natural (máximo 3 líneas) para preguntar cómo está yendo la estadía del huésped a mitad de su visita. Pregunta si hay algo que el equipo pueda mejorar. NO menciones que eres IA.`,
      `Huésped: ${g.name}. Tipo de visita: ${VISIT_LABELS[g.type] || g.type}. Check-in: ${g.checkin}. Check-out: ${g.checkout}.`,
      { searchWeb: false }
    );
    // Marcar como enviado
    g.pulseStatus = 'sent'; g.pulseSentAt = new Date().toISOString();
    await saveGuests(req.hotelId, list);
    res.json({ ok: true, message: msg });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/guests/:id/upsell → genera oferta personalizada
app.post('/api/guests/:id/upsell', requireAuth, async (req, res) => {
  try {
    const list = await getGuests(req.hotelId);
    const g = list.find(g => g.id === req.params.id);
    if (!g) return res.status(404).json({ error: 'Huésped no encontrado' });
    const services = (await getServices(req.hotelId)).filter(s => s.active !== false);
    let cfg = {};
    try { cfg = JSON.parse(await fs.readFile(hotelPath(req.hotelId, 'config.json'), 'utf-8')); } catch {}
    const hotelName = cfg.nombre || 'el hotel';
    const svcList = services.length
      ? services.map(s => `- ${s.name} (${s.price || 'consultar precio'})`).join('\n')
      : 'Servicios generales del hotel';
    const msg = await generateWithAria(req.hotelId,
      `Eres Aria, concierge de ${hotelName}. Redacta un mensaje de WhatsApp corto (máximo 4 líneas), personalizado y elegante para ofrecerle al huésped un servicio o experiencia adicional relevante a su tipo de visita. Sé específico, menciona el servicio y el precio si lo tienes. NO uses asteriscos ni markdown.`,
      `Huésped: ${g.name}. Tipo de visita: ${VISIT_LABELS[g.type]}. Notas: ${g.notes || 'ninguna'}.\n\nServicios disponibles:\n${svcList}`,
      { searchWeb: false }
    );
    g.upsellSent = true;
    await saveGuests(req.hotelId, list);
    res.json({ ok: true, message: msg });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/guests/history — huéspedes pasados (checkout < today)
app.get('/api/guests/history', requireAuth, async (req, res) => {
  try {
    const all   = await getGuests(req.hotelId);
    const today = todayStr();
    const past  = all.filter(g => g.checkout < today).sort((a, b) => b.checkout.localeCompare(a.checkout));
    res.json(past);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/guests/:id/precheckin → genera mensaje pre-llegada
app.post('/api/guests/:id/precheckin', requireAuth, async (req, res) => {
  try {
    const list = await getGuests(req.hotelId);
    const g = list.find(g => g.id === req.params.id);
    if (!g) return res.status(404).json({ error: 'Huésped no encontrado' });
    let h = {};
    try { h = JSON.parse(await fs.readFile(hotelPath(req.hotelId, 'hotel-data.json'), 'utf-8')); } catch {}
    const msg = await generateWithAria(req.hotelId,
      `Eres Aria, concierge virtual de ${h.nombre || 'nuestro hotel'}. Redacta un mensaje de bienvenida previo al check-in: cálido, elegante y breve (máximo 5 líneas). Incluye la hora de check-in, el WiFi si lo conoces, y que estamos disponibles para lo que necesiten. Sin markdown ni asteriscos.`,
      `Huésped: ${g.name}. Tipo de visita: ${VISIT_LABELS[g.type] || g.type}. Check-in: ${g.checkin}. Check-out: ${g.checkout}. Hora check-in: ${h.checkin || '3:00 PM'}. WiFi SSID: ${h.wifi_ssid || '(se entrega al llegar)'}. Teléfono hotel: ${h.telefono || ''}. Estacionamiento: ${h.estacionamiento || ''}.`,
      { searchWeb: false }
    );
    g.precheckinSent = true;
    await saveGuests(req.hotelId, list);
    res.json({ ok: true, message: msg });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/guests/:id/review-request → genera solicitud de reseña post-estadía
app.post('/api/guests/:id/review-request', requireAuth, async (req, res) => {
  try {
    const list = await getGuests(req.hotelId);
    const g = list.find(g => g.id === req.params.id);
    if (!g) return res.status(404).json({ error: 'Huésped no encontrado' });
    let cfg = {};
    try { cfg = JSON.parse(await fs.readFile(hotelPath(req.hotelId, 'config.json'), 'utf-8')); } catch {}
    const hotelName = cfg.nombre || 'el hotel';
    const msg = await generateWithAria(req.hotelId,
      `Eres Aria, concierge de ${hotelName}. Redacta un mensaje post-estadía para solicitar una reseña: agradecido, cálido, máximo 4 líneas. Sin markdown ni asteriscos.`,
      `Huésped: ${g.name}. Tipo de visita: ${VISIT_LABELS[g.type] || g.type}. Check-out: ${g.checkout}.`,
      { searchWeb: false }
    );
    g.reviewStatus = 'sent'; g.reviewSentAt = new Date().toISOString();
    await saveGuests(req.hotelId, list);
    res.json({ ok: true, message: msg });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/guests/:id/review-response → registrar respuesta de reseña
app.post('/api/guests/:id/review-response', requireAuth, async (req, res) => {
  try {
    const { sentiment, feedback } = req.body || {};
    if (!sentiment) return res.status(400).json({ error: 'sentiment requerido (positive|negative)' });
    const list = await getGuests(req.hotelId);
    const g = list.find(g => g.id === req.params.id);
    if (!g) return res.status(404).json({ error: 'Huésped no encontrado' });
    g.reviewStatus   = sentiment;
    g.reviewFeedback = feedback || '';
    await saveGuests(req.hotelId, list);

    if (sentiment === 'positive') {
      let h = {};
      try { h = JSON.parse(await fs.readFile(hotelPath(req.hotelId, 'hotel-data.json'), 'utf-8')); } catch {}
      return res.json({ ok: true, googleReviewUrl: h.googleReviewUrl || '', bookingReviewUrl: h.bookingReviewUrl || '' });
    }

    if (sentiment === 'negative') {
      const token = await getAdminToken(req.hotelId);
      const bot   = adminBots.get(req.hotelId);
      if (token && bot?.running) {
        const chatIds = [...(bot.chatIds || new Set())];
        for (const chatId of chatIds) {
          await tgSend(token, chatId,
            `⚠️ *Reseña negativa de ${g.name.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')}*\n\n${(feedback || 'Sin comentario').replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')}\n\nContacto: ${g.contact || 'no disponible'}`
          );
        }
      }
      return res.json({ ok: true, escalated: true });
    }

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// API: Knowledge Base (RAG)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/kb → lista documentos
app.get('/api/kb', requireAuth, async (req, res) => {
  try { res.json(await getKBIndex(req.hotelId)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/kb/url → agregar URL (con scraping real)
app.post('/api/kb/url', requireAuth, async (req, res) => {
  try {
    const { title, url, description } = req.body || {};
    if (!url) return res.status(400).json({ error: 'URL requerida' });

    // Intentar scraping del contenido real de la URL
    let scrapedText = '';
    let scrapeError = null;
    try {
      scrapedText = await scrapeUrl(url);
    } catch (e) {
      scrapeError = e.message;
    }

    // Combinar: descripción manual + texto raspado
    const manualText = [title || url, description || ''].filter(Boolean).join('\n');
    const fullText = scrapedText
      ? manualText + (manualText ? '\n\n' : '') + scrapedText
      : manualText;

    const index = await getKBIndex(req.hotelId);
    const chunks = await getKBChunks(req.hotelId);
    const docId = `url_${uuidv4().slice(0, 8)}`;
    const newChunks = chunkText(fullText, title || url, docId);
    index.push({ id: docId, type: 'url', title: title || url, url, scraped: !scrapeError, createdAt: new Date().toISOString() });
    await saveKBIndex(req.hotelId, index);
    await saveKBChunks(req.hotelId, [...chunks, ...newChunks]);
    res.json({ ok: true, id: docId, chunks: newChunks.length, scraped: !scrapeError, scrapeError: scrapeError || undefined });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/kb/upload → subir PDF/DOCX/TXT o imagen
app.post('/api/kb/upload', requireAuth, upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'Archivo requerido' });
  try {
    const ext = path.extname(file.originalname).toLowerCase();
    const docId = `doc_${uuidv4().slice(0, 8)}`;
    const uploadsDir = hotelPath(req.hotelId, 'kb', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    const destFile = path.join(uploadsDir, docId + ext);
    await fs.rename(file.path, destFile);

    const index = await getKBIndex(req.hotelId);
    const chunks = await getKBChunks(req.hotelId);
    let newChunks = [];

    if (ext === '.pdf') {
      const buf = await fs.readFile(destFile);
      const data = await pdfParse(buf);
      newChunks = chunkText(data.text, file.originalname, docId);
    } else if (ext === '.docx') {
      const result = await mammoth.extractRawText({ path: destFile });
      newChunks = chunkText(result.value, file.originalname, docId);
    } else if (['.txt', '.md'].includes(ext)) {
      const text = await fs.readFile(destFile, 'utf-8');
      newChunks = chunkText(text, file.originalname, docId);
    } else if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
      // Describir imagen con Claude Vision (Haiku)
      try {
        const description = await describeImageWithAI(req.hotelId, destFile);
        newChunks = chunkText(description, file.originalname, docId);
      } catch (e) {
        // Si falla la visión, la imagen queda en el KB sin chunks de texto
        console.warn(`[KB] Vision IA falló para ${file.originalname}: ${e.message}`);
        newChunks = [];
      }
    }

    const type = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? 'image' : 'doc';
    index.push({
      id: docId, type, title: file.originalname, filename: docId + ext,
      size: file.size, createdAt: new Date().toISOString(),
    });
    await saveKBIndex(req.hotelId, index);
    await saveKBChunks(req.hotelId, [...chunks, ...newChunks]);
    res.json({ ok: true, id: docId, chunks: newChunks.length, type });
  } catch (e) {
    // Clean up tmp file if still exists
    try { await fs.unlink(file.path); } catch {}
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/kb/:id → eliminar documento y sus chunks
app.delete('/api/kb/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    let index = await getKBIndex(req.hotelId);
    const doc = index.find(d => d.id === id);
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });
    // Remove file if it exists
    if (doc.filename) {
      try { await fs.unlink(hotelPath(req.hotelId, 'kb', 'uploads', doc.filename)); } catch {}
    }
    index = index.filter(d => d.id !== id);
    const chunks = (await getKBChunks(req.hotelId)).filter(c => c.docId !== id);
    await saveKBIndex(req.hotelId, index);
    await saveKBChunks(req.hotelId, chunks);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/kb/search?q= → buscar en KB (testing)
app.get('/api/kb/search', requireAuth, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);
    const chunks = await getKBChunks(req.hotelId);
    const terms = q.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const scored = chunks.map(c => {
      const lc = c.text.toLowerCase();
      const score = terms.reduce((s, t) => {
        const matches = (lc.match(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        return s + matches;
      }, 0);
      return { ...c, score };
    }).filter(c => c.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
    res.json(scored);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// API: Estado y gateway
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/status', requireAuth, async (_req, res) => {
  const { out } = await runCmd('openclaw channels status');
  res.json({
    gateway:  out.includes('Gateway reachable'),
    telegram: out.includes('telegram') && out.includes('running'),
    whatsapp: out.includes('whatsapp') && out.includes('linked') && !out.includes('not linked'),
    skills:   6,
    raw:      out,
  });
});

app.post('/api/gateway/start', requireAuth, (req, res) => {
  const proc = spawn('openclaw', ['gateway', 'run', '--port', '18789'], {
    env: getEnv(), detached: true, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  const logStream = fsSync.createWriteStream(LOG_PATH, { flags: 'a' });
  proc.stdout?.pipe(logStream);
  proc.stderr?.pipe(logStream);
  proc.unref();
  setTimeout(() => res.json({ ok: true }), 2000);
});

app.post('/api/gateway/stop', requireAuth, async (_req, res) => {
  const { out } = await runCmd('openclaw gateway stop');
  res.json({ ok: true, msg: out });
});

app.get('/api/gateway/logs', requireAuth, async (_req, res) => {
  try {
    const raw = await fs.readFile(LOG_PATH, 'utf-8');
    res.json({ lines: raw.split('\n').filter(Boolean).slice(-80) });
  } catch { res.json({ lines: ['El gateway aún no ha generado logs.'] }); }
});

app.post('/api/pairing/approve', requireAuth, async (req, res) => {
  const { code, channel = 'telegram' } = req.body;
  if (!code) return res.status(400).json({ error: 'Código requerido' });
  const { ok, out } = await runCmd(`openclaw pairing approve ${channel} ${code}`);
  res.json({ ok: ok || out.toLowerCase().includes('approved'), msg: out });
});

// ═══════════════════════════════════════════════════════════════════════════════
// API: Email settings
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/email/settings', requireAuth, async (req, res) => {
  const s = await getEmailSettings(req.hotelId);
  if (!s) return res.json({ configured: false, autoresponder: false });
  res.json({ configured: true, email: s.email, senderName: s.senderName || '', autoresponder: !!autoresponderJobs.get(req.hotelId) });
});

app.post('/api/email/settings', requireAuth, async (req, res) => {
  try {
    const { email, appPassword, senderName } = req.body;
    await fs.mkdir(hotelDir(req.hotelId), { recursive: true });
    await fs.writeFile(hotelPath(req.hotelId, 'email.json'), JSON.stringify({ email, appPassword, senderName }, null, 2));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/email/test', requireAuth, async (req, res) => {
  try {
    const s = await getEmailSettings(req.hotelId);
    if (!s) return res.status(400).json({ error: 'Configura el email primero' });
    await sendEmailMsg(s, s.email, '✅ Test HotelClaw — Conexión exitosa',
      'La conexión con Gmail funciona correctamente. Aria está lista para responder correos automáticamente. 🛎️');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// API: Auto-responder
// ═══════════════════════════════════════════════════════════════════════════════
app.post('/api/email/autoresponder/start', requireAuth, async (req, res) => {
  const { hotelId } = req;
  if (autoresponderJobs.get(hotelId)) return res.json({ ok: true, msg: 'Ya estaba activo' });
  await pollInbox(hotelId);
  autoresponderJobs.set(hotelId, cron.schedule('*/5 * * * *', () => pollInbox(hotelId)));
  res.json({ ok: true, msg: 'Auto-responder activo — revisa cada 5 min' });
});

app.post('/api/email/autoresponder/stop', requireAuth, (req, res) => {
  const job = autoresponderJobs.get(req.hotelId);
  if (job) { job.stop(); autoresponderJobs.delete(req.hotelId); }
  res.json({ ok: true });
});

app.get('/api/email/autoresponder/status', requireAuth, (req, res) => {
  res.json({ active: !!autoresponderJobs.get(req.hotelId) });
});

// ═══════════════════════════════════════════════════════════════════════════════
// API: Contactos Outreach
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/outreach/contacts', requireAuth, async (req, res) => {
  try { res.json(JSON.parse(await fs.readFile(hotelPath(req.hotelId, 'outreach', 'contacts.json'), 'utf-8'))); }
  catch { res.json([]); }
});

app.post('/api/outreach/contacts', requireAuth, async (req, res) => {
  try {
    const r = await importContacts(req.hotelId, req.body.csv || '');
    if (!r.ok) return res.status(400).json(r);
    res.json(r);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/outreach/contacts', requireAuth, async (req, res) => {
  try {
    await fs.writeFile(hotelPath(req.hotelId, 'outreach', 'contacts.json'), '[]');
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// API: Secuencias Outreach
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/outreach/sequences', requireAuth, async (req, res) => {
  try { res.json(JSON.parse(await fs.readFile(hotelPath(req.hotelId, 'outreach', 'sequences.json'), 'utf-8'))); }
  catch { res.json([]); }
});

app.post('/api/outreach/sequences', requireAuth, async (req, res) => {
  try {
    const { name, steps } = req.body;
    if (!name || !steps?.length) return res.status(400).json({ error: 'Nombre y pasos requeridos' });
    res.json(await createSequence(req.hotelId, name, steps));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/outreach/sequences/:id/start', requireAuth, async (req, res) => {
  try {
    const { hotelId } = req;
    const seqPath = hotelPath(hotelId, 'outreach', 'sequences.json');
    const sequences = JSON.parse(await fs.readFile(seqPath, 'utf-8'));
    const seq = sequences.find(s => s.id === req.params.id);
    if (!seq) return res.status(404).json({ error: 'No encontrada' });
    seq.status = 'active';
    await fs.writeFile(seqPath, JSON.stringify(sequences, null, 2));
    if (!outreachJobs.get(hotelId)) {
      outreachJobs.set(hotelId, cron.schedule('0 9 * * *', () => processOutreach(hotelId)));
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/outreach/sequences/:id/stop', requireAuth, async (req, res) => {
  try {
    const seqPath = hotelPath(req.hotelId, 'outreach', 'sequences.json');
    const sequences = JSON.parse(await fs.readFile(seqPath, 'utf-8'));
    const seq = sequences.find(s => s.id === req.params.id);
    if (!seq) return res.status(404).json({ error: 'No encontrada' });
    seq.status = 'paused';
    await fs.writeFile(seqPath, JSON.stringify(sequences, null, 2));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/outreach/sequences/:id', requireAuth, async (req, res) => {
  try {
    const seqPath = hotelPath(req.hotelId, 'outreach', 'sequences.json');
    let sequences = JSON.parse(await fs.readFile(seqPath, 'utf-8'));
    sequences = sequences.filter(s => s.id !== req.params.id);
    await fs.writeFile(seqPath, JSON.stringify(sequences, null, 2));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/outreach/sequences/:id/preview', requireAuth, async (req, res) => {
  try {
    const { hotelId } = req;
    const sequences = JSON.parse(await fs.readFile(hotelPath(hotelId, 'outreach', 'sequences.json'), 'utf-8'));
    const seq = sequences.find(s => s.id === req.params.id);
    if (!seq) return res.status(404).json({ error: 'No encontrada' });
    let contacts = [];
    try { contacts = JSON.parse(await fs.readFile(hotelPath(hotelId, 'outreach', 'contacts.json'), 'utf-8')); } catch {}
    const contact = contacts[0] || { nombre: 'María García', email: 'ejemplo@hotel.com', empresa: 'Hotel de Ejemplo' };
    const nombre  = contact.nombre || contact.name || 'amigo/a';
    const step    = seq.steps[0];
    const body    = await generateWithAria(hotelId,
      'Eres Aria, redactas correos de outreach profesionales y personalizados. Escribe SOLO el cuerpo del correo.',
      `${step.prompt}\n\nDatos del contacto:\n- Nombre: ${nombre}\n- Email: ${contact.email}${contact.empresa ? `\n- Empresa: ${contact.empresa}` : ''}`
    );
    res.json({ ok: true, subject: step.subject.replace(/\{\{nombre\}\}/gi, nombre), body, contact: { nombre, email: contact.email } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/outreach/stats', requireAuth, async (req, res) => {
  res.json(await getOutreachStats(req.hotelId));
});

// ═══════════════════════════════════════════════════════════════════════════════
// Telegram Staff Bot
// ═══════════════════════════════════════════════════════════════════════════════
async function getAdminToken(hotelId) {
  try {
    const creds = JSON.parse(await fs.readFile(hotelPath(hotelId, 'credentials.json'), 'utf-8'));
    return creds.telegramAdminToken || null;
  } catch { return null; }
}

async function getAllowedAdminUsers(hotelId) {
  try {
    const creds = JSON.parse(await fs.readFile(hotelPath(hotelId, 'credentials.json'), 'utf-8'));
    return creds.telegramAdminUsers ? creds.telegramAdminUsers.split(',').map(s => s.trim()) : null;
  } catch { return null; }
}

async function tgCall(token, method, body = {}) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return await r.json();
  } catch (e) { return { ok: false, description: e.message }; }
}

async function tgSend(token, chatId, text, extra = {}) {
  return tgCall(token, 'sendMessage', { chat_id: chatId, text, parse_mode: 'Markdown', ...extra });
}

async function handleAdminMsg(hotelId, token, msg) {
  const chatId = String(msg.chat.id);
  const userId = String(msg.from?.id || '');
  const text   = (msg.text || '').trim();
  const bot    = adminBots.get(hotelId);
  if (!bot) return;

  const allowed = await getAllowedAdminUsers(hotelId);
  if (allowed && !allowed.includes(userId)) {
    await tgSend(token, chatId, `⛔ No autorizado.\n\nTu ID de Telegram es: \`${userId}\`\nPídele al admin que lo agregue en el dashboard.`);
    return;
  }

  // Registrar chatId para reporte matutino
  if (bot.chatIds) bot.chatIds.add(chatId);

  const session = bot.sessions[chatId] || {};

  // /help
  if (text === '/start' || text === '/help' || text === '') {
    await tgSend(token, chatId,
      `🛎️ *HotelClaw Staff Bot*\n\n` +
      `*── Solicitudes y Huéspedes ──*\n` +
      `🎫 /ticket \\<hab\\> \\<descripción\\> — Crear ticket\n` +
      `🔴 /urgente \\<hab\\> \\<descripción\\> — Ticket urgente\n` +
      `📋 /tickets — Ver tickets abiertos\n` +
      `✅ /resolver \\<ID\\> \\[nota\\] — Resolver ticket\n` +
      `👥 /huespedes — Ver huéspedes activos\n` +
      `💬 /pulse \\<nombre\\> — Pulso de satisfacción\n` +
      `🎁 /upsell \\<nombre\\> — Generar oferta personalizada\n\n` +
      `*── Contenido con IA ──*\n` +
      `✍️ /generate \\<instrucción\\> — Generar contenido\n` +
      `⭐ /resena \\<texto\\> — Responder reseña\n` +
      `📱 /post \\<tema\\> — Post para redes sociales\n` +
      `📧 /email \\<tipo de visita\\> — Email de bienvenida\n` +
      `🖼 /imagen \\<desc\\> — Imagen con IA\n` +
      `🎬 /video \\<desc\\> — Video con IA \\(~1 min\\)\n` +
      `📣 /anuncio \\<producto\\> — Copy \\+ imagen\n\n` +
      `*── Información ──*\n` +
      `📊 /status — Estado del sistema\n` +
      `🏨 /servicios — Servicios del hotel\n` +
      `📚 /kb \\<búsqueda\\> — Knowledge Base\n` +
      `🌐 /buscar \\<consulta\\> — Buscar en internet\n` +
      `📤 /outreach — Campaña de outreach\n\n` +
      `Tu Telegram ID: \`${userId}\``
    );
    return;
  }

  // /status
  if (text === '/status') {
    const stats = await getOutreachStats(hotelId);
    await tgSend(token, chatId,
      `📊 *Estado del Sistema*\n\n` +
      `📧 Auto\\-responder: ${autoresponderJobs.get(hotelId) ? '✅ Activo' : '❌ Inactivo'}\n` +
      `🤖 Staff Bot: ✅ Activo\n\n` +
      `👥 Contactos: ${stats.contacts}\n` +
      `📋 Secuencias: ${stats.sequences}\n` +
      `▶ Activas: ${stats.active}\n` +
      `📨 Enviados: ${stats.sent}`
    );
    return;
  }

  // /contacts
  if (text === '/contacts') {
    let contacts = [];
    try { contacts = JSON.parse(await fs.readFile(hotelPath(hotelId, 'outreach', 'contacts.json'), 'utf-8')); } catch {}
    const count   = contacts.length;
    const preview = contacts.slice(0, 5).map(c =>
      `• ${(c.nombre || c.name || '—').replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')} \\<${c.email}\\>`
    ).join('\n');
    await tgSend(token, chatId,
      `👥 *Contactos:* ${count}\n\n${preview}${count > 5 ? `\n_…y ${count - 5} más_` : ''}\n\nUsa /outreach para importar más.`
    );
    return;
  }

  // /sequences
  if (text === '/sequences') {
    let seqs = [];
    try { seqs = JSON.parse(await fs.readFile(hotelPath(hotelId, 'outreach', 'sequences.json'), 'utf-8')); } catch {}
    if (!seqs.length) { await tgSend(token, chatId, '📋 No hay secuencias creadas\\. Usa /outreach para crear una\\.'); return; }
    const list = seqs.map(s =>
      `• *${s.name.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')}* — ${s.status === 'active' ? '▶ Activa' : '⏸ Pausada'} \\(${s.steps?.length || 0} pasos\\)`
    ).join('\n');
    await tgSend(token, chatId, `📋 *Secuencias:*\n\n${list}`);
    return;
  }

  // /generate
  if (text.startsWith('/generate')) {
    const prompt = text.slice(9).trim();
    if (!prompt) { await tgSend(token, chatId, '✍️ Uso: `/generate <instrucción>`'); return; }
    await tgSend(token, chatId, '⏳ Generando con Aria\\.\\.\\.');
    try {
      const result = await generateWithAria(hotelId, 'Eres Aria, asistente de un hotel boutique. Genera el contenido solicitado de forma profesional y elegante.', prompt);
      await tgSend(token, chatId, result.slice(0, 4000));
    } catch (e) { await tgSend(token, chatId, `❌ Error: ${e.message}`); }
    return;
  }

  // /resena
  if (text.startsWith('/resena')) {
    const review = text.slice(7).trim();
    if (!review) { await tgSend(token, chatId, '⭐ Uso: `/resena <texto de la reseña>`'); return; }
    await tgSend(token, chatId, '⏳ Redactando respuesta con Aria\\.\\.\\.');
    try {
      const result = await generateWithAria(hotelId, 'Eres Aria, representante del hotel. Redacta respuestas profesionales y cálidas a reseñas.', `Responde esta reseña:\n\n${review}`);
      await tgSend(token, chatId, result.slice(0, 4000));
    } catch (e) { await tgSend(token, chatId, `❌ Error: ${e.message}`); }
    return;
  }

  // /post
  if (text.startsWith('/post')) {
    const topic = text.slice(5).trim();
    if (!topic) { await tgSend(token, chatId, '📱 Uso: `/post <tema>`'); return; }
    await tgSend(token, chatId, '⏳ Creando post con Aria\\.\\.\\.');
    try {
      const result = await generateWithAria(hotelId, 'Eres Aria, community manager de un hotel boutique de lujo. Redactas posts elegantes para Instagram y Facebook con emojis y hashtags.', `Crea un post sobre: ${topic}`);
      await tgSend(token, chatId, result.slice(0, 4000));
    } catch (e) { await tgSend(token, chatId, `❌ Error: ${e.message}`); }
    return;
  }

  // /email
  if (text.startsWith('/email')) {
    const tipo = text.slice(6).trim();
    if (!tipo) { await tgSend(token, chatId, '📧 Uso: `/email <tipo de huésped>`\n\n`/email luna de miel`\n`/email familia con niños`'); return; }
    await tgSend(token, chatId, '⏳ Generando email con Aria\\.\\.\\.');
    try {
      const result = await generateWithAria(hotelId, 'Eres Aria, concierge virtual del hotel. Redactas emails de bienvenida cálidos, personalizados y elegantes.', `Email de bienvenida para huéspedes que vienen por: ${tipo}`);
      await tgSend(token, chatId, result.slice(0, 4000));
    } catch (e) { await tgSend(token, chatId, `❌ Error: ${e.message}`); }
    return;
  }

  // /imagen
  if (text.startsWith('/imagen')) {
    const desc = text.slice(7).trim();
    if (!desc) { await tgSend(token, chatId, '🖼 Uso: `/imagen <descripción>`\n\n`/imagen suite con vista al mar al atardecer`'); return; }
    await tgSend(token, chatId, '⏳ Generando imagen con fal\\.ai\\.\\.\\.');
    try {
      const imgUrl = await generateImageFal(hotelId, desc);
      await tgCall(token, 'sendPhoto', { chat_id: chatId, photo: imgUrl, caption: `🖼 *${desc}*`, parse_mode: 'Markdown' });
    } catch (e) { await tgSend(token, chatId, `❌ Error: ${e.message}`); }
    return;
  }

  // /video
  if (text.startsWith('/video')) {
    const desc = text.slice(6).trim();
    if (!desc) { await tgSend(token, chatId, '🎬 Uso: `/video <descripción>`\n\n`/video desayuno en terraza al amanecer`'); return; }
    await tgSend(token, chatId, '⏳ Generando video con fal\\.ai\\.\\.\\. \\(puede tardar hasta 2 minutos\\)');
    try {
      const vidUrl = await generateVideoFal(hotelId, desc);
      await tgCall(token, 'sendDocument', { chat_id: chatId, document: vidUrl, caption: `🎬 *${desc}*`, parse_mode: 'Markdown' });
    } catch (e) { await tgSend(token, chatId, `❌ Error: ${e.message}`); }
    return;
  }

  // /anuncio
  if (text.startsWith('/anuncio')) {
    const product = text.slice(8).trim();
    if (!product) { await tgSend(token, chatId, '📣 Uso: `/anuncio <producto o promoción>`\n\n`/anuncio 20% descuento en julio`'); return; }
    await tgSend(token, chatId, '⏳ Generando copy e imagen del anuncio\\.\\.\\.');
    try {
      const [copy, imgUrl] = await Promise.all([
        generateWithAria(hotelId,
          'Eres Aria, experta en marketing hotelero. Redacta copy persuasivo y conciso para un anuncio de hotel boutique de lujo. Máximo 150 palabras. Incluye emojis estratégicos.',
          `Crea un anuncio para: ${product}`),
        generateImageFal(hotelId, `luxury boutique hotel advertisement, ${product}, elegant photography, professional`),
      ]);
      await tgSend(token, chatId, copy.slice(0, 4000));
      await tgCall(token, 'sendPhoto', { chat_id: chatId, photo: imgUrl, caption: `📣 Imagen del anuncio: ${product}` });
    } catch (e) { await tgSend(token, chatId, `❌ Error: ${e.message}`); }
    return;
  }

  // /ticket y /urgente — crear tickets
  if (text.startsWith('/ticket') || text.startsWith('/urgente')) {
    const isUrgent = text.startsWith('/urgente');
    const body = text.slice(isUrgent ? 8 : 7).trim();
    if (!body) {
      await tgSend(token, chatId, `🎫 Uso: \`/ticket 205 No funciona el AC\`\n\`/ticket El lobby necesita limpieza\``);
      return;
    }
    // Intentar extraer número de habitación al inicio
    const roomMatch = body.match(/^(\d{1,4}[A-Za-z]?)\s+(.+)/);
    const room = roomMatch ? roomMatch[1] : '';
    const description = roomMatch ? roomMatch[2] : body;
    const list = await getTickets(hotelId);
    const ticket = {
      id: newTicketId(), description,
      room, guestName: '',
      priority: isUrgent ? 'urgent' : 'normal',
      status: 'pending', source: 'staff_bot',
      createdAt: new Date().toISOString(), resolvedAt: null, notes: '',
    };
    list.push(ticket);
    await saveTickets(hotelId, list);
    const icon = isUrgent ? '🔴' : '🟡';
    await tgSend(token, chatId,
      `${icon} *Ticket creado* \`[${ticket.id}]\`\n\n` +
      `${room ? `Habitación: ${room}\n` : ''}Descripción: ${description}\n` +
      `Prioridad: ${isUrgent ? 'URGENTE' : 'Normal'}\n\n` +
      `Cuando esté resuelto: \`/resolver ${ticket.id}\``
    );
    return;
  }

  // /tickets — listar tickets abiertos
  if (text === '/tickets') {
    const all = await getTickets(hotelId);
    const open = all.filter(t => t.status !== 'resolved');
    if (!open.length) {
      await tgSend(token, chatId, '✅ No hay tickets abiertos. ¡Todo en orden!');
      return;
    }
    const lines = open.map(t => {
      const icon = t.priority === 'urgent' ? '🔴' : t.priority === 'high' ? '🟠' : '🟡';
      const room = t.room ? ` Hab.${t.room}` : '';
      const st   = t.status === 'in_progress' ? ' _[en proceso]_' : '';
      return `${icon} \`[${t.id}]\`${room} ${t.description.slice(0, 50)}${st}`;
    }).join('\n');
    await tgSend(token, chatId,
      `📋 *Tickets abiertos (${open.length}):*\n\n${lines}\n\nResolver: \`/resolver ID\``
    );
    return;
  }

  // /resolver — marcar ticket como resuelto
  if (text.startsWith('/resolver')) {
    const parts = text.slice(9).trim().split(/\s+(.+)/);
    const id    = (parts[0] || '').toUpperCase();
    const note  = parts[1] || '';
    if (!id) { await tgSend(token, chatId, '✅ Uso: `/resolver A3F2` o `/resolver A3F2 Se reparó el AC`'); return; }
    const list = await getTickets(hotelId);
    const t = list.find(t => t.id === id);
    if (!t) { await tgSend(token, chatId, `❌ Ticket \`[${id}]\` no encontrado. Usa /tickets para ver los IDs.`); return; }
    t.status = 'resolved'; t.resolvedAt = new Date().toISOString();
    if (note) t.notes = note;
    await saveTickets(hotelId, list);
    await tgSend(token, chatId,
      `✅ *Ticket \`[${id}]\` resuelto*\n\n${t.description}${note ? `\n\nNota: ${note}` : ''}`
    );
    return;
  }

  // /huespedes — listar huéspedes activos de hoy y futuros próximos
  if (text === '/huespedes') {
    const all = await getGuests(hotelId);
    const today = todayStr();
    const active = all.filter(g => g.active !== false && g.checkout >= today)
      .sort((a, b) => a.checkin.localeCompare(b.checkin));
    if (!active.length) {
      await tgSend(token, chatId, '👥 No hay huéspedes activos. Agrégalos en el dashboard → Huéspedes.');
      return;
    }
    const lines = active.map(g => {
      const inHouse = g.checkin <= today && g.checkout > today;
      const icon = inHouse ? '🏠' : '✈️';
      const pulse = g.pulseStatus === 'sent' ? ' 💬' : '';
      const up    = g.upsellSent ? ' 🎁' : '';
      return `${icon} *${g.name}*${g.room ? ` Hab.${g.room}` : ''} — ${g.checkin}→${g.checkout}${pulse}${up}`;
    }).join('\n');
    await tgSend(token, chatId, `👥 *Huéspedes (${active.length}):*\n\n${lines}\n\n🏠 En el hotel · ✈️ Por llegar\n💬 Pulso enviado · 🎁 Upsell enviado`);
    return;
  }

  // /pulse <nombre> — generar mensaje de pulso para un huésped
  if (text.startsWith('/pulse')) {
    const query = text.slice(6).trim().toLowerCase();
    if (!query) { await tgSend(token, chatId, '💬 Uso: `/pulse María` o `/pulse García`'); return; }
    const guests = await getGuests(hotelId);
    const g = guests.find(g => g.active !== false && g.name.toLowerCase().includes(query));
    if (!g) { await tgSend(token, chatId, `❌ No encontré huésped con nombre "${query}". Usa /huespedes para ver la lista.`); return; }
    await tgSend(token, chatId, `⏳ Generando mensaje de satisfacción para *${g.name}*\\.\\.\\.`);
    try {
      let cfg = {};
      try { cfg = JSON.parse(await fs.readFile(hotelPath(hotelId, 'config.json'), 'utf-8')); } catch {}
      const msg = await generateWithAria(hotelId,
        `Eres Aria, concierge de ${cfg.nombre || 'el hotel'}. Redacta un mensaje corto y cálido (máximo 3 líneas) para preguntar cómo va la estadía. Sin markdown, sin asteriscos.`,
        `Huésped: ${g.name}. Tipo de visita: ${VISIT_LABELS[g.type] || g.type}.`,
        { searchWeb: false }
      );
      const list = await getGuests(hotelId);
      const gr = list.find(x => x.id === g.id);
      if (gr) { gr.pulseStatus = 'sent'; gr.pulseSentAt = new Date().toISOString(); }
      await saveGuests(hotelId, list);
      await tgSend(token, chatId,
        `💬 *Pulso para ${g.name}*${g.room ? ` (Hab. ${g.room})` : ''}:\n\n_${msg}_\n\n` +
        `Copia y envía por ${g.channel === 'telegram' ? 'Telegram' : 'WhatsApp'}.\nLuego registra la respuesta:\n` +
        `• /positivo ${g.id.slice(-4)} — Feliz con su estadía\n` +
        `• /queja ${g.id.slice(-4)} <descripción> — Tiene un problema`
      );
    } catch (e) { await tgSend(token, chatId, `❌ Error: ${e.message}`); }
    return;
  }

  // /positivo y /queja — registrar respuesta del pulso
  if (text.startsWith('/positivo') || text.startsWith('/queja')) {
    const isPositive = text.startsWith('/positivo');
    const parts = text.split(/\s+/);
    const shortId = (parts[1] || '').toUpperCase();
    const complaint = isPositive ? '' : parts.slice(2).join(' ');
    const guests = await getGuests(hotelId);
    const g = guests.find(g => g.id.toUpperCase().endsWith(shortId) || g.id.slice(-4).toUpperCase() === shortId);
    if (!g) { await tgSend(token, chatId, `❌ No encontré huésped con ID "${shortId}". Usa /huespedes.`); return; }
    g.pulseStatus = isPositive ? 'positive' : 'negative';
    await saveGuests(hotelId, guests);
    if (isPositive) {
      await tgSend(token, chatId,
        `⭐ *${g.name} está satisfecho/a*\n\nCuando haga checkout, usa /resena para pedirle una reseña de Google.`
      );
    } else {
      // Crear ticket automático por queja
      const desc = complaint || `Feedback negativo del pulso de satisfacción de ${g.name}`;
      const tickets = await getTickets(hotelId);
      const ticket = {
        id: newTicketId(), description: desc,
        room: g.room, guestName: g.name,
        priority: 'high', status: 'pending',
        source: 'pulse', createdAt: new Date().toISOString(), resolvedAt: null, notes: '',
      };
      tickets.push(ticket);
      await saveTickets(hotelId, tickets);
      await tgSend(token, chatId,
        `🔴 *Queja registrada — Ticket \`[${ticket.id}]\`*\n\n` +
        `Huésped: ${g.name}${g.room ? ` (Hab. ${g.room})` : ''}\n` +
        `Problema: ${desc}\n\n` +
        `¡Atender antes del checkout (${g.checkout})!\nResolver: \`/resolver ${ticket.id}\``
      );
    }
    return;
  }

  // /upsell <nombre> — generar oferta personalizada
  if (text.startsWith('/upsell')) {
    const query = text.slice(7).trim().toLowerCase();
    if (!query) { await tgSend(token, chatId, '🎁 Uso: `/upsell María` o `/upsell García`'); return; }
    const guests = await getGuests(hotelId);
    const g = guests.find(g => g.active !== false && g.name.toLowerCase().includes(query));
    if (!g) { await tgSend(token, chatId, `❌ No encontré huésped "${query}". Usa /huespedes.`); return; }
    await tgSend(token, chatId, `⏳ Generando oferta para *${g.name}* \\(${VISIT_LABELS[g.type] || g.type}\\)\\.\\.\\.`);
    try {
      const services = (await getServices(hotelId)).filter(s => s.active !== false);
      let cfg = {};
      try { cfg = JSON.parse(await fs.readFile(hotelPath(hotelId, 'config.json'), 'utf-8')); } catch {}
      const svcList = services.map(s => `- ${s.name}${s.price ? ` (${s.price})` : ''}`).join('\n') || 'Servicios generales';
      const msg = await generateWithAria(hotelId,
        `Eres Aria, concierge de ${cfg.nombre || 'el hotel'}. Redacta un mensaje de WhatsApp corto (máximo 4 líneas), cálido y personalizado para ofrecer un servicio adicional. Sin markdown, sin asteriscos.`,
        `Huésped: ${g.name}. Tipo: ${VISIT_LABELS[g.type]}. Notas: ${g.notes || 'ninguna'}.\n\nServicios:\n${svcList}`,
        { searchWeb: false }
      );
      const list = await getGuests(hotelId);
      const gr = list.find(x => x.id === g.id);
      if (gr) gr.upsellSent = true;
      await saveGuests(hotelId, list);
      await tgSend(token, chatId,
        `🎁 *Upsell para ${g.name}* \\(${VISIT_LABELS[g.type] || g.type}\\):\n\n_${msg}_\n\nCopia y envía por ${g.channel === 'telegram' ? 'Telegram' : 'WhatsApp'}.`
      );
    } catch (e) { await tgSend(token, chatId, `❌ Error: ${e.message}`); }
    return;
  }

  // /precheckin <nombre> — generar mensaje pre-llegada
  if (text.startsWith('/precheckin')) {
    const query = text.slice(11).trim().toLowerCase();
    if (!query) { await tgSend(token, chatId, '✈️ Uso: `/precheckin María` o `/precheckin García`'); return; }
    const guests = await getGuests(hotelId);
    const today  = todayStr();
    const g = guests.find(g => g.active !== false && g.checkout >= today && g.name.toLowerCase().includes(query));
    if (!g) { await tgSend(token, chatId, `❌ No encontré huésped activo con nombre "${query}". Usa /huespedes para ver la lista.`); return; }
    await tgSend(token, chatId, `⏳ Generando mensaje pre check\\-in para *${g.name}*\\.\\.\\.`);
    try {
      let h = {};
      try { h = JSON.parse(await fs.readFile(hotelPath(hotelId, 'hotel-data.json'), 'utf-8')); } catch {}
      const msg = await generateWithAria(hotelId,
        `Eres Aria, concierge de ${h.nombre || 'el hotel'}. Redacta un mensaje de bienvenida previo al check-in: cálido, elegante, máximo 5 líneas. Sin markdown.`,
        `Huésped: ${g.name}. Tipo de visita: ${VISIT_LABELS[g.type] || g.type}. Check-in: ${g.checkin}. Check-out: ${g.checkout}. Hora check-in: ${h.checkin || '3:00 PM'}. WiFi: ${h.wifi_ssid || '(se entrega al llegar)'}.`,
        { searchWeb: false }
      );
      const list = await getGuests(hotelId);
      const gr = list.find(x => x.id === g.id);
      if (gr) gr.precheckinSent = true;
      await saveGuests(hotelId, list);
      await tgSend(token, chatId,
        `✈️ *Pre Check\\-in para ${g.name.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')}*${g.room ? ` \\(Hab\\. ${g.room}\\)` : ''}:\n\n_${msg}_\n\nCopia y envía por ${g.channel === 'telegram' ? 'Telegram' : 'WhatsApp'}.`
      );
    } catch (e) { await tgSend(token, chatId, `❌ Error: ${e.message}`); }
    return;
  }

  // /reseña <nombre> — generar solicitud de reseña post-estadía
  if (text.startsWith('/reseña') || text.startsWith('/resena2')) {
    const query = text.startsWith('/reseña') ? text.slice(7).trim().toLowerCase() : text.slice(8).trim().toLowerCase();
    if (!query) { await tgSend(token, chatId, '⭐ Uso: `/reseña María` — solicitar reseña a huésped que ya hizo checkout'); return; }
    const guests = await getGuests(hotelId);
    const today  = todayStr();
    const g = guests.find(g => g.checkout <= today && g.name.toLowerCase().includes(query));
    if (!g) { await tgSend(token, chatId, `❌ No encontré huésped con checkout reciente con nombre "${query}".`); return; }
    await tgSend(token, chatId, `⏳ Generando solicitud de reseña para *${g.name.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')}*\\.\\.\\.`);
    try {
      let cfg = {};
      try { cfg = JSON.parse(await fs.readFile(hotelPath(hotelId, 'config.json'), 'utf-8')); } catch {}
      const msg = await generateWithAria(hotelId,
        `Eres Aria, concierge de ${cfg.nombre || 'el hotel'}. Redacta un mensaje post-estadía para solicitar una reseña: agradecido, cálido, máximo 4 líneas. Sin markdown.`,
        `Huésped: ${g.name}. Tipo de visita: ${VISIT_LABELS[g.type] || g.type}. Check-out: ${g.checkout}.`,
        { searchWeb: false }
      );
      const list = await getGuests(hotelId);
      const gr = list.find(x => x.id === g.id);
      if (gr) { gr.reviewStatus = 'sent'; gr.reviewSentAt = new Date().toISOString(); }
      await saveGuests(hotelId, list);
      await tgSend(token, chatId,
        `⭐ *Solicitud de reseña para ${g.name.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')}*:\n\n_${msg}_\n\nCopia y envía por ${g.channel === 'telegram' ? 'Telegram' : 'WhatsApp'}.`
      );
    } catch (e) { await tgSend(token, chatId, `❌ Error: ${e.message}`); }
    return;
  }

  // /habitaciones — resumen tablero de habitaciones
  if (text === '/habitaciones' || text === '/rooms') {
    const rooms = await getRooms(hotelId);
    if (!rooms.length) { await tgSend(token, chatId, '🏨 No hay habitaciones configuradas\\. Agrégalas en el dashboard → Habitaciones\\.'); return; }
    const byStatus = { libre: [], ocupada: [], limpieza: [], mantenimiento: [] };
    for (const r of rooms) (byStatus[r.status] || byStatus.libre).push(r.number);
    let msg = '*🏨 Estado de Habitaciones*\n\n';
    if (byStatus.ocupada.length)       msg += `🔴 *Ocupadas \\(${byStatus.ocupada.length}\\):* ${byStatus.ocupada.map(n => n.replace(/[_*[\]()~\`>#+=|{}.!-]/g, '\\$&')).join(', ')}\n`;
    if (byStatus.libre.length)         msg += `🟢 *Libres \\(${byStatus.libre.length}\\):* ${byStatus.libre.map(n => n.replace(/[_*[\]()~\`>#+=|{}.!-]/g, '\\$&')).join(', ')}\n`;
    if (byStatus.limpieza.length)      msg += `🧹 *Limpieza \\(${byStatus.limpieza.length}\\):* ${byStatus.limpieza.map(n => n.replace(/[_*[\]()~\`>#+=|{}.!-]/g, '\\$&')).join(', ')}\n`;
    if (byStatus.mantenimiento.length) msg += `🔧 *Mantenimiento \\(${byStatus.mantenimiento.length}\\):* ${byStatus.mantenimiento.map(n => n.replace(/[_*[\]()~\`>#+=|{}.!-]/g, '\\$&')).join(', ')}\n`;
    msg += `\n_Total: ${rooms.length} habitaciones_`;
    await tgSend(token, chatId, msg);
    return;
  }

  // /servicios
  if (text === '/servicios') {
    const services = (await getServices(hotelId)).filter(s => s.active !== false);
    if (!services.length) {
      await tgSend(token, chatId, '🏨 No hay servicios configurados\\. Agrégalos en el dashboard → Servicios\\.');
      return;
    }
    const lines = services.map(s => {
      const cat = (SERVICE_CATEGORIES[s.category] || s.category || 'Servicio').replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
      const name = s.name.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
      let line = `• *${name}* \\(${cat}\\)`;
      if (s.price) line += ` — ${s.price.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')}`;
      return line;
    }).join('\n');
    await tgSend(token, chatId, `🏨 *Servicios del hotel:*\n\n${lines}\n\nGestiona los servicios en el dashboard → Servicios\\.`);
    return;
  }

  // /buscar
  if (text.startsWith('/buscar')) {
    const query = text.slice(7).trim();
    if (!query) { await tgSend(token, chatId, '🌐 Uso: `/buscar <consulta>`\n\n`/buscar restaurantes italianos en el centro`\n`/buscar tours de un día desde Cartagena`'); return; }
    await tgSend(token, chatId, '🌐 Buscando en internet\\.\\.\\.');
    try {
      const results = await webSearch(query);
      if (!results) { await tgSend(token, chatId, '🌐 No encontré resultados para esa búsqueda\\.'); return; }
      const summary = await generateWithAria(hotelId,
        'Eres Aria, concierge de un hotel boutique. Con base en los resultados de búsqueda, da una respuesta útil y organizada al staff del hotel. Sé conciso.',
        `Búsqueda: "${query}"\n\nResultados web:\n${results}`,
        { searchWeb: false } // ya pasamos los resultados manualmente
      );
      await tgSend(token, chatId, `🌐 *Resultados para: "${query.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')}"*\n\n${summary.slice(0, 3800)}`);
    } catch (e) { await tgSend(token, chatId, `❌ Error: ${e.message}`); }
    return;
  }

  // /kb
  if (text.startsWith('/kb')) {
    const query = text.slice(3).trim();
    if (!query) { await tgSend(token, chatId, '📚 Uso: `/kb <búsqueda>`\n\n`/kb piscina`\n`/kb política de cancelación`'); return; }
    try {
      const chunks = await getKBChunks(hotelId);
      if (!chunks.length) { await tgSend(token, chatId, '📚 El Knowledge Base está vacío\\. Sube documentos desde el dashboard → Knowledge Base\\.'); return; }
      const ctx = await getKBContext(hotelId, query, 3);
      if (!ctx) { await tgSend(token, chatId, `📚 No encontré nada relevante para "_${query.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')}_" en el KB\\.`); return; }
      const safe = ctx.slice(0, 3500).replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
      await tgSend(token, chatId, `📚 *Resultados en KB para "${query.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')}":*\n\n${safe}`);
    } catch (e) { await tgSend(token, chatId, `❌ Error: ${e.message}`); }
    return;
  }

  // Wizard /outreach
  if (text === '/outreach') {
    bot.sessions[chatId] = { step: 'csv' };
    await tgSend(token, chatId,
      `📤 *Nueva campaña de outreach*\n\n` +
      `*Paso 1/3:* Envía la lista de contactos en CSV \\(pégalo como texto\\):\n\n` +
      `\`\`\`\nnombre,email,empresa,cargo\nMaría García,maria@hotel.com,Hotel Plaza,Directora\n\`\`\``
    );
    return;
  }

  if (session.step === 'csv') {
    if (!text.includes(',') || !text.includes('\n')) {
      await tgSend(token, chatId, '❌ No detecté un CSV válido\\. Envía /outreach para reintentar\\.');
      delete bot.sessions[chatId]; return;
    }
    const r = await importContacts(hotelId, text);
    if (r.ok) {
      bot.sessions[chatId] = { step: 'name', added: r.added, total: r.total };
      await tgSend(token, chatId,
        `✅ *${r.added} contactos importados* \\(total: ${r.total}\\)\n\n` +
        `*Paso 2/3:* ¿Cómo se llama esta campaña?\n\n_Ej: "Prospección hoteleros CDMX Q1 2026"_`
      );
    } else {
      await tgSend(token, chatId, `❌ Error: ${r.error}`);
      delete bot.sessions[chatId];
    }
    return;
  }

  if (session.step === 'name' && text && !text.startsWith('/')) {
    bot.sessions[chatId] = { ...session, step: 'desc', name: text };
    await tgSend(token, chatId,
      `✅ Campaña: *${text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')}*\n\n` +
      `*Paso 3/3:* Describe la secuencia\\. Aria la estructurará automáticamente\\.\n\n` +
      `_Ej: "3 pasos: Día 0 presentación, Día 4 follow\\-up, Día 8 propuesta de demo"_`
    );
    return;
  }

  if (session.step === 'desc' && text && !text.startsWith('/')) {
    await tgSend(token, chatId, '⏳ Creando la secuencia con Aria\\.\\.\\.');
    try {
      const raw = await generateWithAria(hotelId,
        `Eres experto en email marketing para hoteles boutique. Genera una secuencia de outreach en JSON puro, sin markdown ni explicaciones.
Formato exacto:
[{"dayOffset":0,"subject":"asunto aquí","prompt":"instrucción de redacción aquí"},...]
"dayOffset" es el día de envío desde el inicio. "subject" puede usar {{nombre}}. "prompt" describe en 2-3 oraciones qué redactar.`,
        `Crea la secuencia basada en: "${text}"\nAudiencia: directores y gerentes de hoteles boutique.`
      );
      let steps;
      try { steps = JSON.parse(raw.trim()); }
      catch { const m = raw.match(/\[[\s\S]+?\]/); steps = m ? JSON.parse(m[0]) : null; }
      if (!steps?.length) throw new Error('No se pudo generar la estructura JSON');
      const r = await createSequence(hotelId, session.name, steps);
      if (!r.ok) throw new Error(r.error || 'Error al guardar');
      const summary = steps.map((s, i) =>
        `${i + 1}\\. Día ${s.dayOffset}: _${s.subject.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')}_`
      ).join('\n');
      await tgSend(token, chatId,
        `✅ *Secuencia creada:*\n\n${summary}\n\n` +
        `Actívala desde el dashboard → Email & Outreach → Secuencias\\.`
      );
      delete bot.sessions[chatId];
    } catch (e) {
      await tgSend(token, chatId, `❌ Error: ${e.message}`);
      delete bot.sessions[chatId];
    }
    return;
  }

  if (!text.startsWith('/')) return;
  await tgSend(token, chatId, 'Comando no reconocido\\. Usa /help para ver los comandos disponibles\\.');
}

async function pollAdminBot(hotelId) {
  const bot = adminBots.get(hotelId);
  if (!bot?.running) return;
  const token = await getAdminToken(hotelId);
  if (!token) return;
  try {
    const r = await tgCall(token, 'getUpdates', { offset: bot.offset, timeout: 10, allowed_updates: ['message'] });
    if (!r.ok || !r.result?.length) return;
    for (const update of r.result) {
      bot.offset = update.update_id + 1;
      if (update.message) handleAdminMsg(hotelId, token, update.message).catch(e => console.error(`[StaffBot:${hotelId}]`, e.message));
    }
  } catch (e) { console.error(`[StaffBot:${hotelId}] Poll error:`, e.message); }
}

async function startAdminBot(hotelId) {
  const token = await getAdminToken(hotelId);
  if (!token) return false;
  const existing = adminBots.get(hotelId);
  if (existing?.intervalId) clearInterval(existing.intervalId);
  const bot = { running: true, offset: 0, sessions: {}, chatIds: new Set() };
  bot.intervalId = setInterval(() => pollAdminBot(hotelId), 3000);
  adminBots.set(hotelId, bot);
  console.log(`[StaffBot:${hotelId}] ✅ Bot de Staff activo`);
  return true;
}

// ─── API: Staff Bot ───────────────────────────────────────────────────────────
app.post('/api/staffbot/start', requireAuth, async (req, res) => {
  const { hotelId } = req;
  if (adminBots.get(hotelId)?.running) return res.json({ ok: true, msg: 'Ya estaba activo' });
  const started = await startAdminBot(hotelId);
  res.json({ ok: started, msg: started ? 'Staff Bot iniciado' : 'No se encontró token de Telegram Admin' });
});

app.post('/api/staffbot/stop', requireAuth, (req, res) => {
  const { hotelId } = req;
  const bot = adminBots.get(hotelId);
  if (bot) { bot.running = false; if (bot.intervalId) clearInterval(bot.intervalId); adminBots.delete(hotelId); }
  res.json({ ok: true });
});

app.get('/api/staffbot/status', requireAuth, (req, res) => {
  res.json({ active: !!adminBots.get(req.hotelId)?.running });
});

app.post('/api/staffbot/credentials', requireAuth, async (req, res) => {
  try {
    const { adminToken, adminUsers } = req.body;
    let creds = {};
    try { creds = JSON.parse(await fs.readFile(hotelPath(req.hotelId, 'credentials.json'), 'utf-8')); } catch {}
    if (adminToken !== undefined) creds.telegramAdminToken = adminToken;
    if (adminUsers !== undefined) creds.telegramAdminUsers = adminUsers;
    await fs.mkdir(hotelDir(req.hotelId), { recursive: true });
    await fs.writeFile(hotelPath(req.hotelId, 'credentials.json'), JSON.stringify(creds, null, 2));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/staffbot/credentials', requireAuth, async (req, res) => {
  try {
    const creds = JSON.parse(await fs.readFile(hotelPath(req.hotelId, 'credentials.json'), 'utf-8'));
    const t = creds.telegramAdminToken || '';
    res.json({ tokenSet: !!t, tokenHint: t ? t.slice(0, 12) + '...' : '', users: creds.telegramAdminUsers || '' });
  } catch { res.json({ tokenSet: false, tokenHint: '', users: '' }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Rutas públicas: Menú Digital (sin auth)
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/menu/:hotelId', async (req, res) => {
  try {
    const { hotelId } = req.params;
    let h = {};
    try { h = JSON.parse(await fs.readFile(hotelPath(hotelId, 'hotel-data.json'), 'utf-8')); } catch {}
    const items     = await getMenu(hotelId);
    const hotelName = h.nombre || 'Menú del Hotel';
    const catOrder  = ['entrada', 'principal', 'postre', 'bebida', 'especial', 'otro'];
    const byCategory = {};
    for (const item of items.filter(i => i.available !== false)) {
      const cat = item.category || 'otro';
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(item);
    }
    const menuHtml = catOrder.filter(cat => byCategory[cat]?.length).map(cat => {
      const catName = MENU_CATEGORIES[cat] || cat;
      const rows = byCategory[cat].map(item => {
        const img = item.images?.[0]
          ? `<img src="/menu/${hotelId}/img/${item.images[0].filename}" style="width:80px;height:60px;object-fit:cover;border-radius:8px;margin-right:14px;flex-shrink:0"/>`
          : '';
        const allergens = item.allergens ? `<div style="font-size:.7rem;color:#999;margin-top:4px">⚠️ ${item.allergens}</div>` : '';
        return `<div style="display:flex;align-items:center;padding:14px 0;border-bottom:1px solid #f0ece4">
          ${img}
          <div style="flex:1">
            <div style="font-weight:600;font-size:.95rem">${item.name}</div>
            ${item.description ? `<div style="font-size:.82rem;color:#666;margin-top:2px">${item.description}</div>` : ''}
            ${allergens}
          </div>
          ${item.price ? `<div style="font-weight:700;color:#C9A96E;white-space:nowrap;margin-left:14px">${item.price}</div>` : ''}
        </div>`;
      }).join('');
      return `<div style="margin-bottom:32px">
        <h2 style="font-family:'Georgia',serif;color:#1C1C2E;font-size:1.2rem;border-bottom:2px solid #C9A96E;padding-bottom:8px;margin-bottom:0">${catName}</h2>
        ${rows}
      </div>`;
    }).join('') || '<p style="text-align:center;color:#9CA3AF;padding:40px 0">Menú no disponible en este momento.</p>';

    const html = `<!DOCTYPE html><html lang="es">
<head>
  <meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${hotelName} — Menú</title>
  <style>
    body{font-family:'Helvetica Neue',sans-serif;background:#F7F5F0;color:#2D2D2D;margin:0;padding:0}
    .header{background:#1C1C2E;color:#C9A96E;text-align:center;padding:32px 20px}
    .header h1{font-family:'Georgia',serif;margin:0;font-size:1.8rem}
    .header p{margin:6px 0 0;color:rgba(255,255,255,.6);font-size:.85rem}
    .menu{max-width:680px;margin:0 auto;padding:32px 20px}
    .footer{text-align:center;padding:24px;font-size:.75rem;color:#9CA3AF;border-top:1px solid #E5E2DA;margin-top:32px}
  </style>
</head>
<body>
  <div class="header"><h1>${hotelName}</h1><p>Menú Digital</p></div>
  <div class="menu">${menuHtml}</div>
  <div class="footer">Powered by HotelClaw · Menú digital generado automáticamente</div>
</body></html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) { res.status(500).send('Error al cargar el menú'); }
});

app.get('/menu/:hotelId/img/:filename', async (req, res) => {
  const imgPath = hotelPath(req.params.hotelId, 'menu-images', req.params.filename);
  try { await fs.access(imgPath); res.sendFile(imgPath); }
  catch { res.status(404).send('Imagen no encontrada'); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// API: Menú Digital (auth)
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/menu/qr', requireAuth, async (req, res) => {
  const menuUrl = `http://localhost:3000/menu/${req.hotelId}`;
  const qrUrl   = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(menuUrl)}`;
  res.json({ ok: true, qrUrl, menuUrl });
});

app.get('/api/menu', requireAuth, async (req, res) => {
  try { res.json(await getMenu(req.hotelId)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/menu', requireAuth, async (req, res) => {
  try {
    const { name, category, description, price, allergens } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Nombre requerido' });
    const list = await getMenu(req.hotelId);
    const item = {
      id: `mi_${uuidv4().slice(0, 8)}`,
      name, category: category || 'otro',
      description: description || '', price: price || '',
      allergens: allergens || '', available: true,
      images: [], createdAt: new Date().toISOString(),
    };
    list.push(item);
    await saveMenu(req.hotelId, list);
    res.json({ ok: true, item });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/menu/:id', requireAuth, async (req, res) => {
  try {
    const list = await getMenu(req.hotelId);
    const idx  = list.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Ítem no encontrado' });
    ['name','category','description','price','allergens','available'].forEach(k => {
      if (req.body[k] !== undefined) list[idx][k] = req.body[k];
    });
    await saveMenu(req.hotelId, list);
    res.json({ ok: true, item: list[idx] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/menu/:id', requireAuth, async (req, res) => {
  try {
    let list = await getMenu(req.hotelId);
    const item = list.find(i => i.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Ítem no encontrado' });
    for (const img of item.images || []) {
      try { await fs.unlink(hotelPath(req.hotelId, 'menu-images', img.filename)); } catch {}
    }
    list = list.filter(i => i.id !== req.params.id);
    await saveMenu(req.hotelId, list);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/menu/:id/image', requireAuth, upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'Archivo requerido' });
  try {
    const list = await getMenu(req.hotelId);
    const item = list.find(i => i.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Ítem no encontrado' });
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.jpg','.jpeg','.png','.webp'].includes(ext))
      return res.status(400).json({ error: 'Solo JPG, PNG o WEBP' });
    const imgDir  = hotelPath(req.hotelId, 'menu-images');
    await fs.mkdir(imgDir, { recursive: true });
    const filename = `menu_${req.params.id}_${uuidv4().slice(0, 8)}${ext}`;
    await fs.rename(file.path, path.join(imgDir, filename));
    item.images = item.images || [];
    item.images.push({ filename });
    await saveMenu(req.hotelId, list);
    res.json({ ok: true, filename });
  } catch (e) {
    try { await fs.unlink(file.path); } catch {}
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/menu/:id/image/:filename', requireAuth, async (req, res) => {
  try {
    const list = await getMenu(req.hotelId);
    const item = list.find(i => i.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Ítem no encontrado' });
    item.images = (item.images || []).filter(i => i.filename !== req.params.filename);
    try { await fs.unlink(hotelPath(req.hotelId, 'menu-images', req.params.filename)); } catch {}
    await saveMenu(req.hotelId, list);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/menu/image/:filename — servir imagen de menú (auth, para dashboard)
app.get('/api/menu/image/:filename', requireAuth, async (req, res) => {
  const imgPath = hotelPath(req.hotelId, 'menu-images', req.params.filename);
  try { await fs.access(imgPath); res.sendFile(imgPath); }
  catch { res.status(404).json({ error: 'Imagen no encontrada' }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Tablero de Habitaciones — CRUD
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/rooms', requireAuth, async (req, res) => {
  try { res.json(await getRooms(req.hotelId)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/rooms', requireAuth, async (req, res) => {
  try {
    const { number, type = 'doble', floor = '', notes = '' } = req.body;
    if (!number) return res.status(400).json({ error: 'number requerido' });
    const list = await getRooms(req.hotelId);
    if (list.some(r => r.number === String(number).trim()))
      return res.status(400).json({ error: `Habitación ${number} ya existe` });
    const room = {
      id: uuidv4(), number: String(number).trim(), type,
      floor: String(floor).trim(), status: 'libre',
      notes: String(notes).trim(), updatedAt: new Date().toISOString(),
    };
    list.push(room);
    await saveRooms(req.hotelId, list);
    res.json({ ok: true, room });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/rooms/:id', requireAuth, async (req, res) => {
  try {
    const list = await getRooms(req.hotelId);
    const idx  = list.findIndex(r => r.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'No encontrada' });
    const { number, type, floor, status, notes } = req.body;
    if (number !== undefined) list[idx].number = String(number).trim();
    if (type   !== undefined) list[idx].type   = type;
    if (floor  !== undefined) list[idx].floor  = String(floor).trim();
    if (status !== undefined) list[idx].status = status;
    if (notes  !== undefined) list[idx].notes  = String(notes).trim();
    list[idx].updatedAt = new Date().toISOString();
    await saveRooms(req.hotelId, list);
    res.json({ ok: true, room: list[idx] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/rooms/:id', requireAuth, async (req, res) => {
  try {
    const list     = await getRooms(req.hotelId);
    const filtered = list.filter(r => r.id !== req.params.id);
    if (filtered.length === list.length) return res.status(404).json({ error: 'No encontrada' });
    await saveRooms(req.hotelId, filtered);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Chat Web de Huéspedes — rutas públicas (sin auth)
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/chat/:hotelId', async (req, res) => {
  const { hotelId } = req.params;
  let h = {};
  try { h = JSON.parse(await fs.readFile(hotelPath(hotelId, 'hotel-data.json'), 'utf-8')); } catch {}
  const hotelName = (h.nombre || 'Hotel').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  res.type('html').send(`<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Chat — ${hotelName}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;font-family:'Segoe UI',sans-serif}
body{background:#f4f0e8;display:flex;flex-direction:column;height:100vh}
.header{background:#1C1C2E;color:#C9A96E;padding:16px 20px;font-size:1.05rem;font-weight:600;text-align:center}
.messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}
.msg{max-width:76%;padding:10px 14px;border-radius:16px;font-size:.88rem;line-height:1.45;word-break:break-word}
.msg.guest{background:#fff;border:1px solid #e0dbd0;align-self:flex-start;border-bottom-left-radius:4px}
.msg.staff{background:#1C1C2E;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
.msg-time{font-size:.68rem;color:rgba(0,0,0,.35);margin-top:4px}
.msg.staff .msg-time{color:rgba(255,255,255,.4)}
.input-area{background:#fff;border-top:1px solid #e0dbd0;padding:12px 16px;display:flex;gap:10px}
.input-area input{flex:1;padding:10px 14px;border:1px solid #ddd;border-radius:20px;font-size:.88rem;outline:none}
.input-area input:focus{border-color:#C9A96E}
.send-btn{background:#C9A96E;color:#1C1C2E;border:none;padding:10px 20px;border-radius:20px;font-weight:700;cursor:pointer}
.start-wrap{flex:1;display:flex;align-items:center;justify-content:center;padding:32px}
.start-card{background:#fff;border-radius:18px;padding:32px 24px;max-width:360px;width:100%;box-shadow:0 4px 20px rgba(0,0,0,.08)}
.start-card h2{color:#1C1C2E;font-size:1.15rem;margin-bottom:8px}
.start-card p{color:#666;font-size:.84rem;margin-bottom:20px}
.start-card input{width:100%;padding:11px 14px;border:1px solid #ddd;border-radius:10px;font-size:.9rem;outline:none;margin-bottom:12px}
.start-card input:focus{border-color:#C9A96E}
.start-card button{width:100%;background:#C9A96E;color:#1C1C2E;border:none;padding:12px;border-radius:10px;font-weight:700;cursor:pointer;font-size:.95rem}
#chat-view{display:none;flex:1;flex-direction:column}
</style></head>
<body>
<div class="header">💬 ${hotelName}</div>
<div id="start-wrap" class="start-wrap">
  <div class="start-card">
    <h2>¡Hola! 👋</h2>
    <p>Escríbenos, estamos aquí para ayudarte.</p>
    <input id="guest-name" placeholder="Tu nombre" maxlength="60" onkeydown="if(event.key==='Enter')startChat()"/>
    <button onclick="startChat()">Iniciar conversación</button>
  </div>
</div>
<div id="chat-view">
  <div id="messages" class="messages"></div>
  <div class="input-area">
    <input id="msg-input" placeholder="Escribe tu mensaje..." maxlength="500" onkeydown="if(event.key==='Enter')sendMsg()"/>
    <button class="send-btn" onclick="sendMsg()">Enviar</button>
  </div>
</div>
<script>
const HID='${hotelId}';
let SESSION=localStorage.getItem('hc_chat_${hotelId}');
let lastTs=0,pollTmr;
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function fmtTime(ts){return new Date(ts).toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'});}
function appendMsg(m){
  const d=document.createElement('div');d.className='msg '+m.from;
  d.innerHTML='<div>'+esc(m.text)+'</div><div class="msg-time">'+fmtTime(m.ts)+'</div>';
  const msgs=document.getElementById('messages');msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;
  lastTs=Math.max(lastTs,new Date(m.ts).getTime());
}
async function startChat(){
  const n=document.getElementById('guest-name').value.trim();
  if(!n){alert('Por favor ingresa tu nombre');return;}
  const r=await fetch('/chat/'+HID+'/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({guestName:n})});
  const d=await r.json();
  if(!d.sessionId){alert('Error al conectar, intenta más tarde');return;}
  SESSION=d.sessionId;localStorage.setItem('hc_chat_'+HID,SESSION);showChatView();
}
function showChatView(){
  document.getElementById('start-wrap').style.display='none';
  const cv=document.getElementById('chat-view');cv.style.display='flex';cv.style.flexDirection='column';cv.style.flex='1';
  poll();
}
async function poll(){
  if(!SESSION)return;
  try{const r=await fetch('/chat/'+HID+'/poll?session='+SESSION+'&since='+lastTs);const d=await r.json();if(d.messages)d.messages.forEach(appendMsg);}catch{}
  pollTmr=setTimeout(poll,5000);
}
async function sendMsg(){
  const inp=document.getElementById('msg-input');const txt=inp.value.trim();if(!txt||!SESSION)return;inp.value='';
  const r=await fetch('/chat/'+HID+'/msg',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:SESSION,text:txt})});
  const d=await r.json();if(d.msg)appendMsg(d.msg);
}
if(SESSION){document.getElementById('start-wrap').style.display='none';showChatView();fetch('/chat/'+HID+'/poll?session='+SESSION+'&since=0').then(r=>r.json()).then(d=>{if(d.messages)d.messages.forEach(appendMsg);});}
</script></body></html>`);
});

app.post('/chat/:hotelId/start', async (req, res) => {
  try {
    const { hotelId } = req.params;
    const { guestName } = req.body;
    if (!guestName) return res.status(400).json({ error: 'guestName requerido' });
    const chats   = await getChats(hotelId);
    const session = {
      id: uuidv4(), guestName: String(guestName).trim(),
      messages: [], status: 'open', unread: 0,
      createdAt: new Date().toISOString(), lastAt: new Date().toISOString(),
    };
    chats.push(session);
    await saveChats(hotelId, chats);
    // Notify staff via Telegram
    const token = await getAdminToken(hotelId);
    const bot   = adminBots.get(hotelId);
    if (token && bot?.running) {
      const cids = [...(bot.chatIds || new Set())];
      for (const cid of cids) {
        await tgSend(token, cid,
          `💬 *Nueva consulta web* de *${session.guestName.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&')}*\n` +
          `Responde en Dashboard → Chat Web\\.`
        );
      }
    }
    res.json({ sessionId: session.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/chat/:hotelId/msg', async (req, res) => {
  try {
    const { hotelId } = req.params;
    const { sessionId, text } = req.body;
    if (!sessionId || !text) return res.status(400).json({ error: 'sessionId y text requeridos' });
    const chats = await getChats(hotelId);
    const idx   = chats.findIndex(c => c.id === sessionId);
    if (idx < 0) return res.status(404).json({ error: 'Sesión no encontrada' });
    const msg = { from: 'guest', text: String(text).slice(0, 2000), ts: new Date().toISOString() };
    chats[idx].messages.push(msg);
    chats[idx].unread = (chats[idx].unread || 0) + 1;
    chats[idx].lastAt = msg.ts;
    await saveChats(hotelId, chats);
    res.json({ ok: true, msg });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/chat/:hotelId/poll', async (req, res) => {
  try {
    const { hotelId } = req.params;
    const { session, since } = req.query;
    if (!session) return res.status(400).json({ error: 'session requerido' });
    const chats = await getChats(hotelId);
    const chat  = chats.find(c => c.id === session);
    if (!chat) return res.status(404).json({ error: 'Sesión no encontrada' });
    const sinceTs = since ? parseInt(since, 10) : 0;
    const msgs    = chat.messages.filter(m => new Date(m.ts).getTime() > sinceTs);
    res.json({ messages: msgs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Chat Web — rutas auth (dashboard) ───────────────────────────────────────

app.get('/api/chat', requireAuth, async (req, res) => {
  try { res.json(await getChats(req.hotelId)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/chat/unread', requireAuth, async (req, res) => {
  try {
    const chats = await getChats(req.hotelId);
    res.json({ total: chats.reduce((s, c) => s + (c.unread || 0), 0) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/chat/:id/reply', requireAuth, async (req, res) => {
  try {
    const chats = await getChats(req.hotelId);
    const idx   = chats.findIndex(c => c.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'No encontrado' });
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text requerido' });
    const msg = { from: 'staff', text: String(text).slice(0, 2000), ts: new Date().toISOString() };
    chats[idx].messages.push(msg);
    chats[idx].unread = 0;
    chats[idx].lastAt = msg.ts;
    await saveChats(req.hotelId, chats);
    res.json({ ok: true, msg });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/chat/:id/close', requireAuth, async (req, res) => {
  try {
    const chats = await getChats(req.hotelId);
    const idx   = chats.findIndex(c => c.id === req.params.id);
    if (idx < 0) return res.status(404).json({ error: 'No encontrado' });
    chats[idx].status = 'closed';
    chats[idx].unread = 0;
    await saveChats(req.hotelId, chats);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Analytics / KPIs
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/analytics', requireAuth, async (req, res) => {
  try {
    const hotelId = req.hotelId;
    const today   = todayStr();
    const [guests, tickets, chats, rooms] = await Promise.all([
      getGuests(hotelId), getTickets(hotelId), getChats(hotelId), getRooms(hotelId),
    ]);
    const active    = guests.filter(g => g.checkin <= today && g.checkout >= today);
    const past30    = guests.filter(g => g.checkout >= offsetDate(today, -30) && g.checkout < today);
    const arriving  = guests.filter(g => g.checkin === today);
    const leaving   = guests.filter(g => g.checkout === today);
    const returning = guests.filter(g => g.isReturning).length;
    const preChecks = guests.filter(g => g.precheckinSent).length;

    const openTix = tickets.filter(t => t.status !== 'resolved');
    const doneTix = tickets.filter(t => t.status === 'resolved');
    let avgResH = 0;
    if (doneTix.length) {
      const tot = doneTix.reduce((s, t) => s + (
        t.resolvedAt && t.createdAt ? (new Date(t.resolvedAt) - new Date(t.createdAt)) : 0
      ), 0);
      avgResH = Math.round(tot / doneTix.length / 3600000 * 10) / 10;
    }
    const ticketCats = {};
    for (const t of tickets) ticketCats[t.category || 'otro'] = (ticketCats[t.category || 'otro'] || 0) + 1;

    const roomByStatus = { libre: 0, ocupada: 0, limpieza: 0, mantenimiento: 0 };
    for (const r of rooms) roomByStatus[r.status] = (roomByStatus[r.status] || 0) + 1;
    const capacity   = rooms.length || 1;
    const occupancy  = Math.round(active.length / capacity * 100);

    res.json({
      occupancyRate: occupancy, totalRooms: rooms.length, activeGuests: active.length,
      arrivalsToday: arriving.length, checkoutsToday: leaving.length,
      guestsLast30: past30.length, returningGuests: returning, precheckinsSent: preChecks,
      openTickets: openTix.length, resolvedTickets: doneTix.length, avgResolutionHours: avgResH,
      ticketCategories: ticketCats,
      reviewsPositive: guests.filter(g => g.reviewStatus === 'positive').length,
      reviewsNegative: guests.filter(g => g.reviewStatus === 'negative').length,
      reviewsPending:  guests.filter(g => g.reviewStatus === 'sent').length,
      roomByStatus,
      openChats: chats.filter(c => c.status === 'open').length,
      totalUnread: chats.reduce((s, c) => s + (c.unread || 0), 0),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Reporte matutino ─────────────────────────────────────────────────────────
async function sendMorningReport(hotelId) {
  const token = await getAdminToken(hotelId);
  const bot   = adminBots.get(hotelId);
  if (!token || !bot?.running) return;
  const chatIds = [...(bot.chatIds || new Set())];
  if (!chatIds.length) return;

  const today   = todayStr();
  const tickets = await getTickets(hotelId);
  const guests  = await getGuests(hotelId);

  const open       = tickets.filter(t => t.status !== 'resolved');
  const urgent     = open.filter(t => t.priority === 'urgent' || t.priority === 'high');
  const arrivals   = guests.filter(g => g.active !== false && g.checkin === today);
  const midToday   = guests.filter(g => g.active !== false && g.pulseStatus === null
    && g.checkin !== today && midStayDate(g.checkin, g.checkout) === today);

  let report = `☀️ *Buenos días — Reporte ${today}*\n\n`;

  if (arrivals.length) {
    report += `*✈️ Llegadas de hoy (${arrivals.length}):*\n`;
    arrivals.forEach(g => {
      report += `• *${g.name}*${g.room ? ` — Hab. ${g.room}` : ''} — ${VISIT_LABELS[g.type] || g.type}\n`;
      if (g.notes) report += `  _${g.notes}_\n`;
    });
    report += '\n';
  }

  if (open.length) {
    report += `*🎫 Tickets abiertos: ${open.length}*${urgent.length ? ` (${urgent.length} urgentes ⚠️)` : ''}\n`;
    open.slice(0, 5).forEach(t => {
      const icon = t.priority === 'urgent' ? '🔴' : t.priority === 'high' ? '🟠' : '🟡';
      const room = t.room ? `Hab.${t.room} ` : '';
      report += `${icon} [${t.id}] ${room}${t.guestName || 'Huésped'}: ${t.description.slice(0, 55)}\n`;
    });
    if (open.length > 5) report += `_...y ${open.length - 5} más. Ver en dashboard._\n`;
    report += '\n';
  }

  if (midToday.length) {
    report += `*💬 Pulso de satisfacción hoy (${midToday.length}):*\n`;
    midToday.forEach(g => report += `• ${g.name}${g.room ? ` (Hab. ${g.room})` : ''}\n`);
    report += `_Usa /pulse en el bot para generar el mensaje._\n\n`;
  }

  if (!arrivals.length && !open.length && !midToday.length) {
    report += '✨ Sin novedades. ¡Buen turno!\n';
  }

  report += `\n_Reporte generado automáticamente por HotelClaw_`;

  for (const chatId of chatIds) {
    await tgSend(token, chatId, report);
  }
  console.log(`[MorningReport:${hotelId}] Enviado a ${chatIds.length} chat(s)`);
}

// ─── Pulso automático de satisfacción ─────────────────────────────────────────
async function sendAutoPulses(hotelId) {
  const token = await getAdminToken(hotelId);
  const bot   = adminBots.get(hotelId);
  if (!token || !bot?.running) return;
  const chatIds = [...(bot.chatIds || new Set())];
  if (!chatIds.length) return;

  const today  = todayStr();
  const guests = await getGuests(hotelId);
  const targets = guests.filter(g =>
    g.active !== false && g.pulseStatus === null &&
    g.checkin !== today && midStayDate(g.checkin, g.checkout) === today
  );
  if (!targets.length) return;

  let cfg = {};
  try { cfg = JSON.parse(await fs.readFile(hotelPath(hotelId, 'config.json'), 'utf-8')); } catch {}
  const hotelName = cfg.nombre || 'el hotel';

  for (const g of targets) {
    try {
      const msg = await generateWithAria(hotelId,
        `Eres Aria, concierge de ${hotelName}. Redacta un mensaje corto (máximo 3 líneas) para preguntar cómo va la estadía del huésped. Cálido, natural, sin markdown.`,
        `Huésped: ${g.name}. Tipo de visita: ${VISIT_LABELS[g.type] || g.type}.`,
        { searchWeb: false }
      );
      for (const chatId of chatIds) {
        await tgSend(token, chatId,
          `💬 *Pulso de satisfacción — ${g.name}*${g.room ? ` (Hab. ${g.room})` : ''}\n\n` +
          `Mensaje sugerido para enviarle por ${g.channel === 'telegram' ? 'Telegram' : 'WhatsApp'}:\n\n_${msg}_\n\n` +
          `Cuando recibas su respuesta, usa:\n• /positivo ${g.id.slice(-4)} — si está feliz\n• /queja ${g.id.slice(-4)} <desc> — si hay problema`
        );
      }
      g.pulseStatus = 'sent'; g.pulseSentAt = new Date().toISOString();
    } catch (e) { console.error(`[Pulse:${hotelId}] ${g.name}: ${e.message}`); }
  }
  await saveGuests(hotelId, guests);
}

// ─── Cron jobs ────────────────────────────────────────────────────────────────
// Reporte matutino: 7:00 AM todos los días
cron.schedule('0 7 * * *', async () => {
  for (const [hotelId] of adminBots.entries()) {
    sendMorningReport(hotelId).catch(e => console.error(`[MorningReport:${hotelId}]`, e.message));
  }
});

// Pulso de satisfacción: 10:00 AM todos los días
cron.schedule('0 10 * * *', async () => {
  for (const [hotelId] of adminBots.entries()) {
    sendAutoPulses(hotelId).catch(e => console.error(`[AutoPulse:${hotelId}]`, e.message));
  }
});

// Auto-marcar habitaciones para limpieza en checkout del día: 11:00 AM
cron.schedule('0 11 * * *', async () => {
  const today = todayStr();
  for (const [hotelId] of adminBots.entries()) {
    try {
      const guests = await getGuests(hotelId);
      const rooms  = await getRooms(hotelId);
      if (!rooms.length) continue;
      const checkoutNums = guests
        .filter(g => g.checkout === today && g.room)
        .map(g => String(g.room).trim());
      if (!checkoutNums.length) continue;
      let changed = false;
      for (const r of rooms) {
        if (checkoutNums.includes(r.number) && r.status === 'ocupada') {
          r.status = 'limpieza'; r.updatedAt = new Date().toISOString(); changed = true;
        }
      }
      if (changed) {
        await saveRooms(hotelId, rooms);
        console.log(`[AutoClean:${hotelId}] Marcadas para limpieza: ${checkoutNums.join(', ')}`);
      }
    } catch (e) { console.error(`[AutoClean:${hotelId}]`, e.message); }
  }
});

// ─── Arranque ─────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', async () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   🛎️  HotelClaw Dashboard — Modelo B      ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║   http://localhost:${PORT}                   ║`);
  console.log('╚══════════════════════════════════════════╝\n');

  await fs.mkdir(HOTELS_DIR, { recursive: true });
  await getOrCreateAdminCredentials();

  // Auto-arrancar Staff Bots de todos los hoteles que tengan token
  try {
    const dirs = await fs.readdir(HOTELS_DIR);
    for (const hotelId of dirs) {
      try { await startAdminBot(hotelId); } catch {}
    }
  } catch {}

  console.log('Abre tu navegador en: http://localhost:3000\n');
});
