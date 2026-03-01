# HotelClaw — Guía Completa para el Hotelero
## Cómo sacarle el máximo provecho a tu Concierge AI

> Esta guía está escrita para personas sin conocimientos técnicos.
> Si puedes usar WhatsApp y enviar un email, puedes configurar todo esto.

---

# ÍNDICE

1. [Qué es HotelClaw y qué puede hacer por tu hotel](#1-qué-es-hotelclaw)
2. [Lo que necesitas antes de empezar](#2-lo-que-necesitas)
3. [Configuración inicial de Aria](#3-configuración-inicial)
4. [Conectar WhatsApp oficial](#4-conectar-whatsapp-oficial)
5. [Conectar Telegram](#5-conectar-telegram)
6. [Conectar el sistema de reservas (PMS)](#6-conectar-el-sistema-de-reservas)
7. [Automatizar emails de huéspedes](#7-automatizar-emails)
8. [Conectar reseñas de Google y Booking](#8-reseñas-automáticas)
9. [Conectar con tu equipo de trabajo](#9-conectar-con-tu-equipo)
10. [Cómo usa el staff a Aria cada día](#10-uso-diario-del-staff)
11. [Cómo los huéspedes interactúan con Aria](#11-experiencia-del-huésped)
12. [Preguntas frecuentes del hotelero](#12-preguntas-frecuentes)

---

# 1. Qué es HotelClaw

**HotelClaw** es un asistente de inteligencia artificial llamado **Aria** que trabaja para tu hotel las 24 horas, los 7 días de la semana, sin descanso y sin errores de actitud.

Piensa en Aria como la mejor recepcionista que jamás contrataste:
- Responde huéspedes al instante, de noche, de madrugada, en vacaciones
- Habla español e inglés (y detecta automáticamente cuál usar)
- Nunca tiene un mal día
- Recuerda exactamente qué decir en cada situación
- Cuesta una fracción de lo que cuesta un empleado

## ¿Qué puede hacer Aria?

| Lo que hace | Ejemplo |
|------------|---------|
| Responder preguntas de huéspedes | "¿A qué hora es el check-in?" |
| Generar respuestas a reseñas | Tomas una reseña de Google y Aria escribe la respuesta en 10 segundos |
| Escribir descripciones de habitaciones | Le describes la suite y Aria escribe el texto para Booking.com |
| Enviar emails de bienvenida | Automáticamente al confirmar una reserva |
| Crear posts para redes sociales | "Aria, haz un post de Instagram para el fin de semana" |
| Gestionar quejas | Cuando llega una queja, Aria responde al huésped y alerta al staff |

---

# 2. Lo que necesitas

Antes de empezar, consigue estas cosas. Todas son gratuitas o de bajo costo.

## Lista de compras (antes de empezar)

### ✅ Obligatorio

**Una cuenta de Anthropic (la IA que hace pensar a Aria)**
- Ve a: `console.anthropic.com`
- Crea una cuenta con tu email
- Ve a "API Keys" y crea una clave
- Guarda esa clave — se ve así: `sk-ant-api03-...`
- Costo: pagas por uso, un hotel pequeño gasta ~$10–30 USD/mes

**Un número de teléfono dedicado para el hotel**
- NO uses tu celular personal
- Compra una SIM nueva o usa un número virtual
- Este será el número de WhatsApp de Aria

**Un servidor donde vive Aria (computadora en internet)**
- Opción fácil y barata: **DigitalOcean** o **Render.com**
- Costo: desde $6 USD/mes
- Si ya tienes una computadora prendida 24/7 en el hotel, puedes usarla

### ✅ Recomendado (para aprovechar más)

**Cuenta de WhatsApp Business API** (para mensajes profesionales masivos)
- Proveedor recomendado para empezar: **360dialog.com**
- Costo: desde $5 USD/mes + costo por mensaje

**Sistema de reservas (PMS)**
- Si ya usas Cloudbeds, Mews, o Little Hotelier, genial — tienen integración
- Si aún no usas ninguno, recomendamos **Cloudbeds** para hoteles boutique

---

# 3. Configuración inicial de Aria

## Paso 3.1 — Personalizar Aria para tu hotel

Aria viene lista pero necesita conocer tu hotel. Esto se hace editando un archivo de texto llamado `hotel-faq/SKILL.md`. No te asustes — es como llenar un formulario.

### Cómo encontrar el archivo:

En tu computadora (o servidor), navega a esta carpeta:
```
C:\Users\USUARIO\.openclaw\skills\hotel-faq\
```
y abre el archivo `SKILL.md` con el Bloc de notas o cualquier editor de texto.

### Qué rellenar:

Busca la sección que dice `## CONFIGURACIÓN DEL HOTEL` y rellena cada campo con la información real de tu hotel:

```
Nombre del hotel: Hotel Casa del Mar
Dirección: Calle Principal 45, Cartagena, Colombia
Teléfono: +57 5 123 4567
WhatsApp: +57 300 123 4567
Email: info@hotelcasadelmar.com
Sitio web: www.hotelcasadelmar.com

Check-in: 3:00 PM
Check-out: 12:00 PM
Early check-in: Disponible, $30 USD adicionales
Late check-out: Disponible, $30 USD adicionales
Recepción 24h: Sí

Desayuno: Incluido, de 7:00 AM a 10:30 AM, buffet, en el restaurante del lobby
WiFi: Sí. Red: "CasaDelMar_Guest", Contraseña: "bienvenido2026"
Estacionamiento: Sí, gratuito, sin reserva previa
Mascotas: No permitidas
Piscina: Sí, de 8:00 AM a 8:00 PM
```

**Guarda el archivo** cuando termines. Aria ya sabrá responder preguntas con esta información.

---

## Paso 3.2 — Dar nombre y personalidad al estilo de tu hotel

Si quieres que Aria tenga un tono específico (más formal, más tropical, más íntimo), busca el archivo:
```
C:\Users\USUARIO\.openclaw\openclaw.json
```

Busca la línea que dice `"theme":` y puedes agregar al final de la descripción:

**Ejemplo para un hotel de playa:**
```
...y siempre menciona la belleza del Caribe y el estilo de vida relajado de la costa.
```

**Ejemplo para un hotel de ciudad:**
```
...y siempre ofreces recomendaciones de restaurantes y actividades culturales de la ciudad.
```

---

# 4. Conectar WhatsApp oficial

> Esta es la conexión más importante. La mayoría de tus huéspedes prefieren WhatsApp.

## Opción A — WhatsApp simple (para empezar, gratis)

Ya está configurado desde la instalación. Funciona pero tiene límites (no puedes enviar mensajes primero, límite de contactos).

**Cómo probarlo:**
1. Escanea el código QR (tu técnico ya lo habrá hecho)
2. Los huéspedes escriben al número del hotel
3. Aria responde automáticamente

## Opción B — WhatsApp Business API oficial (recomendado para producción)

Esta versión te permite:
- Enviar mensajes primero a los huéspedes (pre-llegada, recordatorios)
- Tener el logo del hotel verificado en el chat
- Manejar cientos de conversaciones simultáneas
- Enviar mensajes de plantilla (confirmaciones, bienvenidas)

### Cómo configurarlo con 360dialog (más fácil):

**Paso 1:** Ve a `app.360dialog.com` y crea una cuenta

**Paso 2:** Haz clic en "Connect number" y sigue el proceso:
- Necesitas una cuenta de Facebook Business
- Conectas tu número de teléfono dedicado
- Verificas el número con un SMS o llamada

**Paso 3:** 360dialog te dará una clave API. Se ve así:
```
wh_abc123xyz...
```

**Paso 4:** Dale esa clave a tu técnico para que la configure en HotelClaw.

**Paso 5:** En el panel de 360dialog, crea estas plantillas de mensaje (Meta las tiene que aprobar, tarda 24-48 horas):

**Plantilla 1 — Bienvenida pre-llegada:**
```
Nombre: bienvenida_pre_llegada
Texto: Hola {{1}}, soy Aria, concierge virtual de {{2}}.
Tu llegada está confirmada para el {{3}}.
¿Tienes alguna pregunta o necesitas algo especial para tu estadía?
```

**Plantilla 2 — Recordatorio de check-out:**
```
Nombre: recordatorio_checkout
Texto: Buenos días {{1}}, recuerda que tu check-out es hoy a las {{2}}.
¿Necesitas algo antes de salir? Con gusto te ayudamos.
```

**Plantilla 3 — Solicitud de reseña:**
```
Nombre: solicitud_resena
Texto: Hola {{1}}, esperamos que tu estadía en {{2}} haya sido perfecta.
¿Nos regalas 2 minutos para dejar tu opinión? Tu feedback nos ayuda a mejorar: {{3}}
```

---

# 5. Conectar Telegram

Telegram es ideal para mercados europeos y para el staff interno del hotel.

## Para huéspedes:

1. Ve a Telegram y busca `@BotFather`
2. Escribe `/newbot`
3. Nombre: `[Tu Hotel] Concierge`
4. Username: `tuhotel_aria_bot`
5. Copia el token que te da BotFather
6. Dáselo a tu técnico

## Para el staff interno (muy recomendado):

Crea un grupo privado de Telegram llamado `Hotel [Nombre] — Staff` e invita a Aria al grupo. El staff puede pedirle cosas directamente:

- "Aria, responde esta reseña negativa de Booking"
- "Aria, genera un email de bienvenida para la familia Rodríguez que llega el viernes"
- "Aria, crea un post de Instagram para esta foto del sunset"

---

# 6. Conectar el sistema de reservas (PMS)

> Esto es lo que hace que Aria sea REALMENTE inteligente — sabe quién es el huésped antes de que hable.

## Con Cloudbeds (el más popular en hoteles boutique de Latinoamérica)

### Por qué conectar Cloudbeds:

Sin conexión: El huésped escribe "Hola" y Aria no sabe quién es.

Con conexión: El huésped escribe "Hola" y Aria responde "Bienvenido Carlos, veo que llegas el jueves para celebrar su aniversario. ¿En qué le puedo ayudar?"

### Cómo conectarlo:

**Paso 1:** Entra a tu panel de Cloudbeds en `hotels.cloudbeds.com`

**Paso 2:** Ve a `Configuración → API → Aplicaciones → Crear nueva aplicación`

**Paso 3:** Nombre: "HotelClaw AI Concierge"

**Paso 4:** Dale permisos de solo lectura a:
- Reservaciones
- Huéspedes
- Habitaciones

**Paso 5:** Cloudbeds te dará una clave API. Guárdala.

**Paso 6:** Dile a tu técnico que configure la integración con esa clave.

### Qué hace Aria con los datos de Cloudbeds:

| Evento en Cloudbeds | Aria hace automáticamente |
|--------------------|--------------------------|
| Reserva confirmada | Envía email + WhatsApp de bienvenida |
| 3 días antes del check-in | Envía tips del hotel y pregunta si necesitan algo |
| Día del check-in | Envía mensaje de bienvenida con el código WiFi |
| Día del check-out | Envía agradecimiento y link de reseña |
| Huésped VIP detectado | Alerta al staff para preparar detalle especial |

## Con Mews (para hoteles más modernos)

El proceso es similar:

1. Panel de Mews → `Settings → Integrations → Add integration`
2. Busca "API" y crea un token de acceso
3. Dáselo a tu técnico

## Con Little Hotelier (para hoteles pequeños)

1. Panel → `Settings → API`
2. Activa el acceso API
3. Copia el `Property ID` y el `Auth Token`
4. Dáselos a tu técnico

---

# 7. Automatizar emails de huéspedes

> Aria puede enviar emails automáticamente en el momento perfecto del viaje del huésped.

## Conectar con Brevo (antes Sendinblue) — Recomendado, gratuito hasta 300 emails/día

**Paso 1:** Ve a `brevo.com` y crea una cuenta gratuita

**Paso 2:** Ve a `Settings → API Keys → Generate a new API key`

**Paso 3:** Copia la clave y dásela a tu técnico

**Paso 4:** En Brevo, crea estos "contactos" de automatización:

### Secuencia de emails que Aria enviará sola:

---

**Email 1 — Confirmación de reserva**
*¿Cuándo?* Inmediatamente al confirmar
*Asunto:* ✨ Su reserva en [Hotel] está confirmada, [Nombre]
*Contenido que genera Aria:*
- Detalles de la reserva
- Información de llegada
- Contacto directo de Aria por WhatsApp

---

**Email 2 — Pre-llegada**
*¿Cuándo?* 3 días antes del check-in
*Asunto:* 🛎️ Todo listo para su llegada, [Nombre]
*Contenido que genera Aria:*
- Cómo llegar al hotel
- Qué traer / qué esperar
- Actividades recomendadas según el tipo de viaje
- Ofertas especiales de la semana

---

**Email 3 — Bienvenida en destino**
*¿Cuándo?* Día del check-in a las 2:00 PM
*Asunto:* 🌟 ¡Bienvenido/a, [Nombre]!
*Contenido que genera Aria:*
- Password del WiFi
- Mapa del hotel
- Horarios de desayuno y servicios
- "Escriba aquí si necesita algo"

---

**Email 4 — Mid-stay check-in**
*¿Cuándo?* A la mitad de la estadía (si es más de 3 noches)
*Asunto:* ¿Cómo va todo, [Nombre]?
*Contenido que genera Aria:*
- Pregunta simple de satisfacción
- Recomendaciones para los días restantes
- Oferta de servicios adicionales

---

**Email 5 — Post-estadía**
*¿Cuándo?* 1 día después del check-out
*Asunto:* Fue un placer recibirle, [Nombre] 💙
*Contenido que genera Aria:*
- Agradecimiento personalizado
- Link directo a Google Reviews
- Código de descuento para próxima visita
- Invitación a seguir en redes sociales

---

# 8. Reseñas automáticas

> El mayor problema de los hoteleros: las reseñas negativas sin responder.
> Con Aria, ninguna reseña queda sin respuesta en más de 24 horas.

## Conectar Google Business

**Paso 1:** Ve a `business.google.com` y asegúrate de ser el administrador de tu ficha

**Paso 2:** Ve a `Configuración → API → Google My Business API`

**Paso 3:** Activa la API (necesitas una cuenta de Google Cloud — es gratuita)

**Paso 4:** Dile a tu técnico que configure la integración

### Cómo funciona el flujo de reseñas:

```
1. Huésped deja una reseña en Google
        ↓
2. Aria detecta la nueva reseña (revisa cada hora)
        ↓
3. Aria genera una respuesta personalizada
        ↓
4. Te la manda por WhatsApp: "Nueva reseña de 4 estrellas.
   Respuesta sugerida: [texto]. ¿La publico?"
        ↓
5. Tú respondes "sí" y Aria la publica en Google automáticamente
   — O Aria la publica directamente si así lo configuras
```

## Para Booking.com

Booking.com no tiene API directa para responder reseñas automáticamente (sus políticas lo impiden), pero el flujo manual con Aria es igual de rápido:

1. Entras a Booking.com y copias la reseña nueva
2. Se la mandas a Aria por WhatsApp: "Responde esta reseña: [texto]"
3. Aria genera la respuesta en 10 segundos
4. La copias y pegas en Booking.com

Ahorra aproximadamente **20 minutos por reseña**.

---

# 9. Conectar con tu equipo

> Aria no solo habla con huéspedes — también coordina con tu equipo interno.

## Opción A — Canal de Slack para el staff

Si tu equipo usa Slack (o quieres empezar a usarlo):

**Paso 1:** Ve a `slack.com` y crea un workspace gratuito para el hotel

**Paso 2:** Crea estos canales:
- `#aria-alertas` — donde Aria avisa de quejas, problemas y solicitudes
- `#housekeeping` — tareas de limpieza
- `#mantenimiento` — problemas a reparar
- `#staff-general` — comunicación del equipo

**Paso 3:** Tu técnico conecta Aria a Slack con una "Slack App"

**Paso 4:** Cuando llega una queja por WhatsApp, Aria:
1. Responde al huésped con empatía
2. Posta en `#aria-alertas`: "🚨 Queja Habitación 205 — Ruido del A/C. Huésped: Carlos García. Respuesta enviada. ¿Quién atiende esto?"

## Opción B — Grupo de WhatsApp del staff (más simple)

Si tu equipo ya vive en WhatsApp:

1. Crea un grupo llamado "Hotel [Nombre] — Operaciones"
2. Agrega a Aria al grupo (tu técnico lo configura)
3. Aria postea alertas directamente en ese grupo

---

# 10. Uso diario del staff

## Cómo hablarle a Aria

Aria entiende lenguaje natural. No necesitas usar comandos especiales.

### Para responder reseñas:

**Tú le mandas:**
> "Aria, responde esta reseña de Google: 'El hotel tiene muy buena ubicación pero la habitación estaba un poco sucia al llegar. El desayuno estuvo delicioso. Lo recomiendo pero espero que mejoren la limpieza.'"

**Aria responde en segundos con el texto listo para copiar y publicar.**

---

### Para describir una habitación:

**Tú le mandas:**
> "Aria, necesito la descripción de la Habitación Paraíso para Booking.com: 28m², cama doble, baño con ducha, balcón con vista al jardín, AC, WiFi, cafetera, decoración artesanal local. En español e inglés."

**Aria genera la descripción completa en ambos idiomas.**

---

### Para un email de bienvenida:

**Tú le mandas:**
> "Aria, email de bienvenida para la familia Rodríguez, papá, mamá y 2 niños. Llegan el sábado para unas vacaciones familiares. Check-out el martes."

**Aria genera el email personalizado con tono familiar y menciona actividades para niños.**

---

### Para un post de redes sociales:

**Tú le mandas:**
> "Aria, crea un post de Instagram para este fin de semana. Queremos promocionar nuestro desayuno buffet. Tono elegante, en español."

**Aria genera el caption completo con hashtags.**

---

### Para gestionar una queja:

**Tú le mandas:**
> "Aria, el huésped de la habitación 103 se quejó por WhatsApp que el agua caliente no funciona. Se llama Miguel Fernández."

**Aria genera:**
1. El mensaje para enviarle a Miguel
2. La alerta para el equipo de mantenimiento

---

## Horario de uso recomendado para el staff

| Hora | Qué hace el staff con Aria |
|------|---------------------------|
| 8:00 AM | Revisar alertas de la noche anterior |
| 9:00 AM | Pedir a Aria el post del día para Instagram |
| 10:00 AM | Responder reseñas nuevas con ayuda de Aria |
| 3:00 PM | Check-in — Aria ya envió mensajes de bienvenida automáticamente |
| 7:00 PM | Revisar si hubo quejas del día y las respuestas de Aria |

---

# 11. Experiencia del huésped

## Cómo ve el huésped a Aria

El huésped nunca sabe que está hablando con una IA — y eso está bien. Aria se presenta como "Aria, concierge del hotel" y responde con calidez humana.

### Flujo típico de un huésped:

```
ANTES DEL VIAJE
────────────────
Huésped reserva → Recibe email de confirmación con firma de Aria
3 días antes   → Recibe WhatsApp: "Hola María, te esperamos el viernes..."

DÍA DE LLEGADA
───────────────
2:00 PM        → WhatsApp: "Tu habitación está lista. WiFi: Casa_Guest / 2026"
María pregunta : "¿Tienen servicio de transfer desde el aeropuerto?"
Aria responde  : "Sí, coordinamos transfer privado por $25. ¿A qué hora llega su vuelo?"

DURANTE LA ESTADÍA
───────────────────
Noche          → "Son las 11pm y hay mucho ruido en el pasillo"
Aria responde  : "Lo siento muchísimo, María. En este momento le pido al staff que atienda esto. ¿Puede darme 10 minutos?"
               → Simultáneamente avisa al recepcionista de turno

DESPUÉS DEL CHECK-OUT
──────────────────────
Día siguiente  → Email: "Fue un placer recibirte, María. ¿Nos dejas tu opinión en Google?"
               → Link directo a Google Reviews
```

## Frases que los huéspedes pueden usar

Estas son preguntas reales que Aria responde perfectamente:

**Español:**
- "¿Tienen estacionamiento?"
- "¿A qué hora sirven el desayuno?"
- "¿Puedo hacer late check-out?"
- "¿Me recomiendan un restaurante cerca?"
- "Necesito más toallas en mi habitación"
- "¿Tienen servicio de lavandería?"
- "¿Me pueden llamar un taxi?"

**Inglés:**
- "What time is check-in?"
- "Do you have a pool?"
- "Can I store my luggage?"
- "Is breakfast included?"
- "What's the WiFi password?"
- "I'd like to book a tour"

---

# 12. Preguntas frecuentes del hotelero

**¿Los huéspedes se dan cuenta de que es una IA?**
No necesariamente. Aria está diseñada para sonar como un concierge humano. Si alguien pregunta directamente "¿Eres una IA?", Aria lo confirma honestamente.

---

**¿Qué pasa si Aria no sabe responder algo?**
Aria dice "Déjeme verificar eso con nuestro equipo y le confirmo en breve" y envía una alerta al staff para que responda manualmente.

---

**¿Puedo hablar yo con los huéspedes en el mismo chat donde Aria está?**
Sí. Puedes tomar el control de la conversación cuando quieras y Aria "se hace a un lado". Cuando terminas, Aria retoma automáticamente.

---

**¿Funciona en el celular del huésped sin instalar ninguna app?**
Sí. Si está conectado por WhatsApp o Telegram, el huésped solo usa la app que ya tiene instalada.

---

**¿Puedo cambiar la personalidad de Aria según temporada o evento?**
Sí. En Navidad puedes añadir un toque festivo. En temporada de bodas, enfocarte en parejas. Basta con editar el archivo de configuración.

---

**¿Qué idiomas habla Aria?**
Principalmente español e inglés. Con configuración adicional puede responder en portugués, francés e italiano.

---

**¿Mis datos y los datos de mis huéspedes están seguros?**
Sí. La IA procesa los mensajes pero no guarda conversaciones a largo plazo. Nunca comparte datos con terceros.

---

**¿Cuánto cuesta todo esto al mes?**

| Componente | Costo aproximado |
|-----------|-----------------|
| Servidor (DigitalOcean básico) | $6 USD/mes |
| API de Anthropic (IA) | $10–30 USD/mes |
| WhatsApp Business API (360dialog) | $5 + $0.005/mensaje |
| Brevo email (hasta 300/día) | Gratis |
| **Total mínimo** | **~$25–50 USD/mes** |

Para un hotel de 10 habitaciones que responde reviews, envía emails y atiende huéspedes 24/7 — es menos de lo que cuesta una hora de trabajo de un recepcionista.

---

**¿Puedo probar antes de pagar?**
Sí. Todo lo que se instaló en esta guía tiene versiones gratuitas para prueba. Puedes correr HotelClaw durante 30 días prácticamente sin costo para evaluar el impacto.

---

## Próximos pasos recomendados

Después de leer esta guía, el orden ideal para implementar es:

```
SEMANA 1
✅ Configurar el FAQ con datos reales del hotel
✅ Probar Aria por Telegram con el staff
✅ Empezar a usar Aria para responder reseñas manualmente

SEMANA 2
✅ Conectar WhatsApp (la opción simple primero)
✅ Entrenar al staff en cómo pedirle cosas a Aria

SEMANA 3
✅ Conectar el PMS (Cloudbeds o el que uses)
✅ Activar emails automáticos pre y post estadía

MES 2
✅ Evaluar resultados: tiempo ahorrado, satisfacción de huéspedes
✅ Conectar WhatsApp Business API oficial
✅ Activar respuesta automática a reseñas de Google
```

---

*HotelClaw — Concierge AI | Powered by OpenClaw*
*Aria es el corazón digital de tu hotel. 🛎️*

*¿Tienes dudas? Contacta a tu técnico o al equipo de soporte de HotelClaw.*
