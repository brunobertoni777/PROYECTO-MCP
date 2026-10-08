# Las Varillas Digital: MCP + FastAPI + React

## Estructura

```
proyecto/
├── fundacion.json
├── server.py            # servidor MCP (FastMCP)
├── requirements.txt
├── backend/main.py      # orquestador FastAPI
└── frontend/            # React + Vite + Tailwind
    ├── tailwind.config.js
    └── src/ (App.jsx, index.css)
```

## 1. Ollama

```bash
ollama pull llama3.2
ollama run llama3.2   # dejar corriendo (o que el servicio esté activo en el puerto 11434)
```

## 2. Backend (desde la carpeta `proyecto/`)

```bash
python -m venv venv
# Windows: .\venv\Scripts\activate     Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
python backend/main.py
```

Debe aparecer `MCP conectado y listo.` y Uvicorn en el puerto 8000.
Opcional, probar el servidor MCP solo: `mcp dev server.py`.

## 3. Frontend

Crear el proyecto Vite y luego copiar encima `src/App.jsx`, `src/index.css` y `tailwind.config.js` de esta carpeta:

```bash
npm create vite@latest frontend-app -- --template react
cd frontend-app
npm install axios lucide-react
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
# reemplazar tailwind.config.js, src/App.jsx y src/index.css por los de frontend/
npm run dev
```

Importante: usar `tailwindcss@3`. La versión 4 ya no tiene `npx tailwindcss init`
y no es compatible con `@tailwind base;`.

Abrir http://localhost:5173.

## Pruebas del taller

- "¿A qué postura suscribe Valter Dabbene?" → 1903
- "¿Qué dice el Centro de Estudios Parada KM 81?" → 1900
- "Dame un resumen de las tres teorías."
- "¿Cuándo llegó el tren?" → 1904 (y 1903 como contexto)

Nota: "Lorenzo Dabbene" (pedido en el entregable) no aparece en el documento de debates.
Si tu profe te dio material sobre él, agregá un objeto más en `fundacion.json` con ese contenido.
