# MANUAL DEL CREADOR — HotelClaw
## Guía completa de todo lo que existe, cómo funciona y cómo venderlo

> **Para quién es este manual:** Para ti, el creador de HotelClaw. Cubre cada feature
> de los tres tiers, cómo demostrarlo a un manager de hotel, qué decir cuando preguntan
> cómo funciona, y cómo configurar todo desde cero para un cliente nuevo.

---

## ÍNDICE

1. [Arquitectura general](#1-arquitectura-general)
2. [El Dashboard — Panel de administración](#2-el-dashboard)
3. [Tier 1 — Operaciones base](#3-tier-1--operaciones-base)
   - [Mi Hotel](#31-mi-hotel)
   - [Credenciales](#32-credenciales)
   - [Gateway y Canales](#33-gateway-y-canales)
   - [Pareamiento](#34-pareamiento)
   - [Knowledge Base (KB)](#35-knowledge-base-kb)
   - [Servicios del Hotel](#36-servicios-del-hotel)
   - [Tickets de Solicitudes](#37-tickets-de-solicitudes)
   - [Huéspedes (base)](#38-huéspedes-base)
   - [Email & Outreach](#39-email--outreach)
   - [Staff Bot de Telegram](#310-staff-bot-de-telegram)
4. [Tier 2 — Ciclo completo del huésped](#4-tier-2--ciclo-completo-del-huésped)
   - [Pre Check-in Digital](#41-pre-check-in-digital)
   - [Historial y Huéspedes Frecuentes](#42-historial-y-huéspedes-frecuentes)
   - [Ciclo de Reseñas Post-Estadía](#43-ciclo-de-reseñas-post-estadía)
   - [Menú Digital con QR](#44-menú-digital-con-qr)
5. [Tier 3 — Operaciones avanzadas](#5-tier-3--operaciones-avanzadas)
   - [Tablero de Habitaciones](#51-tablero-de-habitaciones)
   - [Chat Web de Huéspedes](#52-chat-web-de-huéspedes)
   - [Analytics & KPIs](#53-analytics--kpis)
6. [Referencia completa del Staff Bot](#6-referencia-completa-del-staff-bot)
7. [Referencia completa de la API](#7-referencia-completa-de-la-api)
8. [Cómo configurar un cliente nuevo desde cero](#8-configurar-un-cliente-nuevo)
9. [Guión de demo para vender a un hotel manager](#9-guión-de-demo)
10. [Preguntas difíciles y cómo responderlas](#10-preguntas-difíciles)

---

## 1. Arquitectura general

HotelClaw tiene dos capas:

```
┌─────────────────────────────────────────────────────────────────────┐
│  CAPA 1: DASHBOARD (lo que construiste tú)                          │
│  ─────────────────────────────────────────────────────────────────  │
│  Express.js server  →  dashboard/server.js   (2.900 líneas)         │
│  Frontend SPA       →  dashboard/public/index.html  (3.200 líneas)  │
│  Base de datos      →  dashboard/data/hotels/{hotelId}/             │
│                        (archivos JSON por hotel, multi-tenant)       │
│  Puerto             →  localhost:3000                                │
│                                                                     │
│  CAPA 2: ARIA — EL CONCIERGE (OpenClaw)                             │
│  ─────────────────────────────────────────────────────────────────  │
│  Motor              →  OpenClaw CLI (npm install -g openclaw)        │
│  Configuración      →  ~/.openclaw/openclaw.json                     │
│  Skills             →  ~/.openclaw/skills/hotel-*/SKILL.md          │
│  Gateway            →  puerto 18789 (loopback)                      │
│  Canales            →  Telegram, WhatsApp (cualquier número)         │
└─────────────────────────────────────────────────────────────────────┘
```

### Cómo se comunican las dos capas

El dashboard muestra datos y genera mensajes AI. OpenClaw/Aria atiende las conversaciones en tiempo real de los huéspedes. Son independientes pero complementarios — el dashboard genera el contexto (KB, servicios, datos del hotel) que Aria usa para responder.

### Estructura de datos por hotel

Cada hotel tiene su carpeta aislada:

```
dashboard/data/hotels/{hotelId}/
├── config.json          ← email, password hasheado, plan
├── credentials.json     ← API keys (Anthropic, Telegram, Gmail, etc.)
├── hotel-data.json      ← nombre, dirección, horarios, WiFi, etc.
├── guests.json          ← historial completo de huéspedes
├── tickets.json         ← tickets de solicitudes
├── services.json        ← spa, tours, restaurante, etc.
├── menu.json            ← menú digital con precios y categorías
├── rooms.json           ← habitaciones y sus estados
├── chats.json           ← conversaciones del chat web
├── kb/                  ← knowledge base
│   ├── docs/            ← PDFs, Word, TXT subidos
│   └── chunks.json      ← fragmentos indexados para búsqueda BM25
└── outreach/
    ├── contacts.json    ← lista de contactos para email outreach
    └── sequences.json   ← secuencias de email configuradas
```

---

## 2. El Dashboard

### Acceso

- URL: `http://localhost:3000`
- Para el super admin: `admin@hotelclaw.ai` / `hotelclaw2026` (cambiar en producción)
- Para un hotel: el email y contraseña que configuraste al crearlo

### Panel de Admin (`/admin`)

Desde `/admin` puedes:
- Ver todos los hoteles registrados
- Crear un hotel nuevo (nombre, email, contraseña, plan)
- Editar o eliminar hoteles

Esto es lo que usas tú para onboardear un cliente nuevo. El hotel recibe su email/contraseña y entra directamente a su dashboard.

### Sesión y seguridad

- Login usa JWT firmado, guardado en cookie `httpOnly`
- Cada request de API verifica que el JWT tenga `hotelId`
- Los datos de cada hotel están completamente aislados — un hotel nunca ve los datos de otro
- Expiración de sesión: 24 horas

---

## 3. Tier 1 — Operaciones base

### 3.1 Mi Hotel

**Qué es:** El formulario donde el hotel ingresa toda su información base. Esta información la usa Aria para responder a los huéspedes de forma precisa.

**Campos configurables:**
- Nombre del hotel
- Dirección completa
- Teléfono y WhatsApp
- Sitio web
- Horario de check-in / check-out
- Código WiFi (SSID + contraseña)
- Información de estacionamiento
- Links de reseñas de Google y Booking (para Tier 2)

**Cómo funciona internamente:** Al guardar, el dashboard escribe `hotel-data.json`. Cuando Aria genera cualquier contenido (pre check-in, upsell, reseñas), lee ese archivo para personalizar el mensaje con los datos reales del hotel.

**Qué decirle al manager:** "Aquí pones los datos de tu hotel una sola vez. A partir de ahí, Aria los conoce de memoria y los usa en cada comunicación."

---

### 3.2 Credenciales

**Qué es:** Donde el hotel ingresa sus claves de API. Sin esto, nada funciona.

**Campos:**
- **Anthropic API Key** (`sk-ant-...`): La clave que hace pensar a Aria. Obligatoria.
- **Token Telegram (Bot de huéspedes)**: El token del bot que habla con los huéspedes por Telegram.
- **Token Telegram Admin (Staff Bot)**: Un bot DIFERENTE, solo para el equipo interno.
- **Telegram IDs autorizados**: Los IDs de Telegram de las personas del staff que pueden usar el Staff Bot. Si se deja vacío, cualquiera que hable con el bot puede usarlo (no recomendado).
- **Gmail usuario y contraseña de aplicación**: Para el auto-responder de email y el outreach.

**Cómo obtener cada clave:**
- Anthropic: `console.anthropic.com` → API Keys
- Telegram bot: hablar con `@BotFather` → `/newbot`
- Telegram ID personal: hablar con `@userinfobot`
- Gmail password de app: Google Account → Seguridad → Contraseñas de aplicaciones

**Qué decirle al manager:** "Estas son las llaves de tu sistema. Las ingresas una vez y ya. Si alguna vez cambias el token de Telegram o la API key, la actualizas aquí."

---

### 3.3 Gateway y Canales

**Qué es:** El Gateway es el "motor" de OpenClaw que mantiene a Aria activa y conectada. Desde el dashboard puedes ver su estado y los logs en tiempo real.

**Sección Gateway:**
- Botón para iniciar/detener el gateway
- Logs en vivo (se actualizan cada 5 segundos)
- Estado: activo (verde) o inactivo (rojo)

**Sección Canales:**
- Muestra el estado de cada canal conectado
- Telegram: activo si el bot responde
- WhatsApp: activo si el QR fue escaneado
- Gateway: si el proceso de OpenClaw está corriendo

**Qué decirle al manager:** "El Gateway debe estar siempre en verde. Si se cae (por un corte de luz o reinicio del servidor), lo vuelves a iniciar con un clic desde aquí."

---

### 3.4 Pareamiento

**Qué es:** Sistema de seguridad de OpenClaw. Cuando alguien le escribe a Aria por primera vez, recibe un código de 8 caracteres. Alguien del hotel debe aprobarlo en el dashboard para que esa persona pueda hablar con Aria.

**Flujo:**
1. Huésped escribe al bot de Telegram
2. Aria responde: "Para continuar, comparte este código con el hotel: X5NQ6LKN"
3. El staff ve el código pendiente en el dashboard → Pareamiento
4. Lo aprueba → el huésped ya puede hablar libremente

**Cuándo usar esto vs. no usarlo:** Para hoteles con muchos huéspedes desconocidos, el pareamiento puede ser engorroso. Puedes configurar OpenClaw para que lo desactive. Para uso interno del staff es muy útil como capa de seguridad.

---

### 3.5 Knowledge Base (KB)

**Qué es:** La "memoria" de Aria. Todo lo que subes aquí, Aria lo usa para responder preguntas de huéspedes y generar contenido. Es la diferencia entre un bot genérico y uno que realmente conoce el hotel.

**Tres tipos de contenido:**

**1. Documentos (PDF, Word, TXT, Markdown)**
- Subes el archivo desde el dashboard
- El sistema extrae el texto automáticamente (usa `pdf-parse` para PDFs, `mammoth` para Word)
- El texto se divide en fragmentos de 500 caracteres con overlap de 50
- Cuando Aria necesita responder, busca los fragmentos más relevantes (BM25)

*Qué subir:* Menú del restaurante, reglamento del hotel, folleto de servicios del spa, guía de actividades locales, manual del huésped, tarifas y políticas.

**2. URLs (páginas web)**
- Pegas una URL y el sistema la descarga y extrae el texto (scraping real, 12 segundos de timeout)
- Útil para: página web del hotel, tripadvisor, páginas de actividades locales

**3. Imágenes**
- Subes una foto y Claude la describe automáticamente usando visión (claude-haiku-4-5)
- La descripción queda en la KB
- Útil para: fotos de habitaciones, del lobby, del restaurante, vistas panorámicas

**Búsqueda BM25 simplificada:**
Cuando Aria va a responder algo, hace una búsqueda en los chunks del KB usando el texto de la pregunta del huésped. Los 3 chunks más relevantes se incluyen como contexto adicional en el prompt de la IA.

**Qué decirle al manager:** "Tu KB es como el cerebro de Aria. Cuanto más le enseñes, mejor responde. Sube tu menú, las políticas del hotel, fotos de las habitaciones, links de tu web. En 30 minutos Aria ya sabe todo sobre tu hotel."

---

### 3.6 Servicios del Hotel

**Qué es:** Un catálogo estructurado de los servicios extras que ofrece el hotel. Aria los conoce y puede recomendarlos activamente a los huéspedes durante su estadía (upselling).

**Campos por servicio:**
- Nombre
- Categoría: spa, tour, transporte, restaurante, experiencia, otro
- Precio
- Descripción
- Imágenes (con descripción por visión AI)
- Activo / Inactivo

**Ejemplo de servicios típicos:**
- Masaje relajante 60 min — $45 — Spa
- City tour en bicicleta — $25/persona — Tour
- Transfer aeropuerto — $30 — Transporte
- Cena romántica en terraza — $80/pareja — Restaurante
- Clase de cocina local — $35 — Experiencia

**Cómo funciona el upselling:** En el dashboard, cuando generas un mensaje de upsell para un huésped, Aria recibe la lista de servicios activos y el perfil del huésped (tipo de viaje: pareja, familia, negocios) y genera una oferta personalizada.

Ejemplo automático: para una pareja → recomienda la cena romántica y el masaje. Para familia con niños → tour familiar y actividades.

---

### 3.7 Tickets de Solicitudes

**Qué es:** Un sistema de tickets en tiempo real para gestionar solicitudes y problemas de huéspedes. Funciona como un mini-helpdesk integrado.

**Campos de cada ticket:**
- ID único (ej: `T-001`)
- Nombre del huésped
- Habitación
- Categoría: limpieza, mantenimiento, amenities, food, ruido, transporte, queja, consulta, otro
- Descripción detallada
- Prioridad: baja, media, alta, urgente
- Estado: abierto, en proceso, resuelto
- Fecha de creación y de resolución

**Flujos de uso:**
1. **Manual desde dashboard:** El staff ve una solicitud por WhatsApp y la registra en el sistema
2. **Desde el Staff Bot:** `/ticket habitacion 204 ruido del vecino` → el bot crea el ticket
3. **Filtros disponibles:** abiertos, en proceso, resueltos, urgentes

**Métricas que genera:**
- Tiempo promedio de resolución (para Analytics)
- Distribución por categoría (para Analytics)

**Qué decirle al manager:** "Cada vez que llega una solicitud o queja, en vez de anotarlo en papel o perderlo en WhatsApp, lo registras aquí. Así no se te escapa nada y puedes ver cuánto tarda tu equipo en resolver los problemas."

---

### 3.8 Huéspedes (base)

**Qué es:** El registro completo de todos los huéspedes del hotel. Funciona como un mini-CRM.

**Campos de cada huésped:**
- Nombre
- Habitación
- Fecha de check-in y check-out
- Tipo de visita: pareja, luna de miel, familia, negocios, vacaciones, grupo, otro
- Canal preferido: WhatsApp, Telegram, email, presencial
- Notas (alergias, preferencias, ocasión especial)
- Contacto (teléfono o email)

**Estados:**
- **Activo:** check-in ≤ hoy ≤ check-out
- **Historial:** checkout < hoy

**Automatizaciones que corren solas (cron jobs):**
- **7:00 AM todos los días:** Reporte matutino al Staff Bot con llegadas del día, tickets abiertos urgentes, huéspedes en punto medio de estadía
- **10:00 AM todos los días:** Se envía el pulso de satisfacción a huéspedes en el punto medio de su estadía (mitad entre check-in y check-out)

---

### 3.9 Email & Outreach

**Qué es:** Dos funcionalidades de email en una sección:

**A. Auto-responder de Gmail**
Conectas la cuenta Gmail del hotel y Aria responde automáticamente los emails de huéspedes y clientes. Usa la KB para dar respuestas precisas.

Configuración:
1. En Credenciales → Gmail: pones el email y la contraseña de aplicación
2. En Email & Outreach → pestaña Auto-responder: activas/desactivas
3. Aria revisa el inbox cada 5 minutos y responde los emails sin leer

**B. Outreach por secuencias**
Sistema para hacer email marketing hacia potenciales clientes (agencias de viaje, empresas locales, etc.).

Cómo funciona:
1. Importas contactos en CSV (nombre, email, empresa, cargo)
2. Creas una secuencia de emails con días de espera entre cada uno
3. Aria genera el texto de cada email automáticamente
4. La secuencia se activa y los emails salen solos según el calendario

Esto se puede configurar también desde el Staff Bot con el wizard `/outreach`.

---

### 3.10 Staff Bot de Telegram

**Qué es:** Un bot de Telegram privado para el equipo del hotel. Los comandos los usa el staff (recepcionistas, gerentes) desde su teléfono, sin abrir el dashboard.

**Cómo configurarlo:**
1. Crear bot en `@BotFather` → `/newbot` → copiar token
2. En Dashboard → Credenciales → "Token del Staff Bot" → pegar token → Guardar y activar
3. En "Telegram IDs autorizados" → poner los IDs del equipo

**Todos los comandos disponibles (referencia completa en sección 6)**

---

## 4. Tier 2 — Ciclo completo del huésped

### 4.1 Pre Check-in Digital

**Qué hace:** Genera un mensaje de bienvenida previo a la llegada del huésped y lo marca como enviado. El mensaje es personalizado con los datos del hotel (hora de check-in, WiFi, estacionamiento, teléfono) y el tipo de visita del huésped.

**Desde el dashboard:**
- En la sección Huéspedes, cada huésped activo tiene un botón "✈️ Pre Check-in"
- El botón solo aparece si el huésped aún no recibió el pre check-in (`precheckinSent = false`)
- Al hacer clic, se llama a la API, Aria genera el mensaje y lo muestra en pantalla
- El staff lo copia y lo manda por WhatsApp o Telegram al huésped
- El sistema marca `precheckinSent = true` para no enviarlo dos veces

**Desde el Staff Bot:**
```
/precheckin María
```
El bot busca a "María" entre los huéspedes activos, genera el mensaje y lo muestra en el chat de Telegram del staff.

**Qué dice el mensaje generado (ejemplo):**
> "Hola María, soy Aria, concierge del Hotel Casa del Mar. Nos alegra mucho recibirte este viernes. Tu habitación estará lista a partir de las 3:00 PM. WiFi: CasaDelMar_Guest / clave: bienvenido2026. Estacionamiento gratuito disponible. Si necesitas algo antes de llegar, escríbeme aquí. ¡Te esperamos!"

**Qué decirle al manager:** "El día antes de que llegue un huésped, con un clic generas este mensaje y se lo mandas por WhatsApp. Llegan sabiendo el WiFi, el horario, cómo llegar. Menos preguntas en recepción, mejor primera impresión."

---

### 4.2 Historial y Huéspedes Frecuentes

**Qué hace:** El sistema reconoce automáticamente cuando alguien ya se hospedó antes. Cuando registras a un nuevo huésped, el sistema busca en el historial si alguien con el mismo nombre o contacto ya estuvo.

**Detección automática:**
- Al crear un huésped, compara nombre (exacto, minúsculas) y contacto con todos los huéspedes pasados (checkout < hoy)
- Si hay coincidencia → el nuevo huésped queda marcado como `isReturning: true`, `returnCount: N`, `prevNotes: "..."` (notas de la visita anterior)

**En el dashboard:**
- Los huéspedes frecuentes muestran un badge "🔄 Huésped frecuente (Nx)"
- Se muestra el campo "Visitas previas" con las notas de la estadía anterior
- Botón "📜 Ver historial" en la sección Huéspedes → muestra todos los que ya hicieron checkout

**Por qué importa:** Cuando Aria genera mensajes para un huésped frecuente, puede incluir ese contexto. "Bienvenido de nuevo, Carlos. Nos alegra tenerte otra vez..."

**Qué decirle al manager:** "HotelClaw recuerda a tus huéspedes. Si alguien vuelve, automáticamente aparece como huésped frecuente y puedes ver sus notas de la visita anterior. Así tratas a cada huésped como si lo conocieras de toda la vida."

---

### 4.3 Ciclo de Reseñas Post-Estadía

**Qué hace:** Después del checkout, gestiona el proceso completo de solicitud y registro de reseñas.

**Flujo completo:**

**Paso 1 — Solicitar la reseña**
- En la sección Historial (huéspedes con checkout pasado), cada uno tiene un botón "⭐ Pedir reseña"
- Al hacer clic, Aria genera un mensaje cálido de agradecimiento post-estadía con una invitación a dejar una reseña
- El sistema marca `reviewStatus = 'sent'`

**Desde el Staff Bot:**
```
/reseña Elena
```

**Paso 2 — Registrar la respuesta**
Cuando el huésped responde (por WhatsApp, Telegram o en persona), el staff registra en el sistema cómo reaccionó:

- **"Fue positiva"** → el sistema muestra automáticamente los links de Google Reviews y Booking.com del hotel (configurados en "Mi Hotel") para mandárselos al huésped. Estado: `reviewStatus = 'positive'`

- **"Fue negativa"** → se muestra un campo de texto para escribir el feedback del huésped. El sistema envía automáticamente una alerta al Staff Bot de Telegram: "⚠️ Reseña negativa de Elena Vega: El aire acondicionado no funcionó bien". Estado: `reviewStatus = 'negative'`

**Por qué esto es importante para el hotel:**
- Las reseñas positivas van directo a Google/Booking → sube el rating
- Las reseñas negativas se capturan en privado → el hotel puede actuar antes de que se publiquen
- El manager sabe exactamente qué huéspedes están felices y cuáles tuvieron problemas

**Qué decirle al manager:** "¿Sabes cuántas reseñas negativas se publican porque el hotel no se enteró a tiempo del problema? Con HotelClaw, primero le preguntas al huésped cómo le fue. Si está feliz, le mandas el link de Google. Si tuvo un problema, tú te enteras antes de que escriba en TripAdvisor y puedes resolverlo."

---

### 4.4 Menú Digital con QR

**Qué hace:** Crea un menú de restaurante/bar accesible desde un código QR, sin app, desde cualquier celular del huésped.

**URL pública del menú:** `http://tudominio.com/menu/{hotelId}`
No requiere login. El huésped escanea el QR con la cámara y ve el menú.

**Gestión del menú desde el dashboard (sección Menú Digital):**

**Agregar un plato:**
- Nombre
- Categoría: Entradas, Plato Principal, Postre, Bebida, Especial del día, Otros
- Precio
- Descripción
- Alérgenos
- Imágenes (se suben directamente, se muestran en el menú)

**Gestionar platos:**
- Editar cualquier campo
- Pausar un plato (desaparece del menú público sin eliminarlo)
- Reactivar
- Eliminar

**El QR:**
- El dashboard genera automáticamente un QR usando `api.qrserver.com`
- El QR apunta a la URL pública del menú de ese hotel
- Se puede descargar e imprimir

**Cómo se ve el menú público:**
Página HTML limpia, sin instalar nada, organizada por categorías, con imágenes si las tiene, con el precio de cada plato. Funciona en cualquier celular.

**Qué decirle al manager:** "Imprimes el QR, lo pegas en cada mesa. El huésped lo escanea y ve el menú en su celular. Sin app, sin papel, sin que el mesero lo traiga. Y si cambia un precio o se acaba un plato, lo actualizas en 30 segundos desde el dashboard y el menú cambia al instante."

---

## 5. Tier 3 — Operaciones avanzadas

### 5.1 Tablero de Habitaciones

**Qué hace:** Un tablero tipo Kanban que muestra el estado de cada habitación del hotel en tiempo real.

**Los 4 estados:**

| Estado | Color | Significa |
|--------|-------|-----------|
| 🟢 Libre | Verde | Disponible, lista para recibir huésped |
| 🔴 Ocupada | Rojo | Huésped actualmente hospedado |
| 🧹 Limpieza | Amarillo | Checkout realizado, pendiente de limpiar |
| 🔧 Mantenimiento | Morado | Fuera de servicio por reparación |

**Datos de cada habitación:**
- Número de habitación
- Tipo: Individual, Doble, Suite, Familiar, Otro
- Piso
- Notas (ej: "Vista al mar", "Con jacuzzi", "Conecta con 202")

**Desde el dashboard:**
- Vista Kanban con 4 columnas, una por estado
- Cada tarjeta muestra número, tipo, piso, notas
- Botones de cambio rápido de estado en cada tarjeta (sin modal, 1 clic)
- Botón de editar → abre modal completo
- Botón de eliminar

**Automatización (cron a las 11:00 AM):**
El sistema revisa qué huéspedes tienen checkout ese día y tienen habitación asignada. Si esa habitación está en estado "Ocupada", la cambia automáticamente a "Limpieza". El staff de housekeeping empieza a ver qué habitaciones limpiar sin que nadie les avise.

**Desde el Staff Bot:**
```
/habitaciones
```
Respuesta del bot:
```
🏨 Estado de Habitaciones

🔴 Ocupadas (3): 101, 205, 312
🟢 Libres (4): 102, 103, 201, 301
🧹 Limpieza (2): 204, 311
🔧 Mantenimiento (1): 106

Total: 10 habitaciones
```

**Qué decirle al manager:** "Tu equipo de limpieza sabe exactamente qué habitaciones limpiar sin que nadie les avise. El sistema las marca automáticamente cuando hay un checkout. Además ves de un vistazo cuántas habitaciones libres tienes sin necesidad de revisar el PMS."

---

### 5.2 Chat Web de Huéspedes

**Qué hace:** Un chat en tiempo real entre el huésped (desde cualquier navegador, sin instalar nada) y el staff del hotel (desde el dashboard).

**Cómo funciona el lado del huésped:**

URL pública: `http://tudominio.com/chat/{hotelId}`

El huésped entra, escribe su nombre y empieza a chatear. La sesión se guarda en su navegador (localStorage) así si cierra y vuelve, sigue viendo la conversación. Funciona con polling cada 5 segundos (no requiere WebSockets, funciona en cualquier hosting).

**Cómo funciona el lado del staff (dashboard):**

Sección "Chat Web" en el sidebar:

- **Lista izquierda:** todas las conversaciones ordenadas por actividad reciente, con el nombre del huésped, el último mensaje, la hora y un badge rojo de mensajes sin leer
- **Panel derecho:** la conversación activa, con burbujas de chat diferenciando mensajes del huésped (claro) y del staff (oscuro)
- **Campo de respuesta:** el staff escribe y pulsa Enviar (o Enter)
- **Botón "Cerrar chat":** marca la conversación como cerrada cuando se resolvió

**Badge de no leídos:**
El ícono de "💬 Chat Web" en el sidebar muestra un badge dorado con el número de mensajes sin leer. Se actualiza automáticamente cada 30 segundos aunque no estés en esa sección.

**Notificación por Telegram:**
Cuando un huésped inicia una nueva conversación, el Staff Bot envía automáticamente un mensaje: "💬 Nueva consulta web de [Nombre]. Responde en Dashboard → Chat Web."

**Qué decirle al manager:** "Ponemos el link de chat en la habitación o en la confirmación de reserva. El huésped escribe desde su celular sin instalar nada. Tú respondes desde el dashboard. Sin WhatsApp, sin que el huésped tenga tu número personal. Y si no hay nadie en el dashboard, te llega la notificación por Telegram."

---

### 5.3 Analytics & KPIs

**Qué hace:** Un dashboard de métricas que agrega en tiempo real los datos de todas las secciones del sistema.

**Las 8 tarjetas KPI:**

| KPI | Qué mide |
|-----|----------|
| 🏨 Ocupación | % de habitaciones ocupadas (activas / total habitaciones) |
| ✈️ Llegadas hoy | Huéspedes con check-in = hoy |
| 👥 Huéspedes (30d) | Total de huéspedes de los últimos 30 días |
| 🎫 Tickets abiertos | Tickets que no están resueltos |
| ⏱️ Resolución avg | Tiempo promedio en horas de resolver un ticket |
| ⭐ Reseñas positivas | Huéspedes con reviewStatus = positive |
| 💬 Chats abiertos | Conversaciones de chat web sin cerrar |
| ✈️ Pre check-ins | Cuántos huéspedes recibieron el mensaje pre-llegada |

**Los 3 gráficos de barras:**

1. **Habitaciones por estado:** libre / ocupada / limpieza / mantenimiento
2. **Tickets por categoría:** cuáles son los problemas más frecuentes (limpieza, mantenimiento, food, etc.)
3. **Reseñas:** positivas / negativas / pendientes

**Qué decirle al manager:** "Aquí ves el pulso de tu hotel en un vistazo. ¿Cuántos cuartos libres tienes? ¿Qué problema reportan más los huéspedes? ¿Cuántas reseñas positivas has conseguido este mes? Sin exportar datos, sin reportes. Todo en una pantalla."

---

## 6. Referencia completa del Staff Bot

El Staff Bot es un bot de Telegram privado para el equipo. Solo responde a los Telegram IDs autorizados configurados en el dashboard.

### Comandos generales

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `/help` | Muestra todos los comandos disponibles | `/help` |
| `/status` | Estado del sistema: gateway, auto-responder, stats básicos | `/status` |

### Comandos de contenido (generan texto con Aria)

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `/generate <texto>` | Genera cualquier texto con Aria | `/generate Redacta una nota de bienvenida para el lobby` |
| `/resena <texto>` | Genera respuesta profesional a una reseña | `/resena El desayuno tardó demasiado pero la habitación estaba perfecta` |
| `/post <tema>` | Genera post para Instagram/Facebook | `/post Noche romántica en nuestra suite con vista al mar` |
| `/email <descripción>` | Genera email de bienvenida personalizado | `/email familia con 2 niños que celebran el cumpleaños del hijo mayor` |
| `/imagen <descripción>` | Genera descripción de imagen para redes | `/imagen foto del lobby al atardecer` |
| `/video <descripción>` | Genera script de video corto | `/video tour de la suite presidencial` |
| `/anuncio <tema>` | Genera texto de anuncio publicitario | `/anuncio promoción de temporada baja: 20% de descuento` |
| `/kb <pregunta>` | Busca en el Knowledge Base y responde | `/kb ¿qué tours tenemos disponibles?` |

### Comandos de huéspedes (Tier 2)

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `/huespedes` | Lista huéspedes activos con habitación y tipo de visita | `/huespedes` |
| `/precheckin <nombre>` | Genera mensaje de pre check-in para ese huésped | `/precheckin María García` |
| `/pulse <nombre>` | Genera mensaje de pulso de satisfacción (mid-stay) | `/pulse Carlos Rodríguez` |
| `/upsell <nombre>` | Genera oferta de upsell personalizada según tipo de visita | `/upsell familia Martínez` |
| `/positivo <últimos 4 del ID>` | Marca el pulso del huésped como satisfecho | `/positivo a84f` |
| `/queja <últimos 4 del ID> <descripción>` | Registra una queja y la escala | `/queja a84f El aire acondicionado hace ruido` |
| `/reseña <nombre>` | Genera solicitud de reseña post-estadía | `/reseña Elena Vega` |

### Comandos de habitaciones (Tier 3)

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `/habitaciones` | Resumen del tablero: cuántas libres, ocupadas, en limpieza, mantenimiento | `/habitaciones` |

### Comandos de servicios

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `/servicios` | Lista todos los servicios activos con precio y categoría | `/servicios` |

### Comandos de tickets

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `/tickets` | Lista los tickets abiertos urgentes/altos | `/tickets` |

### Comandos de outreach y email

| Comando | Descripción | Flujo |
|---------|-------------|-------|
| `/outreach` | Wizard en 3 pasos para crear campaña de email | Ver sección 3.9 |
| `/contacts` | Muestra cantidad y preview de contactos importados | `/contacts` |
| `/sequences` | Lista las secuencias de email con su estado | `/sequences` |

### Cron automáticos (sin comando)

| Hora | Qué hace |
|------|----------|
| 7:00 AM | Reporte matutino: llegadas del día, tickets urgentes, pulsos pendientes |
| 10:00 AM | Envía pulso de satisfacción a huéspedes en punto medio de estadía |
| 11:00 AM | Marca automáticamente habitaciones como "limpieza" en checkouts del día |

---

## 7. Referencia completa de la API

Todos los endpoints requieren cookie JWT (login previo) excepto los marcados como **[público]**.

### Auth

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Login con email/password → cookie JWT |
| POST | `/api/auth/logout` | Elimina la cookie |
| GET | `/api/auth/me` | Devuelve datos del usuario/hotel actual |

### Admin (solo super admin)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/admin/api/hotels` | Lista todos los hoteles |
| POST | `/admin/api/hotels` | Crear hotel nuevo |
| GET | `/admin/api/hotels/:id` | Ver hotel específico |
| PATCH | `/admin/api/hotels/:id` | Editar hotel |
| DELETE | `/admin/api/hotels/:id` | Eliminar hotel |

### Hotel data y credenciales

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/hotel` | Leer datos del hotel (nombre, dirección, etc.) |
| POST | `/api/hotel` | Guardar datos del hotel |
| GET | `/api/credentials` | Leer credenciales |
| POST | `/api/credentials` | Guardar credenciales (API keys, tokens) |

### Huéspedes

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/guests` | Listar huéspedes activos (checkout ≥ hoy) |
| POST | `/api/guests` | Crear huésped (detecta automáticamente si es frecuente) |
| PUT | `/api/guests/:id` | Editar huésped |
| DELETE | `/api/guests/:id` | Eliminar huésped |
| GET | `/api/guests/history` | Huéspedes con checkout pasado (historial) |
| POST | `/api/guests/:id/precheckin` | Genera y marca pre check-in enviado |
| POST | `/api/guests/:id/pulse` | Genera mensaje de pulso mid-stay |
| POST | `/api/guests/:id/upsell` | Genera oferta de upsell personalizada |
| POST | `/api/guests/:id/review-request` | Genera solicitud de reseña post-estadía |
| POST | `/api/guests/:id/review-response` | Registra respuesta: `{sentiment: 'positive'/'negative', feedback: ''}` |

### Tickets

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/tickets` | Listar tickets (query: `?status=open/in-progress/resolved`) |
| POST | `/api/tickets` | Crear ticket |
| PUT | `/api/tickets/:id` | Actualizar ticket (status, prioridad, notas) |
| DELETE | `/api/tickets/:id` | Eliminar ticket |

### Servicios

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/services` | Listar servicios |
| POST | `/api/services` | Crear servicio |
| PUT | `/api/services/:id` | Editar servicio |
| DELETE | `/api/services/:id` | Eliminar servicio |
| POST | `/api/services/:id/image` | Subir imagen del servicio (multipart) |
| DELETE | `/api/services/:id/image/:filename` | Eliminar imagen |

### Knowledge Base

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/kb` | Listar todos los items del KB |
| POST | `/api/kb/doc` | Subir documento (multipart: PDF, Word, TXT, MD) |
| POST | `/api/kb/url` | Agregar URL (scraping automático) |
| POST | `/api/kb/image` | Subir imagen (describe con Claude Vision) |
| DELETE | `/api/kb/:id` | Eliminar item del KB |
| POST | `/api/kb/search` | Buscar en el KB: `{query: 'texto'}` |

### Menú Digital

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/menu` | Listar items del menú |
| POST | `/api/menu` | Crear item (nombre, categoría, precio, descripción, alérgenos) |
| PUT | `/api/menu/:id` | Editar item (incluyendo `available: false` para pausar) |
| DELETE | `/api/menu/:id` | Eliminar item |
| POST | `/api/menu/:id/image` | Subir imagen del plato |
| DELETE | `/api/menu/:id/image/:filename` | Eliminar imagen |
| GET | `/api/menu/qr` | Devuelve `{qrUrl, menuUrl}` |
| GET | `/api/menu/image/:filename` | Servir imagen del menú (para el dashboard) |
| GET | `/menu/:hotelId` | **[público]** Página HTML del menú para huéspedes |
| GET | `/menu/:hotelId/img/:filename` | **[público]** Imagen del menú para la página pública |

### Habitaciones

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/rooms` | Listar habitaciones |
| POST | `/api/rooms` | Crear habitación (number, type, floor, notes) |
| PUT | `/api/rooms/:id` | Editar habitación (cualquier campo, incluyendo status) |
| DELETE | `/api/rooms/:id` | Eliminar habitación |

### Chat Web

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/chat/:hotelId` | **[público]** Página HTML del chat para el huésped |
| POST | `/chat/:hotelId/start` | **[público]** Iniciar sesión de chat `{guestName}` → `{sessionId}` |
| POST | `/chat/:hotelId/msg` | **[público]** Enviar mensaje del huésped `{sessionId, text}` |
| GET | `/chat/:hotelId/poll` | **[público]** Polling de nuevos mensajes `?session=xxx&since=timestamp` |
| GET | `/api/chat` | Listar todas las conversaciones del hotel |
| GET | `/api/chat/unread` | Devuelve `{total: N}` de mensajes sin leer |
| POST | `/api/chat/:id/reply` | Staff responde `{text}` → marca unread=0 |
| PUT | `/api/chat/:id/close` | Cerrar conversación |

### Analytics

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/analytics` | Devuelve todos los KPIs calculados en tiempo real |

### Email & Outreach

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/email/settings` | Leer configuración del auto-responder |
| POST | `/api/email/settings` | Guardar configuración |
| GET | `/api/outreach/contacts` | Listar contactos |
| POST | `/api/outreach/contacts` | Importar contactos (CSV en body) |
| DELETE | `/api/outreach/contacts` | Vaciar lista de contactos |
| GET | `/api/outreach/sequences` | Listar secuencias |
| POST | `/api/outreach/sequences` | Crear secuencia |
| POST | `/api/outreach/sequences/:id/activate` | Activar secuencia |
| DELETE | `/api/outreach/sequences/:id` | Eliminar secuencia |

### Gateway y canales

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/gateway/status` | Estado del gateway y los canales |
| POST | `/api/gateway/start` | Iniciar el gateway |
| POST | `/api/gateway/stop` | Detener el gateway |
| GET | `/api/gateway/logs` | Últimas líneas del log del gateway |
| GET | `/api/channels/status` | Estado de cada canal (Telegram, WhatsApp, etc.) |

---

## 8. Configurar un cliente nuevo desde cero

### Paso 1 — Crear la cuenta del hotel (2 minutos)

1. Entra a `http://tuservidor.com/admin` con la cuenta super admin
2. Clic en "Nuevo Hotel"
3. Rellena: nombre del hotel, email del manager, contraseña temporal, plan
4. El sistema crea el `hotelId` automáticamente (ej: `h_abc123`)
5. Dale al manager el link del dashboard y sus credenciales

### Paso 2 — Primero que hace el manager (30 minutos)

**En "Mi Hotel":**
- Nombre completo del hotel, dirección, teléfono, WhatsApp
- Horario check-in/check-out
- Código WiFi
- Links de Google Reviews y Booking.com (para el ciclo de reseñas)

**En "Credenciales":**
- API Key de Anthropic (el manager la obtiene en console.anthropic.com)
- Token del Staff Bot de Telegram (el manager crea el bot con @BotFather)
- Su ID de Telegram para autorizar el Staff Bot
- Gmail si va a usar el auto-responder

### Paso 3 — Knowledge Base (45 minutos)

El manager sube:
- El PDF del menú del restaurante o carta
- El reglamento del hotel
- El folleto de servicios
- La URL de su sitio web
- Fotos de las habitaciones principales

### Paso 4 — Configurar habitaciones (10 minutos)

En "Habitaciones":
- Crear cada habitación con su número, tipo y piso
- El estado inicial de todas debe ser "Libre"

### Paso 5 — Agregar servicios (15 minutos)

En "Servicios":
- Spa, tours, transporte, restaurante
- Con precio y descripción para que Aria los recomiende

### Paso 6 — Configurar menú digital (20 minutos)

En "Menú Digital":
- Agregar los platos del restaurante con categoría y precio
- Subir fotos de los platos principales
- Descargar el QR e imprimir para las mesas

### Paso 7 — Probar todo antes del go-live

1. Escríbele al Staff Bot: `/status` → debe responder
2. Escríbele al Staff Bot: `/huespedes` → debe listar huéspedes (o decir que no hay)
3. Entra a `http://tuservidor.com/menu/{hotelId}` → debe mostrar el menú
4. Entra a `http://tuservidor.com/chat/{hotelId}` → debe mostrar el formulario de chat
5. En Analytics → debe mostrar datos (aunque sean ceros)
6. Crear un huésped de prueba y hacer el flujo completo: crear → pre check-in → historial → reseña

---

## 9. Guión de demo para vender a un hotel manager

### Apertura (2 minutos)

*"Voy a mostrarte en 20 minutos exactamente cómo funcionaría HotelClaw en tu hotel. No te voy a hablar de tecnología — te voy a mostrar tres situaciones reales que probablemente vives todos los días."*

### Situación 1: El huésped que llega y pregunta todo (3 minutos)

*"Son las 11 de la noche. Llega un huésped por WhatsApp: 'Hola, tengo reserva para mañana, ¿a qué hora es el check-in? ¿Tienen estacionamiento? ¿Cuál es el WiFi?'"*

Muestra: abre el dashboard → Huéspedes → crea el huésped en 30 segundos → clic en "Pre Check-in" → aparece el mensaje generado por Aria.

*"Este mensaje lo copia tu recepcionista y lo manda en 10 segundos. El huésped llega sin preguntas pendientes. Sin que nadie tenga que escribir nada desde cero."*

### Situación 2: El housekeeping no sabe qué habitaciones limpiar (3 minutos)

*"Son las 11 de la mañana. El equipo de limpieza empieza su turno. ¿Cómo saben qué cuartos limpiar sin revisar el PMS o llamarte a ti?"*

Muestra: abre Habitaciones → el tablero Kanban con colores → las habitaciones de checkout ya están en "Limpieza" (automático a las 11 AM). Muestra el Staff Bot: `/habitaciones` desde el teléfono.

*"El sistema sabe quién hace checkout hoy y automáticamente pone esas habitaciones en 'Limpieza'. Tu equipo lo ve de inmediato, sin llamar a nadie."*

### Situación 3: La reseña negativa que no llegó a publicarse (4 minutos)

*"¿Cuántas veces te enteraste de un problema del huésped después de que ya publicó la reseña en Google? Aquí va el flujo que evita eso."*

Muestra: crea un huésped con checkout ayer → abre Historial → botón "Pedir reseña" → aparece el mensaje generado.

*"Le mandas este mensaje por WhatsApp. Si te dice que estuvo todo perfecto, aquí mismo le mandas el link directo de Google Reviews. Si te dice que algo estuvo mal, lo registras aquí, el sistema me avisa por Telegram y puedo resolver el problema antes de que lo publique."*

Muestra: registra respuesta negativa → aparece la alerta en el Staff Bot.

### El dashboard de Analytics (2 minutos)

*"Y al final del día, esto es lo que ves."*

Muestra Analytics: ocupación, tickets, reseñas, habitaciones por estado.

*"Sin reportes, sin Excel, sin pedirle datos a nadie. Todo en tiempo real."*

### Cierre (2 minutos)

*"Todo lo que te mostré funciona desde el primer día. No necesitas cambiar tu PMS, no necesitas instalar nada en los teléfonos de los huéspedes, no necesitas que tu equipo aprenda un sistema complejo. ¿Qué parte te generó más interés?"*

---

## 10. Preguntas difíciles y cómo responderlas

**"¿Esto reemplaza a mis recepcionistas?"**
> No. Reemplaza las tareas repetitivas para que tus recepcionistas puedan atender mejor a los huéspedes cara a cara. Un mensaje de bienvenida, una respuesta a una reseña, un post de Instagram — esas cosas las hace Aria en segundos. Tu equipo se enfoca en lo que importa.

**"¿Y si Aria da una información incorrecta?"**
> Aria solo sabe lo que tú le enseñas en el Knowledge Base. Si el horario del desayuno cambió y no lo actualizas en el KB, Aria dirá el horario viejo. Por eso el setup inicial es importante. Una vez que la KB está bien alimentada, Aria no inventa — solo usa lo que sabe.

**"¿Los huéspedes saben que hablan con una IA?"**
> Aria se presenta como el concierge del hotel, no como una IA. Si alguien pregunta directamente "¿eres una IA?", lo confirma honestamente. La mayoría de los huéspedes no pregunta — simplemente les parece que el hotel responde muy rápido y muy bien.

**"¿Qué pasa si se corta internet en el hotel?"**
> El dashboard necesita internet para funcionar. Las conversaciones de WhatsApp y Telegram también. Si el servidor donde corre HotelClaw está en la nube (recomendado), un corte de internet local del hotel no afecta nada — el servidor sigue respondiendo.

**"¿Es seguro guardar los datos de los huéspedes aquí?"**
> Los datos están en tu servidor, no en servidores de terceros (excepto lo que manda a la API de Anthropic para generar respuestas). Cada hotel tiene sus datos completamente aislados. Para cumplimiento con GDPR o legislación local, los datos de huéspedes están en tu control.

**"¿Cuánto cuesta?"**
> El costo de infraestructura es mínimo: un VPS básico (~$6/mes) y la API de Anthropic (~$10-30/mes según el volumen). Mi tarifa de servicio es aparte. Para un hotel de 15 habitaciones con uso normal, el costo total raramente pasa de $80 USD/mes. Un recepcionista de turno nocturno cuesta $800/mes. Aria trabaja esas mismas horas por $80.

**"¿Puedo probar antes de pagar?"**
> Sí. Instalamos HotelClaw en tu hotel, lo configuramos con tu información real, y lo pruebas durante 30 días. Si al final del mes no ves valor, no pagas nada más allá del costo de la API de Anthropic que usaste directamente.

**"¿Qué pasa si quiero una función que no existe?"**
> HotelClaw se actualiza constantemente. Si tienes una necesidad específica (integración con tu PMS, un comando nuevo en el bot, un reporte específico), lo conversamos y lo valoramos. Esta es la ventaja de trabajar con el creador del sistema directamente.

---

*HotelClaw v1.0 — Tier 1 + Tier 2 + Tier 3*
*Stack: Node.js 22 · Express · Anthropic Claude · JWT · BM25 · Telegram Bot API*
*Repositorio: github.com/grodriguez-max/hotel-ai*
