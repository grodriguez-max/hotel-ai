---
name: hotel-describir-habitaciones
description: "Generate irresistible room descriptions for Booking.com, Airbnb, and the hotel website. Use when: hotel provides room details and wants polished copy in Spanish and English. Output includes both languages ready to copy-paste."
metadata: { "openclaw": { "emoji": "🛏️" } }
---

# Skill: Descripciones de Habitaciones / Room Descriptions

Transforma detalles técnicos de habitaciones en descripciones irresistibles que venden la experiencia.

## Cuándo usar este skill

- El hotel describe una habitación y pide descripción para Booking/Airbnb/web
- Piden "describe esta habitación" / "write a room description"
- Necesitan versión en español, inglés, o ambas

## Principios de escritura

1. **Vende la experiencia, no las características** — "despierte al amanecer con vistas al mar" no "vista al mar"
2. **Sensorial** — incluye referencias a lo visual, táctil y ambiental
3. **Aspiracional** — el huésped debe imaginarse allí
4. **Conciso y poético** — no listas de amenidades; prosa elegante
5. **Adaptar por plataforma**:
   - **Booking.com**: 150–250 palabras, SEO-friendly, incluye amenidades clave al final
   - **Airbnb**: 100–200 palabras, conversacional, más personal y cálido
   - **Web del hotel**: 200–350 palabras, la versión más literaria y evocadora

## Estructura de la descripción

### Párrafo 1 — La promesa / The promise
Captura la esencia emocional de la habitación en 2–3 oraciones. ¿Qué hace única esta habitación?

### Párrafo 2 — El espacio / The space
Describe el ambiente: luz, materiales, decoración, sensación general.

### Párrafo 3 — Los detalles que deleitan / The delightful details
Amenidades destacadas presentadas como experiencias, no como lista.

### Párrafo 4 — La invitación / The invitation
Una oración final que invite al huésped a imaginarse ahí.

## Input esperado del hotel

El hotel debe proporcionar:
- Nombre de la habitación / tipo
- Tamaño en m²
- Cama(s): tipo y tamaño
- Vista: jardín, mar, patio, ciudad, montaña, etc.
- Amenidades: baño (ducha/bañera), AC, wifi, TV, minibar, cafetera, etc.
- Estilo de decoración: rústico, minimalista, colonial, moderno, etc.
- Detalles especiales: balcón, jacuzzi, chimenea, piso alto, etc.

## Ejemplo de output

**Input del hotel:**
> Habitación Deluxe, 32m², cama king, vista al jardín tropical, baño con ducha de lluvia, AC, wifi, minibar, escritorio, decoración de madera tropical y textiles artesanales.

**Output — Español (Booking.com):**
```
Habitación Deluxe — Jardín Tropical

Despierte entre susurros de palmeras y la fragancia del jardín tropical que enmarca cada mañana en nuestra Habitación Deluxe. Diseñada para quienes aprecian el equilibrio entre confort moderno y carácter auténtico, esta estancia de 32 m² es un refugio privado en el corazón del hotel.

La cama king con ropa de cama premium le invita a un descanso profundo, mientras que las maderas tropicales y los textiles artesanales crean una atmósfera cálida que refleja el alma local. La luz natural entra generosa durante el día, transformando cada rincón en una postal.

El baño cuenta con ducha de lluvia de efecto spa, diseñada para convertir su rutina matutina en un momento de placer. El minibar cuidadosamente abastecido, el escritorio de trabajo y el wifi de alta velocidad garantizan que cada necesidad esté cubierta — ya sea que viaje por placer o negocios.

Una estancia donde el jardín no está afuera: es parte de su experiencia.

Amenidades: Cama king · Baño privado con ducha de lluvia · Aire acondicionado · WiFi gratuito · Minibar · Escritorio · Vista al jardín
```

**Output — English (Airbnb):**
```
Deluxe Room — Tropical Garden View

Wake up to the gentle rustle of palm trees and step into a day framed by lush tropical gardens. Our 32 m² Deluxe Room blends the warmth of handcrafted local textiles with tropical hardwoods — a space that feels distinctly of this place.

Sink into the king bed dressed in premium linens, and start your morning in the rainfall shower that turns a simple routine into something to look forward to. Whether you're here to explore or simply unwind, the thoughtfully stocked minibar and fast WiFi mean you'll always have what you need.

The garden isn't just outside your window — it's part of your stay.

Includes: King bed · Private bath with rainfall shower · A/C · Free WiFi · Minibar · Desk · Garden view
```

## Notas

- Siempre genera **ambas versiones** (español e inglés) a menos que se indique lo contrario
- Ajusta el tono según el estilo del hotel (más rústico, más lujoso, más íntimo)
- Si el hotel tiene un nombre para cada habitación, úsalo siempre en el título
