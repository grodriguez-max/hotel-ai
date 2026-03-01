# HotelClaw — Concierge AI
## Guía de Instalación y Configuración

> **HotelClaw** es un asistente de IA para hoteles boutique construido sobre [OpenClaw](https://github.com/openclaw/openclaw). Tu asistente se llama **Aria** y puede atender huéspedes por WhatsApp, Telegram, web chat y más — en español e inglés automáticamente.

---

## Requisitos previos

Antes de comenzar, asegúrate de tener:

- [ ] Un servidor o computadora con Linux/macOS/Windows (recomendado: VPS con Ubuntu 22.04)
- [ ] **Node.js 22** o superior — descargar en [nodejs.org](https://nodejs.org)
- [ ] **npm** (viene con Node.js)
- [ ] Una clave de API de un proveedor de IA:
  - **Anthropic Claude** (recomendado): [console.anthropic.com](https://console.anthropic.com)
  - OpenAI: [platform.openai.com](https://platform.openai.com)
  - Google Gemini: [aistudio.google.com](https://aistudio.google.com)

---

## Paso 1 — Instalar OpenClaw

Abre una terminal y ejecuta:

```bash
npm install -g openclaw@latest
```

Verifica que se instaló correctamente:

```bash
openclaw --version
```

---

## Paso 2 — Configurar el directorio de HotelClaw

```bash
# Crear el directorio de configuración
mkdir -p ~/.openclaw

# Copiar el archivo de configuración de HotelClaw
cp hotel-config/openclaw.json ~/.openclaw/openclaw.json
```

---

## Paso 3 — Configurar las variables de entorno

Crea el archivo de entorno:

```bash
cp .env.example ~/.openclaw/.env
```

Abre el archivo con un editor de texto y completa los valores:

```bash
nano ~/.openclaw/.env
```

**Mínimo necesario — completa estos campos:**

```bash
# Token de seguridad del gateway (genera uno aleatorio)
OPENCLAW_GATEWAY_TOKEN=pon-aqui-una-frase-secreta-larga

# API Key de tu proveedor de IA (elige uno)
ANTHROPIC_API_KEY=sk-ant-tu-clave-aqui
# O bien:
# OPENAI_API_KEY=sk-tu-clave-aqui
# GEMINI_API_KEY=tu-clave-aqui
```

Guarda el archivo con `Ctrl+O` luego `Ctrl+X`.

---

## Paso 4 — Instalar los skills de HotelClaw

Copia las carpetas de skills al directorio de OpenClaw:

```bash
# Desde el directorio raíz de HotelClaw
cp -r skills/hotel-responder-resenas ~/.openclaw/skills/
cp -r skills/hotel-describir-habitaciones ~/.openclaw/skills/
cp -r skills/hotel-email-bienvenida ~/.openclaw/skills/
cp -r skills/hotel-redes-sociales ~/.openclaw/skills/
cp -r skills/hotel-quejas ~/.openclaw/skills/
cp -r skills/hotel-faq ~/.openclaw/skills/
```

> **Nota:** Si el directorio `~/.openclaw/skills/` no existe, créalo primero:
> ```bash
> mkdir -p ~/.openclaw/skills
> ```

---

## Paso 5 — Configurar la información de tu hotel

### 5.1 — Actualizar el nombre del hotel en la configuración

```bash
nano ~/.openclaw/openclaw.json
```

El archivo ya está listo. No necesitas cambiar nada en este paso a menos que quieras ajustar algo.

### 5.2 — Configurar el FAQ de tu hotel (IMPORTANTE)

Abre el skill de FAQ y rellena la información real de tu hotel:

```bash
nano ~/.openclaw/skills/hotel-faq/SKILL.md
```

Busca la sección `## CONFIGURACIÓN DEL HOTEL — COMPLETAR ANTES DE USAR` y rellena todos los campos:
- Nombre y dirección del hotel
- Horarios de check-in / check-out
- Políticas de mascotas, cancelación, etc.
- WiFi, estacionamiento, restaurante

**Este paso es crucial** — sin esta información, Aria no podrá responder las preguntas de los huéspedes.

---

## Paso 6 — Iniciar el gateway de OpenClaw

El gateway es el servidor que mantiene a Aria activa y conectada a los canales.

```bash
# Iniciar el gateway en segundo plano
openclaw gateway run --bind loopback --port 18789 &

# Verificar que está corriendo
openclaw channels status
```

Para iniciar el gateway automáticamente al encender el servidor, sigue el Paso 8.

---

## Paso 7 — Conectar canales de mensajería

### Conectar Telegram

1. Abre Telegram y busca `@BotFather`
2. Envía `/newbot` y sigue las instrucciones
3. Guarda el token que te da BotFather (ej: `123456:ABCDEF...`)
4. Agrega el token a tu archivo `.env`:
   ```bash
   nano ~/.openclaw/.env
   ```
   Añade la línea:
   ```
   TELEGRAM_BOT_TOKEN=123456:ABCDEF-tu-token-aqui
   ```
5. Actualiza la configuración para habilitar Telegram:
   ```bash
   openclaw config set channels.telegram.enabled true
   ```
6. Reinicia el gateway:
   ```bash
   pkill -f openclaw-gateway
   openclaw gateway run --bind loopback --port 18789 &
   ```
7. Prueba enviando un mensaje a tu bot en Telegram — Aria debería responder.

---

### Conectar WhatsApp

OpenClaw utiliza **wacli** para conectarse a WhatsApp. Sigue estos pasos:

1. Instala el skill de WhatsApp:
   ```bash
   openclaw skills install wacli
   ```
2. Escanea el código QR para vincular tu número de WhatsApp:
   ```bash
   openclaw whatsapp pair
   ```
   Abre WhatsApp en tu teléfono → **Dispositivos vinculados** → **Vincular dispositivo** → Escanea el QR
3. Configura los números permitidos (quién puede hablar con Aria):
   ```bash
   # Para permitir cualquier número (todos los huéspedes):
   openclaw config set channels.whatsapp.allowFrom '["*"]'

   # O para un número específico:
   openclaw config set channels.whatsapp.allowFrom '["+5491112345678"]'
   ```
4. Reinicia el gateway y prueba enviando un WhatsApp a tu número.

> **Nota importante sobre WhatsApp:** Asegúrate de usar un número dedicado para el hotel (no tu número personal). Se recomienda una línea de SIM separada o un número de WhatsApp Business.

---

## Paso 8 — Configurar inicio automático (opcional pero recomendado)

Para que Aria nunca se apague, configura el gateway como servicio del sistema.

### En Linux (systemd)

```bash
# Crear el archivo de servicio
sudo nano /etc/systemd/system/hotelclaw.service
```

Pega este contenido:

```ini
[Unit]
Description=HotelClaw — Concierge AI (OpenClaw Gateway)
After=network.target

[Service]
Type=simple
User=TU_USUARIO
WorkingDirectory=/home/TU_USUARIO
ExecStart=/usr/local/bin/openclaw gateway run --bind loopback --port 18789
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Reemplaza `TU_USUARIO` con tu nombre de usuario del sistema.

```bash
# Activar e iniciar el servicio
sudo systemctl daemon-reload
sudo systemctl enable hotelclaw
sudo systemctl start hotelclaw

# Verificar que está corriendo
sudo systemctl status hotelclaw
```

---

## Paso 9 — Verificar que todo funciona

```bash
# Ver el estado de todos los canales
openclaw channels status --probe

# Ver los logs en tiempo real
openclaw logs --follow

# Verificar que los skills están cargados
openclaw skills list
```

Deberías ver los 6 skills de HotelClaw en la lista.

---

## Cómo usar HotelClaw — Guía para el staff

### Responder una reseña

Escríbele a Aria (por WhatsApp o Telegram del staff):

> "Aria, responde esta reseña de Google: 'La habitación estaba sucia y el personal fue grosero. Pésima experiencia.'"

Aria generará una respuesta profesional y empática lista para publicar.

---

### Generar descripción de habitación

> "Aria, genera la descripción de nuestra Suite Ático: 65m², cama king, jacuzzi exterior con vista al mar, decoración minimalista en tonos blancos y madera, terraza privada, AC, wifi. Para Booking.com en español e inglés."

---

### Email de bienvenida

> "Aria, genera un email de bienvenida para María García que llega el viernes para su luna de miel. Check-in a las 3pm, check-out el lunes."

---

### Post para redes sociales

> "Aria, crea un post de Instagram para promocionar nuestra suite de luna de miel. Estilo romántico, en español."

---

### Los huéspedes preguntan directamente

Cuando un huésped escribe al WhatsApp o Telegram del hotel:

> "¿A qué hora es el check-in?"
> "Do you have parking?"
> "¿Hay desayuno incluido?"

Aria responde automáticamente usando la información configurada en el skill de FAQ.

---

### Gestionar una queja

Cuando llega una queja, el staff se la comparte a Aria:

> "Aria, el huésped de la habitación 205 (Pedro Sánchez) está quejándose por WhatsApp: 'Son las 11pm y el cuarto de arriba hace un ruido terrible, no puedo dormir.'"

Aria genera:
1. El mensaje para enviar al huésped
2. La nota interna de acción para el staff

---

## Configuración avanzada

### Cambiar el modelo de IA

Por defecto, OpenClaw elige el mejor modelo disponible según tu API key. Para forzar un modelo específico:

```bash
# Usar Claude Sonnet (recomendado para hoteles — mejor relación calidad/precio)
openclaw config set agents.defaults.model "claude-sonnet-4-6"

# Usar GPT-4o
openclaw config set agents.defaults.model "gpt-4o"
```

### Personalizar la personalidad de Aria para tu hotel

Edita el archivo de configuración:

```bash
nano ~/.openclaw/openclaw.json
```

Busca el campo `"theme"` dentro del agente `"main"` y personaliza la descripción. Puedes agregar:
- El nombre y carácter de tu hotel
- El estilo de comunicación deseado
- Información específica del destino o cultura local

### Agregar más canales

OpenClaw soporta también: Discord, Slack, Signal, iMessage (Mac), Teams, IRC, y más.

Consulta la documentación oficial: [docs.openclaw.ai](https://docs.openclaw.ai)

---

## Solución de problemas frecuentes

| Problema | Solución |
|----------|----------|
| Aria no responde en Telegram | Verifica `TELEGRAM_BOT_TOKEN` en `.env` y reinicia el gateway |
| "API key not found" | Asegúrate de haber puesto `ANTHROPIC_API_KEY` o similar en `.env` |
| WhatsApp desconectado | Ejecuta `openclaw whatsapp pair` para re-escanear el QR |
| Los skills no aparecen | Verifica que las carpetas están en `~/.openclaw/skills/` |
| El gateway no inicia | Revisa los logs: `tail -n 50 /tmp/openclaw-gateway.log` |

---

## Actualizaciones

Para actualizar OpenClaw a la última versión:

```bash
npm install -g openclaw@latest
sudo systemctl restart hotelclaw  # si usas systemd
```

Los skills de HotelClaw se actualizan manualmente copiando las nuevas versiones al directorio de skills.

---

## Soporte

- Documentación de OpenClaw: [docs.openclaw.ai](https://docs.openclaw.ai)
- Repositorio base: [github.com/openclaw/openclaw](https://github.com/openclaw/openclaw)
- Para soporte técnico de HotelClaw, contacta a quien configuró este sistema.

---

*HotelClaw — Concierge AI | Construido sobre OpenClaw (MIT License)*
*Aria es el corazón digital de tu hotel. 🛎️*
