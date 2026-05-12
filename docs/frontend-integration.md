# Frontend Integration

## Estado actual del frontend

- FE-1: Backend health indicator.
  - Cliente REST base.
  - `GET /health`.
  - Indicador `Backend: conectado/desconectado/verificando`.

- FE-2: Inventario real desde `/api/v1/inventory`.
  - Inventario backend cargado cuando el backend esta disponible.
  - Fallback a inventario mock si falla el backend.
  - Indicador `Datos: backend/mock`.

- FE-3: Telemetria y auditoria reales.
  - Telemetria de nodo desde `/api/v1/telemetry/node`.
  - Telemetria ambiental desde `/api/v1/telemetry/environment`.
  - Auditoria de comandos desde `/api/v1/audit/commands`.
  - Fallback a datos simulados/locales cuando no hay respuesta backend.

- FE-4: WebSocket en tiempo real.
  - Conexion a `ws://127.0.0.1:3000/ws`.
  - Actualizacion en vivo de telemetria, cambios de estado, comandos, ACK y escalacion.
  - Indicador `Tiempo real: conectado/desconectado/conectando`.

- FE-5: Guia demo y limpieza visual.
  - Documentacion para demo.
  - Etiquetas y textos de modo backend/mock ajustados para no confundir la demostracion.
  - Dedupe minimo de logs de auditoria.

- FE-11B: Controles manuales.
  - Reiniciar nodo.
  - Apagar nodo.
  - Aplicar cooling al rack seleccionado.
  - Logs locales al enviar comando.
  - ACK visual apoyado en eventos WebSocket existentes.

## Variables de entorno

```env
VITE_API_BASE_URL=http://127.0.0.1:3000
VITE_WS_URL=ws://127.0.0.1:3000/ws
```

## Endpoints REST consumidos

- `GET /health`
- `GET /api/v1/inventory`
- `GET /api/v1/telemetry/node`
- `GET /api/v1/telemetry/environment`
- `GET /api/v1/audit/commands`
- `POST /api/v1/commands`

## WebSocket

- URL:
  - `ws://127.0.0.1:3000/ws`

- Eventos manejados:
  - `telemetry_node_received`
  - `telemetry_environment_received`
  - `node_status_changed`
  - `rack_status_changed`
  - `command_published`
  - `command_ack_received`
  - `escalation_event`

## Mapeos importantes

- Backend `zones[]` -> frontend `zones`
- Backend `racks[]` -> frontend `racks`
- Backend `nodes[]` -> frontend `servers[]`

- Estados:
  - `Normal` -> `estable`
  - `Warning` -> `peligro`
  - `Critico` -> `critico`
  - `OFFLINE` queda pendiente para FE-12B si aun no esta implementado en la rama objetivo

## Controles manuales

- Reiniciar:
  - UI: `Reiniciar`
  - Backend action: `soft_reboot`

- Apagar:
  - UI: `Apagar`
  - Backend action: `hard_shutdown`

- Aplicar cooling:
  - UI: `Aplicar cooling`
  - Backend action: `set_hvac_mode`
  - Mode: `cooling`

- Solo se habilitan si:

```js
backendStatus === 'connected'
dataSource === 'backend'
```

## Fallback

- Si backend falla, el frontend usa mock.
- Si WebSocket falla, REST sigue funcionando.
- Modo mock conserva metricas simuladas.
- Los graficos y paneles no deben romperse si una llamada backend falla.

## Como probar

1. Levantar backend con Docker Compose.

```bash
docker compose up -d --build
```

2. Levantar frontend.

```bash
npm install
npm run dev
```

3. Abrir la aplicacion en el navegador.
   - `http://127.0.0.1:5173`
   - o `http://localhost:5173`

4. Verificar indicadores:
   - `Backend: conectado`
   - `Datos: backend`
   - `Tiempo real: conectado`

5. Validar inventario real.
   - Seleccionar `Zona A`
   - Abrir `Rack A1`

6. Probar controles manuales.
   - `Reiniciar`
   - `Apagar`
   - `Aplicar cooling`

7. Verificar logs.
   - Debe aparecer log local de comando enviado.
   - Debe llegar evento `command_ack_received`.
   - Deben verse logs `ACKED`.

8. Probar fallback mock.
   - Apagar backend o usar una URL invalida.
   - Confirmar `Datos: mock`.
   - Confirmar que el dashboard siga mostrando metricas simuladas.

## Estado pendiente

- FE-12B: mostrar estado `OFFLINE` visualmente.
- Limpieza final de mocks si el equipo decide eliminar fallback.
- Control manual avanzado.
- Permisos y autenticacion.
