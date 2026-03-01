# Manual de Integración de Canales — HotelClaw
**Cómo conectar WhatsApp, Telegram y crear nuevas skills**

---

## Índice

1. [Arquitectura: dos bots, dos roles](#1-arquitectura)
2. [Bot de Huéspedes — Aria (OpenClaw)](#2-bot-de-huéspedes--aria)
   - [Telegram para Aria](#21-telegram-para-aria)
   - [WhatsApp para Aria](#22-whatsapp-para-aria)
3. [Bot de Staff — HotelClaw Staff Bot](#3-bot-de-staff)
   - [Crear el bot en BotFather](#31-crear-el-bot-en-botfather)
   - [Configurar en el dashboard](#32-configurar-en-el-dashboard)
   - [Comandos disponibles](#33-comandos-disponibles)
   - [Ejemplo: crear una campaña de outreach](#34-ejemplo-crear-campaña-de-outreach)
4. [Cómo crear nuevas skills](#4-crear-nuevas-skills)
   - [Estructura de una skill](#41-estructura-de-una-skill)
   - [Frontmatter YAML](#42-frontmatter-yaml)
   - [Body markdown](#43-body-markdown)
   - [Registrar la skill en OpenClaw](#44-registrar-la-skill)
   - [Plantilla lista para usar](#45-plantilla-lista-para-usar)
5. [Seguridad y control de acceso](#5-seguridad)
6. [Skills que puedes crear en el futuro](#6-skills-futuras)
7. [Solución de problemas comunes](#7-solución-de-problemas)

---

## 1. Arquitectura

HotelClaw usa **dos bots separados** con roles distintos:

```
┌─────────────────────────────────────────────────────────────┐
│                        HOTELCLAW                            │
│                                                             │
│  BOT DE HUÉSPEDES (Aria)        BOT DE STAFF (Admin)        │
│  ─────────────────────────      ──────────────────────      │
│  Gestionado por: OpenClaw       Gestionado por: Dashboard   │
│  Canal: Telegram / WhatsApp     Canal: Telegram             │
│  Token: TELEGRAM_BOT_TOKEN      Token: TELEGRAM_ADMIN_TOKEN │
│                                                             │
│  Quién lo usa: Huéspedes        Quién lo usa: Tú y tu equipo│
│  Qué hace:                      Qué hace:                   │
│  • Responde preguntas FAQ        • Crea campañas outreach    │
│  • Gestiona check-in info       • Genera contenido          │
│  • Responde reseñas             • Revisa estadísticas        │
│  • Genera emails bienvenida     • Responde reseñas           │
│  • Posts redes sociales         • Ejecuta skills            │
└─────────────────────────────────────────────────────────────┘
```

### Por qué dos bots separados

- **Seguridad**: Los huéspedes nunca tienen acceso a funciones de administración
- **Flujo limpio**: Aria habla con los huéspedes en su idioma y tono; el bot de staff entiende comandos técnicos
- **Escalabilidad**: Puedes agregar comandos al staff bot sin afectar la experiencia del huésped

---

## 2. Bot de Huéspedes — Aria

Aria es el concierge virtual que habla con los huéspedes. Está gestionado por **OpenClaw** y usa las skills que configuraste.

### 2.1 Telegram para Aria

**Costo:** Gratis
**Dificultad:** ⭐ Muy fácil
**Límite:** Sin límite de mensajes

#### Pasos:

**Paso 1 — Crear el bot en Telegram**

1. Abre Telegram y busca `@BotFather`
2. Envía `/newbot`
3. Elige un nombre visible: *"Aria — Hotel Casa del Mar"*
4. Elige un username (debe terminar en "bot"): *"CasaDelMarBot"*
5. BotFather te dará el token: `123456789:AAFabc...`

**Paso 2 — Guardar el token**

1. Abre el dashboard → **Credenciales**
2. Pega el token en el campo "Token del bot de Telegram"
3. Haz clic en **Guardar token**

**Paso 3 — Iniciar el Gateway**

1. Ve al dashboard → **Gateway**
2. Haz clic en **Iniciar Gateway**
3. Espera que el indicador muestre "Gateway activo"

**Paso 4 — Conectar Telegram**

Ejecuta en la terminal (una sola vez):
```bash
openclaw channels connect telegram
```
O si el gateway ya está corriendo, simplemente envía un mensaje al bot. El sistema lo conectará automáticamente.

**Paso 5 — Aprobar el primer usuario**

Cuando alguien le escribe al bot por primera vez, recibirá un código de pareamiento. Apruébalo en:
- Dashboard → **Pareamiento** → ingresa el código y aprueba

```
Flujo del huésped:
1. Huésped abre Telegram y busca @TuBot
2. Envía /start
3. Bot responde: "Para continuar, comparte este código con el hotel: X5NQ6LKN"
4. El staff aprueba en el dashboard
5. A partir de ahí, Aria responde directamente
```

#### Personalización del bot

Regresa a @BotFather y usa estos comandos:
- `/setdescription` — Descripción corta del bot
- `/setabouttext` — Texto "Acerca de"
- `/setuserpic` — Foto de perfil (logo del hotel)
- `/setcommands` — Comandos con descripción:
  ```
  start - Iniciar conversación con Aria
  help - Ver qué puede hacer Aria
  ```

---

### 2.2 WhatsApp para Aria

**Costo:** Gratis (usando número personal)
**Dificultad:** ⭐⭐ Media
**Límite:** 1 conversación a la vez por número (limitación de WhatsApp)

> ⚠️ **Importante**: Esta integración usa un número de WhatsApp real (personal o de empresa). No es la WhatsApp Business API oficial. Para uso comercial intensivo, considera la API oficial de Meta.

#### Pasos:

**Paso 1 — Tener un número dedicado**

Usa un número de teléfono dedicado para el hotel (no el tuyo personal). Puede ser una SIM de prepago.

**Paso 2 — Conectar WhatsApp**

En la terminal (mientras el gateway está activo):
```bash
openclaw channels connect whatsapp
```

Se abrirá un QR en la terminal. Escanéalo con el WhatsApp del número dedicado:
- WhatsApp → Dispositivos vinculados → Vincular un dispositivo

**Paso 3 — Verificar conexión**

```bash
openclaw channels status
```

Deberías ver: `whatsapp: linked`

**Paso 4 — Compartir el número con huéspedes**

Una vez conectado, los huéspedes simplemente escriben al número de WhatsApp del hotel y Aria responde.

> **Nota**: A diferencia de Telegram, WhatsApp no requiere código de pareamiento. Cualquier persona que tenga el número puede escribirle.

#### Diferencias Telegram vs WhatsApp para huéspedes

| Característica | Telegram | WhatsApp |
|---------------|----------|----------|
| Configuración | Muy fácil | Media |
| Costo | Gratis | Gratis |
| Número dedicado | No (es un bot) | Sí (necesitas SIM) |
| Archivo adjunto | Sí | Sí |
| Grupos | Sí | No (en esta integración) |
| Popularidad en hoteles | Alta (Europa/Asia) | Muy alta (LATAM) |

**Recomendación**: Conecta **ambos canales**. Los huéspedes latinoamericanos prefieren WhatsApp; europeos/asiáticos prefieren Telegram.

---

## 3. Bot de Staff

El Staff Bot es un segundo bot de Telegram que solo usa tu equipo. Permite ejecutar operaciones sin abrir el dashboard.

### 3.1 Crear el bot en BotFather

1. Abre Telegram → busca `@BotFather`
2. Envía `/newbot`
3. Nombre sugerido: *"HotelClaw Staff"*
4. Username sugerido: *"HotelClawStaffBot"* (o con el nombre de tu hotel)
5. Copia el token que BotFather te da

> **Importante**: Este debe ser un bot DIFERENTE al de Aria. Crea uno nuevo, no reutilices el mismo token.

### 3.2 Configurar en el dashboard

1. Abre el dashboard → **Credenciales**
2. Busca la sección **Bot de Staff**
3. Pega el token en "Token del Staff Bot"
4. En "Telegram IDs autorizados", escribe los IDs de las personas que pueden usar el bot
   - Para saber tu ID: escríbele a `@userinfobot` en Telegram
   - Formato: `123456789,987654321` (separados por coma)
5. Haz clic en **Guardar y activar**

### 3.3 Comandos disponibles

Una vez activo, escríbele al bot y usa estos comandos:

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `/help` | Lista todos los comandos | `/help` |
| `/status` | Estado del sistema (gateway, auto-responder, estadísticas) | `/status` |
| `/outreach` | Wizard para crear campaña de email en 3 pasos | `/outreach` |
| `/contacts` | Ver cantidad y preview de contactos | `/contacts` |
| `/sequences` | Ver todas las secuencias y su estado | `/sequences` |
| `/generate <texto>` | Genera cualquier contenido con Aria | `/generate Redacta un email para invitar agencias de viaje` |
| `/resena <texto>` | Genera respuesta profesional a una reseña | `/resena El desayuno tardó demasiado` |
| `/post <tema>` | Genera post para Instagram/Facebook | `/post Noche romántica en nuestra suite` |
| `/email <tipo>` | Genera email de bienvenida personalizado | `/email familia con dos niños` |

### 3.4 Ejemplo: Crear campaña de outreach

Este es el flujo completo del wizard `/outreach`:

```
Tú: /outreach

Bot: 📤 Nueva campaña de outreach
     Paso 1/3: Envía la lista de contactos en CSV

Tú: nombre,email,empresa,cargo
    María García,maria@hotel.com,Hotel Plaza,Directora
    Carlos López,carlos@inn.com,Boutique Inn,Gerente
    Ana Martínez,ana@resort.mx,Playa Resort,CEO

Bot: ✅ 3 contactos importados (total: 3)
     Paso 2/3: ¿Cómo se llama esta campaña?

Tú: Prospección directores Q1 2026

Bot: ✅ Campaña: "Prospección directores Q1 2026"
     Paso 3/3: Describe la secuencia. Aria la estructurará.

Tú: 3 pasos: Día 0 presentación de HotelClaw como AI concierge,
    Día 4 follow-up con caso de éxito de otro hotel,
    Día 8 propuesta de demo gratuita de 15 minutos

Bot: ✅ Secuencia creada:
     1. Día 0: "Hola {{nombre}}, transformando la atención al huésped"
     2. Día 4: "Re: ¿Tuviste oportunidad de revisar esto?"
     3. Día 8: "Última oportunidad: demo personalizada para {{empresa}}"

     Actívala desde el dashboard → Email & Outreach → Secuencias
```

---

## 4. Crear nuevas Skills

Las skills son instrucciones especializadas que le das a Aria para manejar temas específicos. Crear una es tan simple como escribir un archivo de texto.

### 4.1 Estructura de una skill

Cada skill vive en su propia carpeta dentro de `skills/`:

```
skills/
├── hotel-faq/
│   └── SKILL.md          ← el archivo principal
├── hotel-quejas/
│   └── SKILL.md
└── mi-nueva-skill/
    └── SKILL.md          ← así creas la tuya
```

### 4.2 Frontmatter YAML

La primera parte del archivo, entre `---`, configura la skill:

```yaml
---
name: nombre-de-la-skill           # identificador único (sin espacios)
description: "Descripción breve"   # qué hace esta skill
metadata:
  openclaw:
    emoji: "🏨"                     # emoji representativo
    requires: []                   # otras skills que necesita (normalmente vacío)
---
```

### 4.3 Body markdown

Después del frontmatter, escribes las instrucciones para Aria en markdown normal. Es como escribirle instrucciones a una persona.

**Estructura recomendada:**

```markdown
# Nombre descriptivo de la skill

Breve descripción de qué hace Aria con esta skill.

## Cuándo activar esta skill

Lista las palabras clave o situaciones que activan esta skill.

## Instrucciones

Escribe exactamente qué debe hacer Aria:
- Qué tono usar
- Qué información recopilar
- Qué output generar
- Qué NO debe hacer

## Ejemplos

Muestra 2-3 ejemplos de input/output esperado.

## Restricciones

Lista lo que Aria no debe hacer en esta skill.
```

### 4.4 Registrar la skill

**Opción A — Copiar manualmente** (una sola vez):
```bash
# En la terminal
cp -r skills/mi-nueva-skill ~/.openclaw/skills/
openclaw skills list  # verificar que aparece
```

**Opción B — Agregar al JSON de configuración** de Aria:

Abre `~/.openclaw/openclaw.json` y agrega el nombre de la skill al array:
```json
{
  "agents": {
    "list": [{
      "skills": [
        "hotel-faq",
        "hotel-quejas",
        "mi-nueva-skill"    ← agrega aquí
      ]
    }]
  }
}
```

Luego reinicia el gateway para que tome efecto:
```bash
openclaw gateway stop
openclaw gateway run --port 18789
```

### 4.5 Plantilla lista para usar

Copia este archivo, cambia los valores y ya tienes una skill nueva:

```markdown
---
name: hotel-mi-skill
description: "Descripción de lo que hace esta skill"
metadata:
  openclaw:
    emoji: "🎯"
---

# Nombre de Mi Skill

Aria usará esta skill para [objetivo principal].

## Cuándo activar

Activa esta skill cuando el usuario mencione:
- "palabra clave 1"
- "palabra clave 2"
- [agrega más casos de uso]

## Instrucciones

Cuando esta skill se activa:
1. [paso 1]
2. [paso 2]
3. [paso 3]

**Tono:** [profesional / cálido / técnico / etc.]
**Idioma:** Detecta el idioma del usuario y responde en ese idioma.
**Longitud:** [corta (< 100 palabras) / media / larga]

## Output esperado

[Describe el formato exacto que debe tener la respuesta]

## Restricciones

- NO [cosa que nunca debe hacer]
- Si no tienes la información, di: "[mensaje de fallback]"
```

---

## 5. Seguridad

### Proteger el bot de staff

**Siempre configura usuarios autorizados:**
```
TELEGRAM_ADMIN_USERS=TU_ID_DE_TELEGRAM,ID_DE_SOCIO
```

Para encontrar tu ID: escríbele a `@userinfobot` en Telegram.

**Rotación de tokens**: Si alguien no autorizado accede al bot, genera un nuevo token en @BotFather con `/revoke` y actualízalo en el dashboard.

### Proteger el bot de huéspedes (Aria)

El modo `dmPolicy: pairing` de OpenClaw protege a Aria. Cada usuario debe ser aprobado manualmente por el hotel.

Para ver usuarios aprobados:
```bash
openclaw pairing list
```

Para revocar acceso a un usuario:
```bash
openclaw pairing revoke telegram <user_id>
```

### Variables de entorno sensibles

El archivo `~/.openclaw/.env` contiene todas las credenciales. Nunca lo compartas. Está en:
- Windows: `C:\Users\TuUsuario\.openclaw\.env`
- Mac/Linux: `~/.openclaw/.env`

---

## 6. Skills Futuras

Ideas de skills que puedes crear para expandir las capacidades de HotelClaw:

### Para Aria (bot de huéspedes)

| Skill | Descripción |
|-------|-------------|
| `hotel-reservas` | Consultar disponibilidad y enviar link de reserva |
| `hotel-spa` | Información y reservas del spa/actividades |
| `hotel-restaurante` | Menú, reservas de mesa, pedidos room service |
| `hotel-excursiones` | Recomendar tours y actividades locales |
| `hotel-emergencias` | Protocolo para situaciones de emergencia |
| `hotel-vip` | Trato especial para huéspedes VIP reconocidos |
| `hotel-idiomas` | Especialización por idioma (FR, DE, PT, etc.) |

### Para el Staff Bot (comandos de administración)

| Comando | Descripción |
|---------|-------------|
| `/reporte` | Genera reporte semanal de interacciones |
| `/review <plataforma>` | Obtiene últimas reseñas de Google/Booking |
| `/ocupacion` | Conecta con PMS para ver ocupación en tiempo real |
| `/upsell` | Genera ofertas personalizadas para huéspedes actuales |
| `/checkin <nombre>` | Prepara el proceso de check-in para un huésped |
| `/feedback` | Envía encuesta post-estancia a huéspedes recientes |

### Integraciones con sistemas externos

| Sistema | Cómo integrar |
|---------|---------------|
| **Cloudbeds** (PMS) | API REST → crear skill que consulta disponibilidad |
| **Booking.com** | RSS de reseñas → parsear y enviar a skill de reseñas |
| **Google Reviews** | Google My Business API → auto-responder |
| **Stripe/Conekta** | Webhooks de pago → notificar al staff bot |
| **Google Calendar** | API → gestionar reservas de sala de juntas/spa |

---

## 7. Solución de Problemas

### Aria no responde en Telegram

**Diagnóstico:**
```bash
openclaw channels status
openclaw gateway status
```

**Soluciones comunes:**
- ¿El gateway está activo? Dashboard → Gateway → Iniciar
- ¿El token está guardado? Dashboard → Credenciales → verificar
- ¿El usuario está aprobado? Dashboard → Pareamiento → aprobar

### El Staff Bot no responde

1. Verifica que el token de admin sea diferente al de Aria
2. Reinicia el bot: Dashboard → Credenciales → sección Staff Bot → Guardar y activar
3. Verifica que tu ID esté en "Telegram IDs autorizados" (o deja el campo vacío para pruebas)

### "Error: Anthropic API key no configurada"

- Dashboard → Credenciales → guardar la clave de Anthropic
- Reinicia el gateway para que tome la nueva clave

### WhatsApp pierde la conexión

WhatsApp desconecta la sesión si el teléfono no tiene internet por más de 24h. Reconecta:
```bash
openclaw channels connect whatsapp
```

Y escanea el QR nuevamente.

### Skill no disponible para Aria

Verifica que:
1. La skill está copiada en `~/.openclaw/skills/`
2. El nombre en `openclaw.json` coincide exactamente con el frontmatter `name:`
3. El gateway fue reiniciado después de los cambios

---

*Manual generado para HotelClaw v1.0 · Fecha: 2026-02*
*Para soporte técnico: hola@hotelclaw.ai*
