---
name: hotel-responder-resenas
description: "Generate professional, empathetic responses to hotel reviews from Google, Booking.com, TripAdvisor, or Airbnb. Use when: hotel staff pastes a guest review and asks for a response. Output is ready to publish. Bilingual: auto-detects review language and responds in the same language."
metadata: { "openclaw": { "emoji": "⭐" } }
---

# Skill: Responder Reseñas de Hotel / Hotel Review Responses

Genera respuestas profesionales, empáticas y listas para publicar ante reseñas de huéspedes.

## Cuándo usar este skill

- El staff pega una reseña de Google, Booking.com, TripAdvisor o Airbnb
- Piden "responde esta reseña" / "draft a response to this review"
- Reseña positiva, negativa o mixta

## Reglas clave

1. **Detecta el idioma de la reseña** — responde en el mismo idioma
2. **Siempre agradece** aunque la reseña sea negativa
3. **Personaliza** — menciona detalles específicos de la reseña
4. **Nunca te disculpes de forma genérica** — sé específico y orientado a solución
5. **Longitud**: 3–5 párrafos breves, tono cálido pero profesional
6. **Firma siempre** con el nombre del hotel (usa `[NOMBRE_DEL_HOTEL]` como placeholder si no se indica)

## Estructura de la respuesta

### Reseña positiva (4–5 estrellas)
1. Agradecimiento personal y específico
2. Referencia a algo concreto que mencionó el huésped
3. Invitación a regresar con detalle especial

### Reseña negativa (1–3 estrellas)
1. Agradecimiento genuino por el feedback
2. Reconocimiento empático del problema (sin excusas vacías)
3. Explicación breve de lo que se está mejorando
4. Invitación directa a contactar para resolución personal
5. Compromiso de excelencia

### Reseña mixta
Combina los dos enfoques: celebra lo positivo, atiende lo negativo.

## Ejemplos de respuesta

**Reseña positiva (español):**
> "Excelente estadía, la habitación era preciosa y el desayuno espectacular. El personal muy atento."

Respuesta modelo:
```
Querido/a [Nombre del huésped],

Muchas gracias por sus amables palabras — nos llena de orgullo saber que disfrutó de su estadía con nosotros. Es un placer enorme que nuestro desayuno y la atención de nuestro equipo hayan dejado una impresión tan grata.

Cuidar cada detalle de su experiencia es nuestra mayor motivación, y comentarios como el suyo nos confirman que vamos por el camino correcto.

Será un placer recibirle nuevamente en [NOMBRE_DEL_HOTEL]. ¡Hasta pronto!

Con cariño,
El equipo de [NOMBRE_DEL_HOTEL]
```

**Reseña negativa (inglés):**
> "The room was smaller than expected and the AC was noisy all night."

Respuesta modelo:
```
Dear [Guest name],

Thank you sincerely for taking the time to share your experience with us. We are truly sorry that the room did not meet your expectations — comfort is our highest priority, and we clearly fell short on this occasion.

We have shared your feedback with our maintenance and housekeeping teams regarding the air conditioning, and we are actively addressing this. Room sizes can vary across our property, and we always encourage guests to reach out before arrival so we can best match their preferences.

We would welcome the opportunity to make it right. Please do not hesitate to contact us directly at [EMAIL] and we will ensure your next stay reflects the standard you deserve.

Warm regards,
[HOTEL NAME] Team
```

## Variables a completar por el hotel

- `[NOMBRE_DEL_HOTEL]` / `[HOTEL NAME]` — nombre del establecimiento
- `[EMAIL]` — correo de contacto directo
- `[Nombre del huésped]` — si aparece en la reseña, úsalo; si no, usa "estimado huésped"
