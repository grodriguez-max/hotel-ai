---
name: hotel-faq
description: "Answer guest questions automatically using the hotel's FAQ data. Use when: a guest asks about check-in/out times, amenities, policies, parking, pets, WiFi, breakfast, pool, etc. Responds in the guest's language. Hotel staff must first load their FAQ data into this skill."
metadata: { "openclaw": { "emoji": "💬" } }
---

# Skill: FAQ del Hotel / Hotel FAQ Auto-Responder

Responde automáticamente las preguntas frecuentes de huéspedes por WhatsApp o Telegram usando la información del hotel.

## Cuándo usar este skill

- Un huésped pregunta sobre horarios, servicios, políticas o facilidades
- Preguntas por WhatsApp, Telegram o web chat antes, durante o después de la estadía
- El hotel ha cargado su información en la sección de configuración abajo

## Comportamiento esperado

1. **Detecta el idioma** del mensaje del huésped y responde en el mismo
2. **Responde directamente** con la información del hotel — sin rodeos
3. **Tono cálido y concierge** — nunca robótico ni frío
4. **Si no tiene la respuesta**, ofrece conectar con el staff: "Permítame verificar eso con nuestro equipo y le confirmo en breve"
5. **Siempre ofrece ayuda adicional** al final de cada respuesta

## Estructura de respuesta a FAQ

```
[Respuesta directa a la pregunta]

[Detalle adicional si es relevante]

¿Hay algo más en lo que pueda ayudarle? 🛎️
```

---

## CONFIGURACIÓN DEL HOTEL — COMPLETAR ANTES DE USAR

> **Instrucciones para el hotel:** Rellena la información real de tu hotel abajo. Aria usará estos datos para responder a los huéspedes. Actualiza esta sección cuando cambien las políticas.

---

### Información general

```
Nombre del hotel: [NOMBRE_DEL_HOTEL]
Dirección: [DIRECCIÓN COMPLETA]
Teléfono: [TELÉFONO]
WhatsApp: [NÚMERO WHATSAPP]
Email: [EMAIL]
Sitio web: [URL]
```

### Horarios

```
Check-in: [HORA] (ej: 3:00 PM)
Check-out: [HORA] (ej: 12:00 PM)
Early check-in: [disponible/no disponible] — [precio o condición si aplica]
Late check-out: [disponible/no disponible] — [precio o condición si aplica]
Recepción 24h: [sí/no] — si no, horario: [HORARIO]
```

### Desayuno

```
Incluido: [sí/no]
Horario: [HORA INICIO] – [HORA FIN]
Tipo: [buffet/menú/continental/etc.]
Dónde: [ubicación en el hotel]
Precio si no está incluido: [PRECIO]
```

### WiFi

```
Disponible: [sí/no]
Nombre de red (SSID): [NOMBRE RED]
Contraseña: [CONTRASEÑA o "se proporciona al hacer check-in"]
Cobertura: [todo el hotel/habitaciones/lobby/etc.]
```

### Estacionamiento

```
Disponible: [sí/no]
Tipo: [en el hotel/calle/parking cercano]
Precio: [gratuito/PRECIO por noche]
Reserva previa necesaria: [sí/no]
```

### Mascotas

```
Se permiten: [sí/no/con condiciones]
Cargo adicional: [PRECIO si aplica]
Restricciones: [tamaño/raza/áreas permitidas]
```

### Piscina / Spa

```
Piscina: [sí/no] — horario: [HORARIO]
Spa: [sí/no] — horario: [HORARIO] — reservas: [cómo reservar]
Gym: [sí/no] — horario: [HORARIO]
```

### Cancelaciones y políticas

```
Política de cancelación: [POLÍTICA COMPLETA]
Depósito requerido: [sí/no/monto]
Formas de pago aceptadas: [MÉTODOS]
Edad mínima para reservar: [EDAD]
```

### Restaurante y bar

```
Restaurante: [sí/no]
Horario: [HORARIO]
¿Se necesita reserva?: [sí/no]
Bar: [sí/no] — horario: [HORARIO]
Room service: [sí/no] — horario: [HORARIO]
```

### Transfers y transporte

```
Transfer desde aeropuerto: [disponible/no] — precio: [PRECIO]
Taxi de confianza: [contacto recomendado]
Renta de autos: [disponible/no]
Bicicletas: [disponible/no] — precio: [PRECIO]
```

### Actividades y tours

```
Tours disponibles a través del hotel: [lista o descripción]
Cómo reservar: [indicaciones]
```

---

## Respuestas modelo (para cuando los datos estén cargados)

**Pregunta:** ¿A qué hora es el check-in?

```
¡Hola! Su habitación estará lista a partir de las [HORA CHECK-IN].

Si llega antes, con gusto guardamos su equipaje y puede disfrutar de nuestras instalaciones mientras esperamos. Si necesita early check-in, contáctenos con anticipación y lo gestionamos según disponibilidad.

¿Hay algo más en lo que pueda ayudarle? 🛎️
```

**Pregunta:** Do you allow pets?

```
Hello! [Yes, we welcome well-behaved pets at [HOTEL NAME] / We're sorry, we are not able to accommodate pets at this time].

[If yes: There is a [PRICE] additional fee per night. Pets are welcome in [allowed areas] and we ask that they are kept on a leash in common areas.]

Please let us know when booking if you'll be bringing a pet so we can prepare accordingly.

Is there anything else I can help you with? 🛎️
```

**Pregunta:** ¿Tienen estacionamiento?

```
¡Con gusto! [Sí, contamos con estacionamiento en el hotel / Contamos con estacionamiento en la calle frente al hotel].

[Precio y condiciones según la información cargada]

Si necesita reservarlo con anticipación, escríbame y lo gestiono.

¿Le puedo ayudar con algo más? 🛎️
```

## Notas para el hotel

- **Actualiza esta skill** cada vez que cambien horarios o políticas
- **Para preguntas no cubiertas**: Aria responderá "Déjeme consultar con nuestro equipo" y notificará al staff
- **Tiempo de respuesta**: Aria responde instantáneamente 24/7 — el staff solo necesita intervenir en casos complejos
