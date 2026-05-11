# SEDCM Frontend Demo

Frontend React 18 + Vite para la demo de integracion con el backend SEDCM.

## Requisitos

- Node.js 18 o superior
- npm
- Backend SEDCM disponible en `http://127.0.0.1:3000`

## Instalacion

```bash
cd SEDCMFront
npm install
```

## Variables de entorno

Crea un archivo `.env` en `SEDCMFront` con:

```env
VITE_API_BASE_URL=http://127.0.0.1:3000
VITE_WS_URL=ws://127.0.0.1:3000/ws
```

Si no defines estas variables, el frontend usa esos mismos valores por fallback.

## Levantar backend para demo

Desde el repo backend:

```bash
cd "Backend SEDCM"
docker compose up -d --build
```

Servicios esperados:

- Backend REST en `http://127.0.0.1:3000`
- WebSocket en `ws://127.0.0.1:3000/ws`
- Postgres, Mosquitto, edge collector y edge executor para alimentar la demo

## Desarrollo local

```bash
cd SEDCMFront
npm run dev
```

Abrir normalmente:

- `http://127.0.0.1:5173`
- o `http://localhost:5173`

## Build

```bash
npm run build
```

## Que validar en la demo

Con backend encendido:

- `Backend: conectado`
- `Datos: backend`
- `Tiempo real: conectado`
- Inventario real visible
- Telemetria y logs actualizandose en vivo

Con backend apagado o URL invalida:

- `Backend: desconectado`
- `Datos: mock`
- `Tiempo real: desconectado`
- El dashboard mock sigue funcionando
