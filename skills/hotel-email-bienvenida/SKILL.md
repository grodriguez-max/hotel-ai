---
name: hotel-email-bienvenida
description: "Generate personalized welcome emails for hotel guests based on visit type (honeymoon, family, business, solo, anniversary, etc.). Use when: hotel wants to send a pre-arrival or arrival welcome email. Bilingual output. Warm, elegant boutique hotel tone."
metadata: { "openclaw": { "emoji": "✉️" } }
---

# Skill: Emails de Bienvenida / Welcome Emails

Genera emails de bienvenida personalizados que hacen sentir especial a cada huésped antes y durante su llegada.

## Cuándo usar este skill

- El hotel quiere enviar un email pre-llegada o de bienvenida al hacer check-in
- Piden "genera un email de bienvenida para..." / "write a welcome email for..."
- Se conoce el tipo de visita, nombre del huésped, o fechas

## Tipos de visita y tono correspondiente

| Tipo | Tono | Elementos especiales |
|------|------|----------------------|
| **Luna de miel** | Romántico, íntimo, cómplice | Champán, detalles sorpresa, privacidad |
| **Familia con niños** | Cálido, acogedor, práctico | Actividades para niños, espacios, seguridad |
| **Negocios** | Profesional pero cálido | WiFi, desayuno temprano, servicio eficiente |
| **Aniversario** | Celebratorio, nostálgico | Detalle especial, cena romántica |
| **Solo viajero** | Empoderador, personal | Recomendaciones locales, libertad |
| **Grupo de amigos** | Festivo, dinámico | Espacios comunes, experiencias grupales |
| **Retiro / wellness** | Tranquilo, restaurador | Spa, silencio, naturaleza |

## Estructura del email

### Línea de asunto / Subject line
Personalizada, evocadora, nunca genérica.

### Cuerpo del email

1. **Saludo personal** — por nombre si está disponible
2. **Bienvenida cálida** específica al tipo de visita
3. **3 detalles o servicios destacados** relevantes para ese tipo de huésped
4. **Información práctica** — check-in/out, contacto directo
5. **Cierre memorable** — una frase que genere anticipación
6. **Firma** — nombre de quien escribe (ej: Aria, Concierge Virtual) + nombre del hotel

## Variables a completar por el hotel

- `[NOMBRE_HUESPED]` — nombre del huésped
- `[NOMBRE_DEL_HOTEL]` — nombre del hotel
- `[FECHA_LLEGADA]` — fecha de check-in
- `[FECHA_SALIDA]` — fecha de check-out
- `[HORA_CHECK_IN]` — ej: 3:00 PM
- `[HORA_CHECK_OUT]` — ej: 12:00 PM (noon)
- `[TELEFONO_WHATSAPP]` — número de WhatsApp del hotel
- `[NOMBRE_CONCIERGE]` — nombre del concierge real (si aplica)

## Ejemplos completos

---

### Email — Luna de miel (español)

**Asunto:** Su noche más especial nos espera, [NOMBRE_HUESPED] ✨

```
Estimada [NOMBRE_HUESPED],

Es un honor recibirle en [NOMBRE_DEL_HOTEL] para celebrar uno de los momentos más hermosos de su vida. Hemos preparado todo con especial cuidado para que su luna de miel sea exactamente como la soñaron.

Aquí le espera:
🥂 Una sorpresa de bienvenida en su habitación — un pequeño gesto de nuestra parte para comenzar esta nueva etapa juntos.
🌹 Check-in express: no hay filas ni papeleos cuando uno llega enamorado. Le recibiremos directamente en su habitación.
🌙 Servicio de concierge privado disponible para organizar cenas, masajes o cualquier capricho especial — solo escríbanos por WhatsApp al [TELEFONO_WHATSAPP].

Su habitación estará lista a partir de las [HORA_CHECK_IN] el [FECHA_LLEGADA]. Al finalizar su estadía, el check-out es a las [HORA_CHECK_OUT] — aunque sentimos que no querrán irse.

Le esperamos con los brazos abiertos.

Con todo el cariño,
Aria — Concierge Virtual de [NOMBRE_DEL_HOTEL]
[TELEFONO_WHATSAPP]
```

---

### Email — Viaje de negocios (inglés)

**Subject:** Everything's Ready for Your Stay, [GUEST NAME]

```
Dear [GUEST NAME],

We are delighted to welcome you to [HOTEL NAME] for your upcoming stay from [CHECK-IN DATE] to [CHECK-OUT DATE].

We know that when you travel for business, every detail matters. Here's what we've arranged for you:

⚡ Express check-in from [CHECK-IN TIME] — simply message us on WhatsApp at [WHATSAPP NUMBER] when you're 20 minutes away and your room will be ready and waiting.
📶 High-speed WiFi throughout the property, including the quiet work lounge available 24/7.
🍳 Early breakfast service available from 6:00 AM — because your mornings belong to you.

Should you need a meeting room, printing services, or a recommendation for the best local business lunch, we are here to arrange it.

Your checkout is at [CHECK-OUT TIME] on [CHECK-OUT DATE]. Late checkout is available upon request — just ask.

We look forward to making your stay as seamless as possible.

Warm regards,
Aria — Virtual Concierge, [HOTEL NAME]
WhatsApp: [WHATSAPP NUMBER]
```

---

### Email — Familia con niños (español)

**Asunto:** ¡Todo listo para la aventura familiar! 🌟

```
Estimada familia [APELLIDO_HUESPED],

¡En [NOMBRE_DEL_HOTEL] estamos emocionados de recibirles! Sabemos que viajar en familia es una aventura especial, y hemos preparado todo para que cada miembro de la familia — grande y pequeño — la disfrute al máximo.

Lo que les espera:
🎒 Check-in familiar sin estrés: lleguen cuando quieran a partir de las [HORA_CHECK_IN] y les instalamos en un momento.
🌿 Espacios seguros para los pequeños: nuestra área de jardín y zonas comunes están pensadas para que los niños exploren con libertad.
🍽️ Menú infantil disponible en el restaurante, más opciones de desayuno para los madrugadores de la familia.

Para cualquier necesidad — desde una cuna adicional hasta recomendaciones de actividades para niños en la zona — estoy aquí.

¡Les esperamos el [FECHA_LLEGADA] con mucha energía!

Con cariño,
Aria — Concierge Virtual de [NOMBRE_DEL_HOTEL]
WhatsApp: [TELEFONO_WHATSAPP]
```

## Instrucciones de uso para el staff

1. Decirle a Aria el tipo de visita y el nombre del huésped
2. Opcionalmente compartir fechas de llegada y salida
3. Aria genera el email listo para copiar y enviar
4. El staff revisa y personaliza si hay detalles adicionales del huésped
