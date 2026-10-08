import os
import sys
import json
import re
import asyncio
import logging
import requests
from contextlib import asynccontextmanager, AsyncExitStack

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("mcp-backend")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
SERVER_SCRIPT = os.path.join(ROOT_DIR, "server.py")
DATA_FILE = os.path.join(ROOT_DIR, "fundacion.json")
# sys.executable = el Python del venv con el que lanzaste el backend (sirve en Windows, Mac y Linux)
PYTHON_PATH = sys.executable

OLLAMA_URL = "http://localhost:11434/api/chat"
MODELO = "llama3.2"
MAX_ITER = 5


class MCPState:
    session = None
    tools = []
    system_prompt = {}


state = MCPState()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Conectando con el servidor MCP en: {SERVER_SCRIPT}...")
    async with AsyncExitStack() as stack:
        params = StdioServerParameters(command=PYTHON_PATH, args=[SERVER_SCRIPT])
        read, write = await stack.enter_async_context(stdio_client(params))
        session = await stack.enter_async_context(ClientSession(read, write))
        await session.initialize()
        state.session = session
        state.tools = (await session.list_tools()).tools

        index = await session.call_tool("consultar_fundacion_las_varillas", arguments={"tema": ""})
        state.system_prompt = {
            "role": "system",
            "content": (
                "Eres un historiador experto en la ciudad de Las Varillas. Responde siempre en español.\n"
                "El índice es solo un resumen. Si el usuario pregunta por algo específico (personas, "
                "fechas, teorías), DEBES llamar a la herramienta consultar_fundacion_las_varillas "
                "usando el término o ID como parámetro 'tema'. "
                "Si la herramienta no encuentra nada, dilo con honestidad y no inventes datos.\n"
                f"ÍNDICE RESUMIDO:\n{index.content[0].text}"
            ),
        }
        logger.info("MCP conectado y listo.")
        yield
    logger.info("MCP desconectado.")


app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/fundacion")
def get_fundacion():
    if not os.path.exists(DATA_FILE):
        raise HTTPException(status_code=404, detail="Archivo de datos no encontrado.")
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    full_text = "\n\n".join(f"## {d['titulo']}\n{d['contenido']}" for d in data)
    return {"raw": data, "full_text": full_text}


def llamar_ollama(messages, tools):
    payload = {"model": MODELO, "messages": messages, "tools": tools, "stream": False}
    resp = requests.post(OLLAMA_URL, json=payload, timeout=300)
    resp.raise_for_status()
    return resp.json()["message"]


@app.websocket("/ws/chat")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket: cliente conectado")
    # Historial propio de cada conexión (no se mezcla entre pestañas)
    messages = [state.system_prompt]

    ollama_tools = [{
        "type": "function",
        "function": {"name": t.name, "description": t.description, "parameters": t.inputSchema},
    } for t in state.tools]

    try:
        while True:
            data = await websocket.receive_text()
            user_text = json.loads(data)["text"]
            messages.append({"role": "user", "content": user_text})
            respondido = False

            for _ in range(MAX_ITER):
                await websocket.send_json({"type": "status", "message": "Pensando..."})
                # requests es bloqueante: lo mandamos a un hilo para no congelar el servidor
                message = await asyncio.to_thread(llamar_ollama, messages, ollama_tools)
                content = message.get("content") or ""
                tool_calls = message.get("tool_calls") or []

                # Fallback: algunos modelos escriben la llamada como JSON en el texto
                if not tool_calls and '"name"' in content:
                    try:
                        m = re.search(r"\{.*\}", content, re.DOTALL)
                        if m:
                            j = json.loads(m.group())
                            if "name" in j:
                                tool_calls = [{"function": j}]
                    except Exception:
                        pass

                if not tool_calls:
                    messages.append({"role": "assistant", "content": content})
                    await websocket.send_json({"type": "response", "content": content})
                    respondido = True
                    break

                messages.append(message)
                for tc in tool_calls:
                    fn = tc.get("function", tc)
                    name = fn["name"]
                    args = fn.get("arguments", fn.get("parameters", {})) or {}
                    if isinstance(args, str):
                        args = json.loads(args)
                    await websocket.send_json({"type": "status", "message": "Consultando base histórica..."})
                    logger.info(f"[Herramienta MCP] {name} con {args}")
                    result = await state.session.call_tool(name, arguments=args)
                    messages.append({"role": "tool", "content": result.content[0].text, "tool_name": name})

            if not respondido:
                await websocket.send_json({
                    "type": "response",
                    "content": "No pude completar la consulta en el límite de pasos. Intenta reformular la pregunta.",
                })
    except WebSocketDisconnect:
        logger.info("WebSocket: cliente desconectado")
    except Exception as e:
        logger.error(f"Error en websocket: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
