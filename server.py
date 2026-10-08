import os
import json
import re
import unicodedata
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("HistoriaVarillas")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, "fundacion.json")

STOPWORDS = {"de", "la", "el", "los", "las", "un", "una", "que", "en", "y", "a",
             "del", "con", "por", "para", "al", "es", "se", "su", "sus", "lo",
             "quien", "quién", "cual", "cuál", "cuando", "cuándo", "como", "cómo"}


def norm(s: str) -> str:
    """Minúsculas y sin tildes, para búsquedas tolerantes."""
    s = unicodedata.normalize("NFD", s.lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


@mcp.tool()
def consultar_fundacion_las_varillas(tema: str = "") -> str:
    """
    Biblioteca histórica digital de Las Varillas.
    Deja 'tema' vacío para listar el índice de documentos (ID, título y tags).
    Pasa palabras clave o un ID (ej: '1903', 'ferrocarril', 'Dabbene',
    'Parada KM 81') para leer los documentos completos que coincidan.
    """
    if not os.path.exists(DATA_FILE):
        return "Error: archivo 'fundacion.json' no encontrado."

    with open(DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    tema = (tema or "").strip()

    # Modo índice
    if not tema:
        out = "ÍNDICE DEL ARCHIVO HISTÓRICO:\n\n"
        for d in data:
            out += f"- ID: {d['id']} | Título: {d['titulo']}\n  Tags: {', '.join(d['tags'])}\n"
        return out

    # Búsqueda por ID exacto
    for d in data:
        if norm(tema) == norm(d["id"]):
            return formatear([d])

    # Búsqueda por palabras clave, ordenada por cantidad de coincidencias
    palabras = [p for p in re.findall(r"\w+", norm(tema)) if p not in STOPWORDS and len(p) > 1]
    puntuados = []
    for d in data:
        texto = norm(d["titulo"] + " " + d["contenido"] + " " + " ".join(d["tags"]))
        score = sum(1 for p in palabras if p in texto)
        if score:
            puntuados.append((score, d))

    if not puntuados:
        return f"No se encontró información para '{tema}'. Prueba con otra palabra clave o consulta el índice."

    puntuados.sort(key=lambda x: -x[0])
    return formatear([d for _, d in puntuados])


def formatear(docs):
    out = ""
    for d in docs:
        out += (f"DOCUMENTO: {d['titulo']}\n"
                f"Criterio: {d['metadata'].get('criterio', '-')}\n"
                f"{d['contenido']}\n\n---\n\n")
    return out


if __name__ == "__main__":
    mcp.run()
