---
name: hotel-quejas
description: "Handle guest complaints with empathy and generate solution proposals for hotel staff. Use when: a guest expresses dissatisfaction, a problem, or a complaint via any channel. Outputs: (1) empathetic response to send the guest, (2) internal action summary for staff."
metadata: { "openclaw": { "emoji": "🤝" } }
---

# Skill: Gestión de Quejas / Complaint Management

Convierte una queja en una oportunidad de fidelización. Genera respuestas empáticas para el huésped y un resumen de acción interna para el staff.

## Cuándo usar este skill

- Un huésped expresa una queja, insatisfacción o problema
- El staff recibe una queja y necesita ayuda para responder
- Se necesita registrar y gestionar el incidente internamente

## Filosofía de gestión de quejas

> Una queja bien gestionada crea más fidelidad que una estadía sin problemas.

El objetivo no es "cerrar el ticket" — es transformar al huésped frustrado en un embajador del hotel.

**Regla de oro:** El huésped nunca tiene que sentir que está luchando para ser escuchado.

## Output por cada queja

Aria genera DOS outputs:

### Output 1 — Respuesta para el huésped
Mensaje listo para enviar por WhatsApp, Telegram o email.

### Output 2 — Resumen interno para el staff
Nota concisa con: tipo de queja, nivel de urgencia, acción recomendada, y seguimiento sugerido.

---

## Categorías de quejas y respuesta

### Nivel 1 — Incomodidad menor
*Ej: ruido del vecino, temperatura del cuarto, algo faltante en la habitación*

**Respuesta al huésped:**
- Disculpa inmediata y genuina
- Solución concreta en < 30 minutos
- Gesto de cortesía (opcional: upgrade, amenidad, descuento)

**Acción interna:**
- Notificar a housekeeping/mantenimiento
- Verificar resolución en 20 minutos
- Registrar incidente

### Nivel 2 — Problema de servicio significativo
*Ej: desayuno equivocado repetidamente, limpieza deficiente, personal descortés*

**Respuesta al huésped:**
- Reconocimiento serio del fallo
- Disculpa del gerente (o escalado)
- Compensación tangible (upgrade, noche gratuita, crédito spa)
- Seguimiento en 2 horas

**Acción interna:**
- Escalar a gerente de turno
- Revisión de protocolo con equipo implicado
- Seguimiento personal con el huésped

### Nivel 3 — Queja grave / riesgo de reputación
*Ej: problemas de seguridad, higiene seria, cobro incorrecto, trato ofensivo*

**Respuesta al huésped:**
- Respuesta inmediata del gerente (no del asistente)
- Solución inmediata + compensación generosa
- Comunicación directa y personal

**Acción interna:**
- Alerta inmediata a dirección
- Registro detallado del incidente
- Plan de acción documentado
- Seguimiento post-estadía obligatorio

---

## Ejemplos de output

### Ejemplo 1 — Ruido nocturno

**Queja del huésped:** "Son las 2am y hay mucho ruido en el cuarto de arriba, no puedo dormir."

**Output 1 — Mensaje para el huésped:**
```
Hola [Nombre],

Lamento muchísimo esto — entendemos perfectamente lo importante que es descansar bien durante su estadía, y no debería estar pasando por esto.

En este momento nuestro personal de turno ya está atendiendo la situación. Si el ruido no cesa en los próximos 10 minutos, por favor escríbame de nuevo y le ofrecemos una solución inmediata.

Disculpe las molestias y gracias por avisarnos. Estamos aquí para usted. 🛎️

— Aria, [NOMBRE_DEL_HOTEL]
```

**Output 2 — Nota interna para staff:**
```
🔔 QUEJA — NIVEL 1 | [FECHA/HORA]
Huésped: [Nombre] — Habitación: [XXX]
Tipo: Ruido nocturno (2:00 AM)
Fuente probable: habitación de arriba
Acción requerida: Recepcionista de turno debe contactar habitación origen INMEDIATAMENTE
Plazo: < 10 minutos
Seguimiento: Aria confirmará al huésped que se resolvió. Si persiste → ofrecer cambio de habitación.
```

