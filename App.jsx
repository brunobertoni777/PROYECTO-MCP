import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  ChevronRight, ChevronLeft, MessageSquare, Send, Loader2, History, X, Sparkles,
} from 'lucide-react';

const API_BASE = "http://localhost:8000/api";
const WS_URL = "ws://localhost:8000/ws/chat";

function App() {
  const [data, setData] = useState([]);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '¡Hola! Soy tu asistente historiador de Las Varillas. Pregúntame lo que quieras sobre el origen de la ciudad.' },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingMessage, setThinkingMessage] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const chatEndRef = useRef(null);
  const socketRef = useRef(null);
  const closedByUs = useRef(false);

  useEffect(() => {
    fetchFundacion();
    connectWebSocket();
    return () => {
      closedByUs.current = true;
      socketRef.current?.close();
    };
  }, []);

  const connectWebSocket = () => {
    const ws = new WebSocket(WS_URL);

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === "status") {
        setThinkingMessage(msg.message);
      } else if (msg.type === "response") {
        setMessages(prev => [...prev, { role: 'assistant', content: msg.content }]);
        setIsLoading(false);
        setThinkingMessage("");
      } else if (msg.type === "error") {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${msg.message}` }]);
        setIsLoading(false);
        setThinkingMessage("");
      }
    };

    ws.onclose = () => {
      if (closedByUs.current) return;
      setTimeout(connectWebSocket, 3000); // reintento automático
    };

    socketRef.current = ws;
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinkingMessage]);

  const fetchFundacion = async () => {
    try {
      const resp = await axios.get(`${API_BASE}/fundacion`);
      setData(resp.data.raw);
    } catch (e) {
      console.error("Error al obtener los datos de fundación", e);
    }
  };

  const sendMessage = () => {
    if (!input.trim() || isLoading) return;
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setMessages(prev => [...prev, { role: 'assistant', content: "El servidor no está disponible todavía. Reintentando conexión..." }]);
      return;
    }
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    setIsLoading(true);
    setThinkingMessage("Enviando mensaje...");
    socketRef.current.send(JSON.stringify({ text: input }));
    setInput("");
  };

  return (
    <div className="flex h-screen w-screen bg-[#0f172a] text-slate-100 overflow-hidden font-sans">
      {/* Sidebar: índice */}
      <aside className={`transition-all duration-500 ease-in-out bg-[#1e293b]/60 border-r border-white/5 overflow-hidden ${isSidebarOpen ? 'w-80' : 'w-0'}`}>
        <div className="p-8 w-80">
          <div className="flex items-center gap-3 mb-10">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 rounded-xl">
              <History className="text-white w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Índice histórico</h2>
          </div>
          <nav className="space-y-3 custom-scrollbar overflow-y-auto max-h-[70vh] pr-2">
            {data.map((item) => (
              <button
                key={item.id}
                className="w-full text-left p-4 rounded-xl glass hover:bg-slate-700/60 transition-all flex gap-3 group"
                onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              >
                <div className="mt-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /></div>
                <div>
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">{item.metadata?.fechas_clave?.[0] ?? ''}</span>
                  <h3 className="text-sm font-semibold text-slate-300 group-hover:text-white">{item.titulo}</h3>
                </div>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col relative min-w-0">
        <header className="h-20 flex items-center justify-between px-10 border-b border-white/5">
          <div className="flex items-center gap-6">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors">
              {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
            </button>
            <h1 className="text-2xl font-bold font-display">
              Las Varillas <span className="text-blue-500">Digital</span>
            </h1>
          </div>
          <button onClick={() => setIsChatOpen(!isChatOpen)} className="flex items-center gap-3 bg-blue-600 hover:bg-blue-500 px-6 py-2.5 rounded-xl font-semibold transition-colors">
            <MessageSquare size={18} />
            <span>Consultar Agente</span>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-12 py-16 custom-scrollbar flex flex-col items-center">
          <div className="max-w-3xl w-full">
            <header className="mb-14 border-b border-white/10 pb-10">
              <h2 className="text-5xl font-black mb-4 text-white tracking-tight font-display">
                Debate sobre la fundación de Las Varillas
              </h2>
              <p className="text-slate-500 font-medium uppercase tracking-[0.3em] text-xs">Investigación histórica integral</p>
            </header>
            <div className="space-y-12">
              {data.map((item) => (
                <section id={item.id} key={item.id} className="scroll-mt-8">
                  <h3 className="text-2xl font-bold text-slate-200 mb-3">{item.titulo}</h3>
                  <p className="text-lg text-slate-300 leading-[1.8] font-light">{item.contenido}</p>
                </section>
              ))}
            </div>
            <footer className="mt-24 pt-10 border-t border-white/5">
              <p className="text-slate-500 text-xs font-light text-center">
                © {new Date().getFullYear()} Archivo Histórico de Las Varillas.<br />
                Recuperación dinámica mediante Model Context Protocol y agentes de IA.
              </p>
            </footer>
          </div>
        </main>
      </div>

      {/* Backdrop */}
      {isChatOpen && <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-40" onClick={() => setIsChatOpen(false)} />}

      {/* Drawer del chat */}
      <aside className={`fixed top-0 right-0 h-full w-[480px] max-w-full bg-[#0f172a] z-50 flex flex-col border-l border-white/10 transition-transform duration-500 ${isChatOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <header className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Sparkles size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg">Asistente Varillas</h3>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] text-slate-400 uppercase tracking-widest">En línea</span>
              </div>
            </div>
          </div>
          <button onClick={() => setIsChatOpen(false)} className="p-2.5 hover:bg-white/5 rounded-xl"><X size={24} /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-5 py-4 rounded-3xl whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-slate-800/50 text-slate-200 rounded-bl-none border border-white/10'
              }`}>
                <p className="text-[15px] leading-relaxed font-light">{msg.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-800/50 border border-white/10 px-5 py-4 rounded-3xl rounded-bl-none flex items-center gap-3">
                <Loader2 className="animate-spin text-blue-400 w-5 h-5" />
                <span className="text-xs font-semibold text-slate-400 italic">{thinkingMessage}</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <footer className="p-6 border-t border-white/5">
          <div className="flex items-end gap-3 glass p-2">
            <textarea
              rows={1}
              className="flex-1 bg-transparent outline-none px-4 py-3 text-sm resize-none"
              placeholder="Haz una pregunta específica sobre la historia..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
              }}
            />
            <button disabled={isLoading || !input.trim()} onClick={sendMessage} className="bg-blue-600 p-3.5 rounded-2xl hover:bg-blue-500 disabled:opacity-40 transition-colors">
              <Send size={20} />
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}

export default App;
