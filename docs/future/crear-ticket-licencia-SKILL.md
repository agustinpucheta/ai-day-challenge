---
name: crear-ticket-licencia
description: Crea un ticket de licencia en Jira con el formato fijo acordado, pidiendo como única entrada variable habitual la épica de destino.
---

# BORRADOR — NO ACTIVAR AÚN

Esta Skill es un borrador de segunda etapa. Antes de activarla, completar y verificar la plantilla real de licencia, el tipo de issue, los campos obligatorios, campos personalizados, valores permitidos y el campo de relación con la épica en la instancia Jira real.

> **Nota (2026-10-09):** el flujo principal de licencias se movió al dashboard (Fase 9 del MVP, D-020/D-021). Esta Skill queda como herramienta opcional del lado del desarrollo y sigue sin activarse antes de verificar la plantilla.

## Objetivo final

El formato de licencia debe ser fijo y reutilizable. En el uso diario, pedir únicamente la clave o nombre de la épica de destino. No volver a preguntar por campos que ya queden determinados por la plantilla.

## Precondición obligatoria

Antes de crear un ticket, comprobar que la plantilla de licencia está documentada y marcada como verificada en `docs/JIRA_DISCOVERY.md` y en el artefacto de plantilla acordado. Si no está verificada, detenerse, no inventar campos ni valores y explicar que falta descubrir la plantilla real.

## Flujo previsto una vez verificada

1. Resolver la épica indicada con las herramientas MCP de Jira disponibles.
2. Si hay más de una épica coincidente, pedir una aclaración que permita distinguirlas.
3. Cargar y aplicar exactamente la plantilla fija validada.
4. Validar campos y relación con la épica usando el esquema descubierto.
5. Presentar un borrador completo y pedir confirmación explícita para la escritura real.
6. Solo tras la confirmación, crear el issue mediante la herramienta MCP adecuada.
7. Verificar la creación y devolver la clave Jira y enlace.
8. No afirmar que el ticket se creó si la herramienta devuelve error o la verificación no confirma el resultado.

## Límites

- No cambiar contenido fijo de la plantilla según intuición.
- No crear tickets durante pruebas de desarrollo.
- No adivinar IDs de campos ni relaciones parent/epic.
- No pedir API tokens ni incluir credenciales en el prompt/archivo.
- Si la herramienta MCP necesaria no está disponible, reportar el bloqueo en vez de simular la escritura.

## Pendientes de completar

- Proyecto/key de destino por defecto, si existe.
- Tipo exacto de issue.
- Summary/description exactos y marcadores variables.
- Labels, assignee, priority, components, dates y campos personalizados fijos/variables.
- Campo correcto para asociar el issue a una épica.
- Reglas de confirmación y duplicado.
