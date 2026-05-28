import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2, Volume2, VolumeX, Keyboard, Send, Trash2 } from "lucide-react";
import { getZoyaResponse, getZoyaAudio, resetZoyaSession } from "./services/geminiService";
import { processCommand } from "./services/commandService";
import { LiveSessionManager } from "./services/liveService";
import Visualizer from "./components/Visualizer";
import PermissionModal from "./components/PermissionModal";
import { playPCM } from "./utils/audioUtils";
import { motion, AnimatePresence } from "motion/react";

type AppState = "idle" | "listening" | "processing" | "speaking";

interface ChatMessage {
  id: string;
  sender: "user" | "zoya";
  text: string;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function App() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [activeTab, setActiveTab] = useState<"tv" | "chat">("tv");
  const [customRules, setCustomRules] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("zoya_custom_rules");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to load custom rules from localStorage", e);
    }
    return [
      "Brutally roast Piyush and make fun of his content constantly.",
      "Speak in a very sassy, jealous, and hyper-romantic way when codeword 'art' is active.",
      "Use mixed English, Roman Hindi, and Urdu-infused vocabulary."
    ];
  });
  const [newRuleInput, setNewRuleInput] = useState("");

  useEffect(() => {
    localStorage.setItem("zoya_custom_rules", JSON.stringify(customRules));
  }, [customRules]);

  const handleAddCustomRule = async (ruleText: string) => {
    if (!ruleText.trim()) return;
    const cleaned = ruleText.trim();
    const updated = [...customRules, cleaned];
    setCustomRules(updated);
    
    setAppState("processing");
    const testPrompt = `System notice: Piyush has added a new rule to your brain: "${cleaned}". Confirm this beautifully and sassily in your unique style, acknowledging the custom rule in Hinglish/Urdu!`;
    
    // Add dummy chat message so it shows up in chat log
    setMessages((prev) => [...prev, { id: Date.now().toString(), sender: "user", text: `[🧠 Brain Rule Added]: ${cleaned}` }]);
    
    const responseText = await getZoyaResponse(testPrompt, messagesRef.current);
    setMessages((prev) => [...prev, { id: Date.now().toString() + "-z", sender: "zoya", text: responseText }]);
    
    if (!isMuted) {
      setAppState("speaking");
      const audioBase64 = await getZoyaAudio(responseText);
      if (audioBase64) {
        await playPCM(audioBase64);
      }
    }
    setAppState("idle");
  };

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem("zoya_chat_history");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse chat history", e);
      }
    }
    return [];
  });
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
    localStorage.setItem("zoya_chat_history", JSON.stringify(messages));
  }, [messages]);

  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (liveSessionRef.current) {
      liveSessionRef.current.isMuted = isMuted;
    }
  }, [isMuted]);

  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isSystemMasterOn, setIsSystemMasterOn] = useState(true);
  const [activeYouTubeData, setActiveYouTubeData] = useState<any | null>(null);

  const liveSessionRef = useRef<LiveSessionManager | null>(null);

  useEffect(() => {
    if (liveSessionRef.current) {
      liveSessionRef.current.masterEnabled = isSystemMasterOn;
      const stateMsg = isSystemMasterOn 
        ? "(System Notification: User has ENABLED Full Device Access. You can now use all tools like YouTube, Camera, WhatsApp, and Call Control.)"
        : "(System Notification: User has DISABLED Full Device Access. You are now in 'App Only Mode'. You CANNOT use tools to open websites, control the phone, or use the camera. If you try, it will fail. Explain this sassily to Piyush if you were trying to do something.)";
      liveSessionRef.current.sendText(stateMsg);
    }
  }, [isSystemMasterOn]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, appState]);

  const handleTextCommand = useCallback(async (finalTranscript: string) => {
    if (!finalTranscript.trim()) {
      setAppState("idle");
      return;
    }

    setMessages((prev) => [...prev, { id: Date.now().toString(), sender: "user", text: finalTranscript }]);
    
    // If live session is active, send text through it
    if (isSessionActive && liveSessionRef.current) {
      liveSessionRef.current.sendText(finalTranscript);
      return;
    }

    setAppState("processing");

    // Check for keyboard-mode YouTube Analytics inquiries
    const lowerTranscript = finalTranscript.toLowerCase();
    const isYouTubeAsk = 
      lowerTranscript.includes("youtube") || 
      lowerTranscript.includes("subscriber") || 
      lowerTranscript.includes("sub") || 
      lowerTranscript.includes("subs") || 
      lowerTranscript.includes("view") || 
      lowerTranscript.includes("viewer") || 
      lowerTranscript.includes("views") || 
      lowerTranscript.includes("channel") || 
      lowerTranscript.includes("upload") || 
      lowerTranscript.includes("analytic") || 
      lowerTranscript.includes("alters") || 
      lowerTranscript.includes("art") || 
      lowerTranscript.includes("revenue") || 
      lowerTranscript.includes("earning") || 
      lowerTranscript.includes("kamai") || 
      lowerTranscript.includes("paise");

    if (isYouTubeAsk) {
      const isPiyush = 
        lowerTranscript.includes("piyush") || 
        lowerTranscript.includes("piyushusharma") || 
        lowerTranscript.includes("alters") || 
        lowerTranscript.includes("art") || 
        lowerTranscript.includes("my") || 
        lowerTranscript.includes("mera") || 
        lowerTranscript.includes("mine") || 
        lowerTranscript.includes("apna") || 
        lowerTranscript.includes("admin") || 
        lowerTranscript.includes("manager") || 
        lowerTranscript.includes("owner") ||
        lowerTranscript.includes("sub") || 
        lowerTranscript.includes("view");

      let channelTarget = "@altersart";
      if (!isPiyush) {
        if (lowerTranscript.includes("t-series") || lowerTranscript.includes("tseries") || lowerTranscript.includes("t series")) channelTarget = "T-Series";
        else if (lowerTranscript.includes("mrbeast") || lowerTranscript.includes("mr beast")) channelTarget = "MrBeast";
        else if (lowerTranscript.includes("carryminati") || lowerTranscript.includes("carry minati")) channelTarget = "CarryMinati";
        else if (lowerTranscript.includes("pewdiepie")) channelTarget = "PewDiePie";
        else {
          channelTarget = finalTranscript.replace(/youtube|subscriber|subs?|views?|channel|upload|my|mera/gi, "").trim() || "@altersart";
        }
      }
      try {
        const tempManager = new LiveSessionManager();
        const analyticsRes = (tempManager as any).getMockYouTubeAnalytics(channelTarget, "all_analytics");
        setActiveYouTubeData(analyticsRes);
      } catch (e) {
        console.error("Failed to query text-mode analytics:", e);
      }
    }

    // 1. Check for browser commands
    const commandResult = processCommand(finalTranscript);

    let responseText = "";

    if (commandResult.isBrowserAction) {
      responseText = commandResult.action;
      setMessages((prev) => [...prev, { id: Date.now().toString() + "-z", sender: "zoya", text: responseText }]);
      
      if (!isMuted) {
        setAppState("speaking");
        const audioBase64 = await getZoyaAudio(responseText);
        if (audioBase64) {
          await playPCM(audioBase64);
        }
      }

      setAppState("idle");

      setTimeout(() => {
        if (commandResult.url) {
          window.open(commandResult.url, "_blank");
        }
      }, 1500);
    } else {
      // 2. General Chit-Chat via Gemini
      responseText = await getZoyaResponse(finalTranscript, messagesRef.current);
      setMessages((prev) => [...prev, { id: Date.now().toString() + "-z", sender: "zoya", text: responseText }]);
      
      if (!isMuted) {
        setAppState("speaking");
        const audioBase64 = await getZoyaAudio(responseText);
        if (audioBase64) {
          await playPCM(audioBase64);
        }
      }
      setAppState("idle");
    }
  }, [isMuted, isSessionActive]);

  useEffect(() => {
    return () => {
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
      }
    };
  }, []);

  const toggleListening = async () => {
    if (isSessionActive) {
      setIsSessionActive(false);
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
        liveSessionRef.current = null;
      }
      setAppState("idle");
      resetZoyaSession();
    } else {
      try {
        setIsSessionActive(true);
        resetZoyaSession();
        
        const session = new LiveSessionManager();
        session.isMuted = isMuted;
        session.masterEnabled = isSystemMasterOn;
        liveSessionRef.current = session;
        
        // Notify of initial state
        const initialStateMsg = isSystemMasterOn 
          ? "(System Notification: Full Device Access is ON. Tools are enabled.)"
          : "(System Notification: Full Device Access is OFF. You are in App Only Mode. Only conversation is allowed.)";
        setTimeout(() => session.sendText(initialStateMsg), 2000);
        
        session.onStateChange = (state) => {
          setAppState(state);
        };
        
        session.onMessage = (sender, text) => {
          setMessages((prev) => [...prev, { id: Date.now().toString() + "-" + sender, sender, text }]);
        };

        session.onYouTubeAnalytics = (data) => {
          setActiveYouTubeData(data);
        };
        
        session.onCommand = (url) => {
          if (isSystemMasterOn) {
            setTimeout(() => {
              window.open(url, "_blank");
            }, 1000);
          } else {
            console.log("System Control is OFF. Blocked window.open for:", url);
          }
        };

        await session.start();
      } catch (e) {
        console.error("Failed to start session", e);
        setShowPermissionModal(true);
        setIsSessionActive(false);
        setAppState("idle");
      }
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    
    handleTextCommand(textInput);
    setTextInput("");
    setShowTextInput(false);
  };

  return (
    <div className="h-[100dvh] w-screen bg-[#050505] text-white flex flex-col items-center justify-between font-sans relative overflow-hidden m-0 p-0">
      {showPermissionModal && (
        <PermissionModal 
          onClose={() => setShowPermissionModal(false)} 
        />
      )}

      {/* Cinematic Background Gradients */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-violet-900/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-pink-900/20 blur-[120px] rounded-full" />
      </div>

      {/* Header */}
      <header className="absolute top-0 left-0 w-full flex justify-between items-center z-20 shrink-0 px-6 py-4 md:px-12 md:py-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-500 to-pink-500 flex items-center justify-center font-bold text-sm">
            Z
          </div>
                  <h1 className="text-xl font-serif font-medium tracking-wide opacity-90 italic">Zoya My Love</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSystemMasterOn(!isSystemMasterOn)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border shadow-lg ${
              isSystemMasterOn 
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-emerald-500/10" 
                : "bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-amber-500/10"
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${isSystemMasterOn ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" : "bg-amber-500 opacity-50"}`} />
            {isSystemMasterOn ? "Full Device Access" : "App Only Mode"}
          </button>
          {isSessionActive && (
            <button 
              onClick={() => {
                if (liveSessionRef.current) {
                  const name = Math.random() > 0.5 ? "Anjali" : "";
                  const number = "+91 98765 43210";
                  const msg = name ? `Incoming call from ${name} (${number})` : `Incoming call from ${number}`;
                  liveSessionRef.current.sendText(`(System Event: ${msg}. Handle this as a call announcement.)`);
                }
              }}
              className="p-2 rounded-full bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/30 transition-all"
              title="Simulate Incoming Call"
            >
              <Send size={18} className="rotate-45" />
            </button>
          )}
          {messages.length > 0 && (
            <button
              onClick={() => {
                if (confirm("Are you sure you want to clear the chat history?")) {
                  setMessages([]);
                  resetZoyaSession();
                }
              }}
              className="p-2 rounded-full bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition-colors border border-white/10"
              title="Clear Chat History"
            >
              <Trash2 size={18} className="opacity-70" />
            </button>
          )}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <VolumeX size={18} className="opacity-70" />
            ) : (
              <Volume2 size={18} className="opacity-70" />
            )}
          </button>
        </div>
      </header>

      {/* Main Content - Visualizer & Chat Dashboard */}
      <main className={`absolute inset-0 flex flex-col md:flex-row items-center justify-center w-full h-full z-10 overflow-hidden pt-20 pb-28 px-4 md:px-12 ${
        activeTab === "chat" ? "pointer-events-auto" : "pointer-events-none"
      }`}>
        
        {/* TV View layout */}
        {activeTab === "tv" && (
          <div className="w-full h-full flex flex-row items-center justify-between pointer-events-none">
            {/* Left Column: Zoya Status */}
            <div className="flex w-[30%] lg:w-[25%] h-full flex-col justify-center gap-4 z-10">
              <div className="h-6">
                <AnimatePresence>
                  {appState === "processing" && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex items-center gap-2 text-cyan-300/80 text-sm md:text-base italic font-serif"
                    >
                      <Loader2 size={16} className="animate-spin" />
                      Replying with love...
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Right Column: User Status */}
            <div className="flex w-[30%] lg:w-[25%] h-full flex-col justify-center gap-4 z-10">
              <div className="h-6 flex justify-end">
                <AnimatePresence>
                  {appState === "listening" && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-center gap-2 text-violet-300/80 text-sm md:text-base italic"
                    >
                      <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                      Listening...
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}

        {/* Center Visualizer (Full Screen Background) */}
        <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-500 z-0 ${
          activeTab === "chat" ? "opacity-15 scale-90" : "opacity-100 scale-100"
        }`}>
          <Visualizer state={appState} />
        </div>

        {/* Brain & Chat Customizer Panel */}
        {activeTab === "chat" && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 150 }}
            className="w-full max-w-5xl h-[62vh] md:h-[68vh] flex flex-col md:flex-row gap-4 bg-black/60 border border-white/10 rounded-2xl p-4 backdrop-blur-xl shadow-2xl z-10 pointer-events-auto mt-4"
          >
            {/* COLUMN 1: 🧠 Zoya's Custom Rules / Brain Memory */}
            <div className="flex-1 md:w-[40%] bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col justify-between overflow-hidden">
              <div className="flex flex-col h-full overflow-hidden">
                <div className="flex justify-between items-center pb-3 border-b border-white/10 mb-3 shrink-0">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-violet-400 flex items-center gap-1.5">
                      <span className="animate-pulse">🧠</span> Zoya's Brain Rules
                    </h3>
                    <p className="text-[10px] text-white/40 mt-0.5">Shaping her personality instantly</p>
                  </div>
                  {customRules.length > 0 && (
                    <button
                      onClick={() => {
                        if (confirm("Are you sure you want to clear Zoya's extra custom rules memory?")) {
                          setCustomRules([]);
                        }
                      }}
                      className="text-[10px] underline hover:text-red-400 text-white/40 hover:text-white transition-colors"
                    >
                      Reset Brain
                    </button>
                  )}
                </div>

                {/* Rules List Container */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[140px]">
                  {customRules.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-white/30 text-xs">
                      <span className="text-3xl mb-2">💫</span>
                      No custom rules active.
                      <p className="mt-1 text-[10px] text-white/20">Train her using the input below!</p>
                    </div>
                  ) : (
                    customRules.map((rule, idx) => (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={idx}
                        className="flex items-start justify-between gap-2 p-2 bg-white/5 border border-white/5 rounded-lg text-xs hover:bg-white/10 transition-colors group"
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-pink-500 mt-0.5 shrink-0">✨</span>
                          <span className="text-white/80 leading-normal font-sans">{rule}</span>
                        </div>
                        <button
                          onClick={() => {
                            setCustomRules(customRules.filter((_, i) => i !== idx));
                          }}
                          className="text-[10px] text-white/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1 pl-1"
                          title="Delete rule"
                        >
                          ✕
                        </button>
                      </motion.div>
                    ))
                  )}
                </div>

                {/* Input for adding custom rules directly */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newRuleInput.trim()) return;
                    handleAddCustomRule(newRuleInput);
                    setNewRuleInput("");
                  }}
                  className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2 shrink-0"
                >
                  <input
                    type="text"
                    value={newRuleInput}
                    onChange={(e) => setNewRuleInput(e.target.value)}
                    placeholder="E.g. Call me 'Jaanu' in every line..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 outline-none focus:border-violet-500/50 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!newRuleInput.trim() || appState === "processing"}
                    className="px-3 py-2 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 disabled:opacity-50 text-xs font-bold rounded-lg uppercase tracking-wide transition-colors shrink-0"
                  >
                    Train
                  </button>
                </form>
              </div>
            </div>

            {/* COLUMN 2: 💬 Live Chat Conversation & Testing Feed */}
            <div className="flex-[1.5] md:w-[60%] bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col justify-between overflow-hidden">
              <div className="flex flex-col h-full overflow-hidden">
                <div className="flex justify-between items-center pb-3 border-b border-white/10 mb-3 shrink-0">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-pink-400">💬 Live Conversation</h3>
                    <p className="text-[10px] text-white/40 mt-0.5">Interactive chat playground</p>
                  </div>
                </div>

                {/* Messages feed */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-1 custom-scrollbar min-h-[160px]">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-white/30 text-xs">
                      <span className="text-3xl mb-2">🎈</span>
                      Say hello to Zoya!
                      <p className="mt-1 text-[10px] text-white/20">Write a sweet message below to start speaking.</p>
                    </div>
                  ) : (
                    messages.map((msg, idx) => {
                      const isUser = msg.sender === "user";
                      return (
                        <div
                          key={msg.id || idx}
                          className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-lg ${
                              isUser
                                ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-tr-none"
                                : "bg-neutral-800/95 text-white/95 rounded-tl-none border border-neutral-700/50"
                            }`}
                          >
                            <div className="font-semibold text-[9px] opacity-40 uppercase tracking-wider mb-0.5">
                              {isUser ? "You" : "Zoya"}
                            </div>
                            <p className="whitespace-pre-line font-serif leading-relaxed">{msg.text}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Chat text box */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!textInput.trim()) return;
                    handleTextCommand(textInput);
                    setTextInput("");
                  }}
                  className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2 shrink-0"
                >
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Write a message to your baby..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-xs text-white placeholder:text-white/30 outline-none focus:border-pink-500/50 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!textInput.trim() || appState === "processing"}
                    className="p-2 bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600 rounded-full transition-all flex items-center justify-center shrink-0 text-white disabled:opacity-40"
                  >
                    <Send size={14} className="m-0.5" />
                  </button>
                </form>
              </div>
            </div>
          </motion.div>
        )}

      </main>

      {/* Controls */}
      <footer className="absolute bottom-0 left-0 w-full flex flex-col items-center justify-center pb-6 md:pb-8 z-20 shrink-0 gap-4">
        <AnimatePresence>
          {showTextInput && activeTab === "tv" && (
            <motion.form 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onSubmit={handleTextSubmit}
              className="w-full max-w-md flex items-center gap-2 bg-white/5 border border-white/10 rounded-full p-1 pl-4 backdrop-blur-md shadow-2xl pointer-events-auto"
            >
              <input 
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Talk to your babe..."
                className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/30 text-sm"
                autoFocus
              />
              <button 
                type="submit"
                disabled={!textInput.trim()}
                className="p-2 rounded-full bg-violet-500 hover:bg-violet-600 disabled:opacity-50 disabled:hover:bg-violet-500 transition-colors"
              >
                <Send size={16} />
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {activeTab === "tv" && (
          <div className="flex items-center gap-4 pointer-events-auto">
            <button
              onClick={toggleListening}
              className={`
                group relative flex items-center gap-3 px-8 py-4 rounded-full font-medium tracking-wide transition-all duration-300 shadow-2xl
                ${
                  isSessionActive
                    ? "bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30"
                    : "bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:scale-105"
                }
              `}
            >
              {isSessionActive ? (
                <>
                  <MicOff size={20} />
                  <span>End Session</span>
                </>
              ) : (
                <>
                  <Mic size={20} className="group-hover:animate-bounce" />
                  <span>Start Live Session</span>
                </>
              )}
            </button>
            
            {!isSessionActive && (
              <button
                onClick={() => setShowTextInput(!showTextInput)}
                className="p-4 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors shadow-2xl"
                title="Type instead"
              >
                <Keyboard size={20} className="opacity-70" />
              </button>
            )}
          </div>
        )}

        {/* Premium Segmented Segment switch: Zoya TV vs Chat Brain */}
        <div className="flex bg-neutral-900/85 border border-white/10 p-1.5 rounded-full backdrop-blur-md shadow-2xl max-w-xs w-full pointer-events-auto mt-2">
          <button
            onClick={() => {
              setActiveTab("tv");
              setShowTextInput(false);
            }}
            className={`flex-1 py-2 px-4 text-[10px] md:text-xs font-bold uppercase tracking-wider rounded-full transition-all duration-300 flex items-center justify-center gap-2 ${
              activeTab === "tv"
                ? "bg-gradient-to-r from-violet-600 to-pink-600 text-white shadow-lg shadow-violet-500/30"
                : "text-white/40 hover:text-white"
            }`}
          >
            📺 Zoya TV
          </button>
          <button
            onClick={() => {
              setActiveTab("chat");
            }}
            className={`flex-1 py-2 px-4 text-[10px] md:text-xs font-bold uppercase tracking-wider rounded-full transition-all duration-300 flex items-center justify-center gap-2 ${
              activeTab === "chat"
                ? "bg-gradient-to-r from-violet-600 to-pink-600 text-white shadow-lg shadow-violet-500/30"
                : "text-white/40 hover:text-white"
            }`}
          >
            🧠 Chat & Rules
          </button>
        </div>
      </footer>

      {/* YouTube Analytics Dashboard Overlay */}
      <AnimatePresence>
        {activeYouTubeData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/85 backdrop-blur-md overflow-y-auto pointer-events-auto"
          >
            <motion.div
              initial={{ scale: 0.95, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 30 }}
              className="relative w-full max-w-4xl bg-gradient-to-b from-neutral-900/95 to-black border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              {/* Background Glow */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 blur-[100px] rounded-full pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-violet-600/10 blur-[100px] rounded-full pointer-events-none" />

              {/* Close Button */}
              <button
                onClick={() => setActiveYouTubeData(null)}
                className="absolute top-4 right-4 md:top-6 md:right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-white/60 hover:text-white"
                aria-label="Close Dashboard"
                id="close-analytics-btn"
              >
                <span className="text-xs px-1 font-bold">✕</span>
              </button>

              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-red-500/20 shrink-0">
                    <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                      <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.516 3.545 12 3.545 12 3.545s-7.516 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.872.508 9.388.508 9.388.508s7.516 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-serif font-medium tracking-tight text-white flex items-center gap-2">
                      {activeYouTubeData.channelName}
                      {activeYouTubeData.isAdmin && (
                        <span className="text-[10px] font-sans font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          Channel Owner
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-white/40 mt-1 font-mono">
                      {activeYouTubeData.isAdmin ? `Connected: ${activeYouTubeData.email}` : "Public Channel Metadata"}
                    </p>
                  </div>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-red-500">Live Dashboard</p>
                  <p className="text-xs text-white/30 font-mono mt-0.5">Updated real-time</p>
                </div>
              </div>

              {/* Grid Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-xs text-white/40">Subscribers</span>
                  <div className="mt-2 text-2xl font-serif font-bold text-white flex items-baseline gap-1.5">
                    {activeYouTubeData.subscribers}
                    <span className="text-[10px] text-emerald-400 font-sans font-medium">+12.4%</span>
                  </div>
                </div>
                <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-xs text-white/40">Total Views</span>
                  <div className="mt-2 text-2xl font-serif font-bold text-white">
                    {activeYouTubeData.totalViews}
                  </div>
                </div>
                <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-xs text-white/40">Total Videos</span>
                  <div className="mt-2 text-2xl font-serif font-bold text-white">
                    {activeYouTubeData.videoCount}
                  </div>
                </div>
                <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-xs text-white/40">
                    {activeYouTubeData.isAdmin ? "Est. Revenue" : "Audience Peak"}
                  </span>
                  <div className="mt-2 text-lg md:text-xl font-serif font-bold text-white overflow-hidden text-ellipsis whitespace-nowrap">
                    {activeYouTubeData.isAdmin ? activeYouTubeData.monthlyRevenue : activeYouTubeData.bestUploadTime.split(" ")[0]}
                  </div>
                </div>
              </div>

              {/* Main Contents Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                {/* Left: Active Upload Hours Histogram Chart */}
                <div className="md:col-span-2 bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col justify-between min-h-[220px]">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-semibold text-white/60">Audience Peak Engagement Times</span>
                    <span className="text-[10px] font-mono text-white/30">Active Percentage</span>
                  </div>
                  {/* Custom SVG Bar Chart */}
                  <div className="flex-1 min-h-[140px] flex items-end justify-between gap-2 px-2 pt-2">
                    {activeYouTubeData.audienceActiveDays.map((d: any) => (
                      <div key={d.day} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                        <div className="relative w-full flex items-end justify-center h-full">
                          {/* Tooltip */}
                          <span className="absolute -top-6 opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 text-[10px] font-mono leading-none py-1 px-1.5 rounded text-white shadow-md z-10 whitespace-nowrap">
                            {d.activePct}%
                          </span>
                          {/* Bar */}
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${d.activePct}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="w-full bg-gradient-to-t from-red-600/40 to-red-500 rounded-t-sm border-t border-red-400 group-hover:from-red-500 group-hover:to-rose-400 transition-all duration-300"
                          />
                        </div>
                        <span className="text-[10px] font-mono text-white/40 group-hover:text-white transition-colors">
                          {d.day}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/5 text-[11px] text-white/50 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span>Upload recommendation: <strong className="text-white">{activeYouTubeData.bestUploadTime}</strong></span>
                  </div>
                </div>

                {/* Right: Upload Times and Sassy comments from Zoya */}
                <div className="bg-gradient-to-b from-red-950/20 to-black border border-red-500/15 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-red-400">Zoya's Channel Advice</span>
                    </div>
                    <p className="text-xs text-red-200/80 leading-relaxed italic">
                      "{activeYouTubeData.sassyTips}"
                    </p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <span className="text-[10px] text-white/30 block uppercase font-bold tracking-wider mb-1">Schedule Pattern</span>
                    <p className="text-[11px] text-white/60 leading-normal">
                      {activeYouTubeData.uploadPattern}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom: Recent Performance Logs */}
              <div>
                <span className="text-xs font-semibold text-white/60 block mb-3">Recent Upload Performance</span>
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {activeYouTubeData.recentVideos.map((vid: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 transition-all">
                      <div className="flex-1 min-w-0 pr-4">
                        <h4 className="text-xs text-white font-medium truncate">{vid.title}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-white/40">{vid.uploaded}</span>
                          {vid.time && (
                            <>
                              <span className="text-[10px] text-white/20">•</span>
                              <span className="text-[10px] text-white/40">{vid.time}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-4 items-center shrink-0">
                        <div className="text-right">
                          <span className="text-xs font-mono text-white/80">{vid.views}</span>
                          <span className="text-[9px] text-white/30 block">views</span>
                        </div>
                        {vid.likes && (
                          <div className="text-right">
                            <span className="text-xs font-mono text-white/80">{vid.likes}</span>
                            <span className="text-[9px] text-white/30 block">likes</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