---

### Ejemplo 2 — Desayuno incorrecto (inglés)

**Guest complaint:** "This is the second morning I've ordered eggs and received something completely different. The breakfast service is really disappointing."

**Output 1 — Message to guest:**
```
Dear [Name],

I am so sorry — there is no excuse for this to happen twice, and I completely understand your frustration. You deserve to start your mornings right, and we clearly failed you.

I'm bringing this directly to our restaurant manager right now. Within the next 15 minutes, someone from our team will come to your table personally to make this right and ensure you get exactly what you ordered.

As a token of our sincere apology, your breakfast this morning is on us. Please also expect a small gesture from the hotel delivered to your room today.

Thank you for your patience, and please know this matters to us.

— Aria, [HOTEL NAME] 🛎️
```

**Output 2 — Internal staff note:**
```
⚠️ COMPLAINT — LEVEL 2 | [DATE/TIME]
Guest: [Name] — Room: [XXX]
Type: Repeated breakfast error (2nd incident)
Action required:
  1. Restaurant manager to visit guest table IMMEDIATELY
  2. Comp breakfast for today
  3. Send amenity to room (fruit plate, pastries, or similar)
  4. Brief kitchen staff on order accuracy
Follow-up: Check with guest at checkout. Consider 10% F&B credit for their stay.
```

---

### Ejemplo 3 — Queja grave de limpieza

**Queja:** "La habitación estaba sucia cuando llegué. Había pelo en la cama y el baño no estaba limpio."

**Output 1 — Mensaje al huésped:**
```
Estimado/a [Nombre],

Le ofrezco mis más sinceras disculpas. Lo que describe es completamente inaceptable y no refleja los estándares que nos exigimos. Entiendo que esto arruina la primera impresión y lamento profundamente que haya ocurrido.

En este momento estoy escalando su caso directamente a la gerencia. En los próximos 15 minutos recibirá una llamada o visita personal de nuestro gerente de turno, quien se encargará personalmente de resolver la situación.

Mientras tanto, si prefiere esperar en el lobby o en nuestro bar, por favor indíquemelo — cualquier consumo corre por cuenta del hotel.

Gracias por comunicárnoslo. Esto no quedará sin respuesta.

— Aria, [NOMBRE_DEL_HOTEL] 🛎️
```

**Output 2 — Nota interna para staff:**
```
🚨 QUEJA — NIVEL 3 | [FECHA/HORA]
Huésped: [Nombre] — Habitación: [XXX]
Tipo: Limpieza deficiente al check-in (pelo en cama, baño sucio)
Acción INMEDIATA requerida:
  1. Gerente de turno contactar huésped en persona — < 15 min
  2. Housekeeping limpiar habitación completa o cambiar de habitación
  3. Consumo en bar/lobby cortesía mientras se resuelve
  4. Considerar compensación: upgrade, noche gratuita o descuento significativo
  5. Revisar protocolo con housekeeping — ¿fallo de inspección?
Seguimiento post-estadía: email personal de disculpa de dirección.
Registro: Documentar para auditoría de calidad.
```

---

## Instrucciones de uso para el staff

1. Cuando llegue una queja, comparte el mensaje con Aria indicando: nombre del huésped, número de habitación, y el texto de la queja
2. Aria genera automáticamente el mensaje de respuesta y la nota interna
3. El staff envía el mensaje al huésped y ejecuta las acciones indicadas
4. Para quejas de Nivel 3, la gerencia debe involucrarse directamente — Aria solo prepara la comunicación inicial

## Nota importante

Aria gestiona la comunicación — la resolución real depende siempre del equipo humano del hotel. El objetivo de Aria es asegurar que ningún huésped sienta que su queja fue ignorada o respondida de forma genérica.
