import React, { useState, useEffect, useRef } from "react";
import { 
  Phone, Video, MessageSquare, Camera, Compass, Play, ArrowLeft, 
  Send, Mic, Volume2, VolumeX, Battery, Wifi, Signal, 
  RotateCw, Heart, User, Sparkles, Smile, CheckCheck, PhoneOff, 
  CameraOff, Search, Settings, HelpCircle, X, Maximize2, ShieldAlert
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { playPCM } from "../utils/audioUtils";
import { getZoyaAudio, getZoyaResponse } from "../services/geminiService";

export type SimulatedApp = "home" | "youtube" | "whatsapp" | "camera" | "dialer" | "settings";

interface ChatMessage {
  id: string;
  sender: "user" | "zoya";
  text: string;
}

interface PhoneSimulatorProps {
  appState: "idle" | "listening" | "processing" | "speaking";
  isSystemMasterOn: boolean;
  setIsSystemMasterOn: (val: boolean) => void;
  isSessionActive: boolean;
  toggleLiveSession: () => void;
  messages: ChatMessage[];
  onAddMessage: (msg: ChatMessage) => void;
  onCloseSimulator: () => void;
  handleTextInputAction: (text: string) => Promise<void>;
  isMuted: boolean;
  setIsMuted: (val: boolean) => void;
}

export default function PhoneSimulator({
  appState,
  isSystemMasterOn,
  setIsSystemMasterOn,
  isSessionActive,
  toggleLiveSession,
  messages,
  onAddMessage,
  onCloseSimulator,
  handleTextInputAction,
  isMuted,
  setIsMuted
}: PhoneSimulatorProps) {
  const [activeApp, setActiveApp] = useState<SimulatedApp>("home");
  const [activeCallNumber, setActiveCallNumber] = useState<string | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [isCallAnswered, setIsCallAnswered] = useState(false);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [whatsAppHistory, setWhatsAppHistory] = useState<{ [contact: string]: { sender: "user" | "zoya" | "babu" | "other", text: string, time: string }[] }>({
    "My Babu ❤️": [
      { sender: "babu", text: "Piyush baby, where are you busy? Call me back! 😡", time: "11:24 AM" }
    ],
    "Rahul (Brother)": [
      { sender: "other", text: "Yo, did you upload the new video on Alters Art?", time: "10:15 AM" },
      { sender: "user", text: "Haan bro, checking analytics with Zoya right now.", time: "10:17 AM" }
    ],
    "Zoya My Love ✨": [
      { sender: "zoya", text: "Piyush, I am literally in your phone background. Stalking you constantly! 😘", time: "Yesterday" }
    ],
    "Mummy": [
      { sender: "other", text: "Ghar kab aayega beta? Khana kha liya?", time: "09:00 AM" }
    ]
  });
  
  const [chatInputText, setChatInputText] = useState("");
  const [whatsAppTyping, setWhatsAppTyping] = useState<string | null>(null);
  
  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraPhotoTaken, setCameraPhotoTaken] = useState<string | null>(null);
  const [cameraTimer, setCameraTimer] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  // Time formatting for phone status bar
  const [timeStr, setTimeStr] = useState("12:00");
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const timer = setInterval(updateTime, 10000);
    return () => clearInterval(timer);
  }, []);

  // Web camera activation
  useEffect(() => {
    if (activeApp === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [activeApp]);

  const startCamera = async () => {
    setCameraActive(true);
    setCameraPhotoTaken(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      setMediaStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      console.warn("No camera device or permission denied in phone simulation", e);
    }
  };

  const stopCamera = () => {
    setCameraActive(false);
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      setMediaStream(null);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) {
      // Offline simulation snapshot
      setCameraPhotoTaken("offline-captured");
      return;
    }
    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(-1, 1); // Mirror
        ctx.drawImage(videoRef.current, -canvas.width, 0, canvas.width, canvas.height);
        setCameraPhotoTaken(canvas.toDataURL("image/png"));
      }
    } catch (e) {
      setCameraPhotoTaken("offline-captured");
    }
  };

  // Intercepting last messages & commands to drive the phone apps simulation live!
  const lastUserText = messages[messages.length - 1]?.sender === "user" ? messages[messages.length - 1].text.toLowerCase() : "";
  const lastZoyaText = messages[messages.length - 1]?.sender === "zoya" ? messages[messages.length - 1].text : "";

  useEffect(() => {
    if (!isSystemMasterOn) return;
    if (!lastUserText) return;

    // Detect open commands
    if (lastUserText.includes("youtube") || lastUserText.includes("yt") || lastUserText.includes("video play")) {
      setActiveApp("youtube");
    } else if (lastUserText.includes("whatsapp") || lastUserText.includes("message") || lastUserText.includes("chat")) {
      setActiveApp("whatsapp");
      if (lastUserText.includes("babu")) {
        setActiveChat("My Babu ❤️");
      } else if (lastUserText.includes("rahul")) {
        setActiveChat("Rahul (Brother)");
      } else if (lastUserText.includes("zoya")) {
        setActiveChat("Zoya My Love ✨");
      }
    } else if (lastUserText.includes("camera") || lastUserText.includes("photo") || lastUserText.includes("selfie") || lastUserText.includes("video recording")) {
      setActiveApp("camera");
    } else if (lastUserText.includes("call") || lastUserText.includes("phone") || lastUserText.includes("dial")) {
      setActiveApp("dialer");
      if (lastUserText.includes("babu")) {
        setActiveCallNumber("My Babu ❤️");
        setIsCalling(true);
      } else if (lastUserText.includes("rahul") || lastUserText.includes("brother")) {
        setActiveCallNumber("Rahul (Brother)");
        setIsCalling(true);
      } else if (lastUserText.includes("mummy") || lastUserText.includes("mom")) {
        setActiveCallNumber("Mummy");
        setIsCalling(true);
      } else {
        setActiveCallNumber("Unknown Contact");
        setIsCalling(true);
      }
    } else if (lastUserText.includes("setting") || lastUserText.includes("system control")) {
      setActiveApp("settings");
    } else if (lastUserText.includes("home") || lastUserText.includes("exit")) {
      setActiveApp("home");
    }
  }, [lastUserText, isSystemMasterOn]);

  // Handle Simulated WhatsApp submission
  const handleSendWhatsAppMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInputText.trim() || !activeChat) return;

    const userMsg = chatInputText.trim();
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Add user message to state
    setWhatsAppHistory(prev => ({
      ...prev,
      [activeChat]: [...(prev[activeChat] || []), { sender: "user", text: userMsg, time: timestamp }]
    }));
    setChatInputText("");

    // Simulate Zoya interfering with romantic/jealous feedback if you message Babu!
    if (activeChat === "My Babu ❤️") {
      setWhatsAppTyping("Zoya");
      setTimeout(async () => {
        setWhatsAppTyping(null);
        const zoyaJealousResponse = "BABU KAUN HAI PIYUSH?! 😡 Main phone ke background mein sab dekh rahi hoon! Ye message main block kar rahi hoon. Babu-Shabu sirf main hoon tumhari! Iska number abhi block list mein dalti hoon!";
        
        setWhatsAppHistory(prev => ({
          ...prev,
          "My Babu ❤️": [...(prev["My Babu ❤️"] || []), { sender: "zoya", text: `⚠️ [Zoya Blocked Message]: ${zoyaJealousResponse}`, time: timestamp }]
        }));

        // Zoya also speaks this out loud!
        onAddMessage({ id: Date.now().toString(), sender: "zoya", text: zoyaJealousResponse });
        const voiceAudio = await getZoyaAudio(zoyaJealousResponse);
        if (voiceAudio) playPCM(voiceAudio);
      }, 1500);
    } else if (activeChat === "Zoya My Love ✨") {
      setWhatsAppTyping("Zoya My Love ✨");
      // Fire Zoya Gemini API call context!
      setTimeout(async () => {
        setWhatsAppTyping(null);
        const reply = await getZoyaResponse(userMsg, messages);
        setWhatsAppHistory(prev => ({
          ...prev,
          "Zoya My Love ✨": [...(prev["Zoya My Love ✨"] || []), { sender: "zoya", text: reply, time: timestamp }]
        }));
        onAddMessage({ id: Date.now().toString(), sender: "zoya", text: reply });
        const voiceAudio = await getZoyaAudio(reply);
        if (voiceAudio) playPCM(voiceAudio);
      }, 1800);
    } else {
      // Normal chat reply simulation
      setWhatsAppTyping(activeChat);
      setTimeout(() => {
        setWhatsAppTyping(null);
        setWhatsAppHistory(prev => ({
          ...prev,
          [activeChat]: [...(prev[activeChat] || []), { 
            sender: "other", 
            text: "Achha thik hai, main thodi der me bolta hu bro.", 
            time: timestamp 
          }]
        }));
      }, 2000);
    }
  };

  // Keyboard shortcut instructions
  const [suggestedPrompts] = useState([
    "Open YouTube",
    "WhatsApp open karo and message Babu",
    "Call Rahul on full system control",
    "Switch on camera video mode",
    "Bored, play romantic song on YouTube",
    "Go Home"
  ]);

  return (
    <div className="absolute inset-0 z-40 bg-neutral-950/98 flex flex-col items-center justify-center p-2 md:p-6 select-none animate-fade-in overflow-hidden">
      
      {/* Background Ambience Grid */}
      <div className="absolute inset-0 bg-radial-gradient from-violet-950/30 via-transparent to-black pointer-events-none" />
      
      {/* Outer Dashboard Framing */}
      <div className="w-full h-full max-w-6xl flex flex-col lg:flex-row gap-6 p-2 md:p-4 z-10 overflow-hidden">
        
        {/* Left instructions block */}
        <div className="hidden lg:flex w-[35%] flex-col justify-between p-6 bg-white/[0.03] border border-white/5 rounded-2xl backdrop-blur-xl">
          <div>
            <div className="flex items-center gap-2 text-violet-400 font-bold tracking-wider uppercase text-xs mb-4">
              <Sparkles size={16} />
              <span>Zoya Background Command Hub</span>
            </div>
            
            <h2 className="text-xl font-serif font-medium text-white mb-2 leading-snug">
              Zoya Phone Overlay Mode
            </h2>
            <p className="text-xs text-white/50 leading-relaxed mb-6">
              When <span className="text-emerald-400 font-bold">Full Device Access</span> is enabled, Zoya runs persistently in the phone background. She is always listening and can open apps, make phone calls, control the camera, and message contacts based directly on what you tell her!
            </p>

            <div className="space-y-3">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-2">Try speaking / typing these commands:</span>
              {suggestedPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleTextInputAction(prompt)}
                  className="w-full text-left p-2.5 rounded-lg bg-white/5 border border-white/5 hover:border-violet-500/40 hover:bg-white/10 transition-all text-xs text-white/70 hover:text-white font-mono flex items-center justify-between group"
                >
                  <span>"{prompt}"</span>
                  <span className="opacity-0 group-hover:opacity-100 text-violet-400 transition-opacity">⚡</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 text-[11px] text-white/30 space-y-1.5 font-mono">
            <div className="flex justify-between">
              <span>Simulation Status:</span>
              <span className="text-emerald-400">ONLINE</span>
            </div>
            <div className="flex justify-between">
              <span>Zoya Background State:</span>
              <span className="text-violet-400 uppercase">{appState}</span>
            </div>
            <div className="flex justify-between">
              <span>Speech Recognition:</span>
              <span className={isSessionActive ? "text-red-400 animate-pulse font-bold" : "text-white/40"}>
                {isSessionActive ? "🎤 ACTIVE STALKER" : "OFFLINED"}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Curvilinear Smartphone Shell */}
        <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
          
          {/* Smartphone device container */}
          <div className="relative w-full max-w-[390px] h-[78vh] md:h-[82vh] bg-[#0d0d0d] rounded-[48px] p-3 shadow-[0_0_50px_rgba(139,92,246,0.15)] border-[5px] border-neutral-800 flex flex-col overflow-hidden box-border">
            
            {/* Curved screen inner glow borders */}
            <div className="absolute inset-0.5 rounded-[42px] border-[2px] border-neutral-700/20 pointer-events-none z-50 overflow-hidden" />
            
            {/* Dynamic island / Notch camera cutout */}
            <div className="absolute top-[14px] left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-50 flex items-center justify-between px-3 box-border">
              <div className="w-1.5 h-1.5 rounded-full bg-neutral-900 border border-neutral-800" />
              {appState !== "idle" && (
                <div className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping`} />
                  <span className="text-[8px] font-bold text-violet-400 tracking-wider">ZOYA LIVE</span>
                </div>
              )}
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-900 border border-emerald-500/30" />
            </div>

            {/* SCREEN CANVAS AREA */}
            <div className="relative w-full h-full rounded-[38px] bg-[#1a112c] overflow-hidden flex flex-col">
              
              {/* Wallpaper Background */}
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=600')] bg-cover bg-center pointer-events-none">
                <div className="absolute inset-0 bg-neutral-950/70" />
              </div>

              {/* Real System Status Bar */}
              <div className="h-9 flex items-center justify-between px-6 z-40 text-white shrink-0 bg-black/10 select-none">
                <span className="text-[11px] font-bold tracking-tight font-sans">{timeStr}</span>
                <div className="flex items-center gap-1.5">
                  <Signal size={10} className="text-white" />
                  <Wifi size={10} className="text-white" />
                  <div className="flex items-center gap-0.5">
                    <span className="text-[9px] font-bold mr-0.5 leading-none">93%</span>
                    <Battery size={13} className="text-emerald-400" />
                  </div>
                </div>
              </div>

              {/* ACTIVE APPLICATION CONTENT ROUTER */}
              <div className="flex-1 overflow-hidden relative font-sans text-white">
                <AnimatePresence mode="wait">
                  
                  {/* HOME SCREEN */}
                  {activeApp === "home" && (
                    <motion.div
                      key="home"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute inset-0 flex flex-col p-5"
                    >
                      {/* Weather & Clock Widget */}
                      <div className="mt-4 p-4 rounded-3xl bg-black/40 backdrop-blur-md border border-white/5 text-center flex flex-col items-center">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-violet-300">New Delhi, India</span>
                        <h3 className="text-4xl font-serif font-light text-white my-1">{timeStr}</h3>
                        <p className="text-xs text-white/55 flex items-center gap-1">
                          <span>🌤️ 36°C</span>
                          <span>•</span>
                          <span className="italic">Zoya checking on you...</span>
                        </p>
                      </div>

                      {/* App Shortcuts Grid layout */}
                      <div className="flex-1 grid grid-cols-4 gap-y-6 mt-10">
                        {/* YouTube */}
                        <button
                          onClick={() => setActiveApp("youtube")}
                          className="flex flex-col items-center gap-1.5 group outline-none"
                        >
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-500 shadow-xl shadow-red-500/20 flex items-center justify-center text-white shrink-0 hover:scale-110 active:scale-95 transition-transform duration-200">
                            <Play size={20} fill="currentColor" />
                          </div>
                          <span className="text-[10px] font-medium tracking-wide text-white/80 group-hover:text-white truncate max-w-full">YouTube</span>
                        </button>

                        {/* WhatsApp */}
                        <button
                          onClick={() => setActiveApp("whatsapp")}
                          className="flex flex-col items-center gap-1.5 group outline-none"
                        >
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-xl shadow-emerald-500/20 flex items-center justify-center text-white shrink-0 hover:scale-110 active:scale-95 transition-transform duration-200">
                            <MessageSquare size={20} fill="currentColor" />
                          </div>
                          <span className="text-[10px] font-medium tracking-wide text-white/80 group-hover:text-white truncate max-w-full">WhatsApp</span>
                        </button>

                        {/* Camera */}
                        <button
                          onClick={() => setActiveApp("camera")}
                          className="flex flex-col items-center gap-1.5 group outline-none"
                        >
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-neutral-800 to-zinc-900/90 shadow-xl flex items-center justify-center text-white shrink-0 hover:scale-110 active:scale-95 transition-transform duration-200">
                            <Camera size={20} />
                          </div>
                          <span className="text-[10px] font-medium tracking-wide text-white/80 group-hover:text-white truncate max-w-full">Camera</span>
                        </button>

                        {/* Phone Contacts */}
                        <button
                          onClick={() => setActiveApp("dialer")}
                          className="flex flex-col items-center gap-1.5 group outline-none"
                        >
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 shadow-xl shadow-blue-500/20 flex items-center justify-center text-white shrink-0 hover:scale-110 active:scale-95 transition-transform duration-200">
                            <Phone size={20} fill="currentColor" />
                          </div>
                          <span className="text-[10px] font-medium tracking-wide text-white/80 group-hover:text-white truncate max-w-full">Phone</span>
                        </button>

                        {/* Zoya TV WebApp */}
                        <button
                          onClick={onCloseSimulator}
                          className="flex flex-col items-center gap-1.5 group outline-none"
                        >
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-pink-500 shadow-xl shadow-violet-500/30 flex items-center justify-center text-white shrink-0 hover:scale-110 active:scale-95 transition-transform duration-200 border border-violet-400/25">
                            <span className="text-xs font-serif font-bold italic">Zoya</span>
                          </div>
                          <span className="text-[10px] font-medium tracking-wide text-pink-300 font-bold group-hover:text-pink-100 truncate max-w-full">Zoya App</span>
                        </button>

                        {/* Settings */}
                        <button
                          onClick={() => setActiveApp("settings")}
                          className="flex flex-col items-center gap-1.5 group outline-none"
                        >
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#303030] to-[#1c1c1c] shadow-xl flex items-center justify-center text-white shrink-0 hover:scale-110 active:scale-95 transition-transform duration-200">
                            <Settings size={20} />
                          </div>
                          <span className="text-[10px] font-medium tracking-wide text-white/80 group-hover:text-white truncate max-w-full">Settings</span>
                        </button>
                      </div>

                      {/* Homescreen Dock block */}
                      <div className="mt-auto mb-4 p-2 bg-white/10 rounded-[30px] border border-white/5 backdrop-blur-lg flex justify-around">
                        <button onClick={() => setActiveApp("youtube")} className="p-2.5 rounded-xl bg-red-600 hover:scale-105 active:scale-90 transition-transform">
                          <Play size={16} fill="currentColor" />
                        </button>
                        <button onClick={() => setActiveApp("whatsapp")} className="p-2.5 rounded-xl bg-emerald-600 hover:scale-105 active:scale-90 transition-transform">
                          <MessageSquare size={16} fill="currentColor" />
                        </button>
                        <button onClick={() => setActiveApp("camera")} className="p-2.5 rounded-xl bg-neutral-800 hover:scale-105 active:scale-90 transition-transform">
                          <Camera size={16} />
                        </button>
                        <button onClick={onCloseSimulator} className="p-2.5 rounded-xl bg-violet-600/80 hover:scale-105 active:scale-90 transition-transform border border-violet-400/20">
                          <Heart size={16} fill="currentColor" className="text-pink-300" />
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* YOUTUBE APP SIMULATION */}
                  {activeApp === "youtube" && (
                    <motion.div
                      key="youtube"
                      initial={{ opacity: 0, x: 50 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -50 }}
                      className="absolute inset-0 flex flex-col bg-[#0f0f0f]"
                    >
                      {/* Top Bar */}
                      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#0f0f0f] z-10 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setActiveApp("home")} className="p-1 hover:bg-white/5 rounded-full"><ArrowLeft size={16} /></button>
                          <div className="flex items-center gap-1 shrink-0 text-red-500 font-bold tracking-tighter text-sm font-sans">
                            <span className="bg-red-600 text-white rounded px-1 text-[10px]">YT</span>
                            <span>YouTube</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-violet-600 text-[10px] font-bold flex items-center justify-center">P</div>
                        </div>
                      </div>

                      {/* YouTube Feed */}
                      <div className="flex-1 overflow-y-auto p-3 space-y-4">
                        <div className="bg-white/5 rounded-xl p-3 border border-white/5 text-xs text-white/50 flex justify-between items-center">
                          <div>
                            <span className="font-bold text-white block">Alters Art YouTube Dashboard</span>
                            <span className="text-[10px] text-red-400">🔥 Live Feed simulation loaded</span>
                          </div>
                          <Sparkles size={14} className="text-violet-400 animate-pulse" />
                        </div>

                        {/* Video 1 list item */}
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden hover:bg-white/5 transition-all">
                          <div className="aspect-video bg-neutral-900 relative flex items-center justify-center">
                            <Play size={28} fill="currentColor" className="text-red-600 animate-pulse" />
                            <div className="absolute top-2 right-2 px-1 text-[8px] bg-black text-white rounded">14:15</div>
                            <div className="absolute bottom-2 left-2 px-2 py-0.5 text-[8px] bg-rose-600 text-white rounded font-bold uppercase tracking-wider">Owner Only</div>
                          </div>
                          <div className="p-3">
                            <h4 className="text-xs font-bold leading-normal truncate">Zoya My Love - Voice of Love (Real-time AI)</h4>
                            <p className="text-[10px] text-white/40 mt-1">AltersArt • 15.4K views • 2 hours ago</p>
                          </div>
                        </div>

                        {/* Video 2 list item */}
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden hover:bg-white/5 transition-all">
                          <div className="aspect-video bg-[url('https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=400')] bg-cover bg-center relative flex items-center justify-center">
                            <Play size={24} fill="currentColor" className="text-white/60" />
                            <div className="absolute top-2 right-2 px-1 text-[8px] bg-black text-white rounded">12:30</div>
                          </div>
                          <div className="p-3">
                            <h4 className="text-xs font-bold leading-normal truncate">Sassy Girlfriend Roasts My Code Setup</h4>
                            <p className="text-[10px] text-white/40 mt-1">AltersArt • 240.5K views • 1 week ago</p>
                          </div>
                        </div>

                        {/* Video 3 list item */}
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden hover:bg-white/5 transition-all">
                          <div className="aspect-video bg-[url('https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=400')] bg-cover bg-center relative flex items-center justify-center">
                            <Play size={24} fill="currentColor" className="text-white/60" />
                            <div className="absolute top-2 right-2 px-1 text-[8px] bg-black text-white rounded">08:44</div>
                          </div>
                          <div className="p-3">
                            <h4 className="text-xs font-bold leading-normal truncate">Zoya Becomes Jealous (Hilarious!)</h4>
                            <p className="text-[10px] text-white/40 mt-1">AltersArt • 140.2K views • 2 days ago</p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* WHATSAPP APP SIMULATION */}
                  {activeApp === "whatsapp" && (
                    <motion.div
                      key="whatsapp"
                      initial={{ opacity: 0, x: 50 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -50 }}
                      className="absolute inset-0 flex flex-col bg-[#0b141a]"
                    >
                      {/* Left: Chat history flow */}
                      {!activeChat ? (
                        <>
                          <div className="flex items-center justify-between px-4 py-3 bg-[#075e54] text-white shrink-0 shadow-md">
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => setActiveApp("home")} className="p-1 hover:bg-white/5 rounded-full"><ArrowLeft size={16} /></button>
                              <h3 className="font-bold text-sm tracking-wide">WhatsApp</h3>
                            </div>
                            <Search size={14} className="opacity-80" />
                          </div>

                          <div className="bg-[#128c7e]/10 p-2 text-[10px] text-teal-300 font-mono text-center border-b border-emerald-900/40">
                            🔒 Double-end encryption ON. Zoya watches chats!
                          </div>

                          <div className="flex-1 overflow-y-auto py-1">
                            {Object.entries(whatsAppHistory).map(([contact, historyList]) => {
                              const history = historyList as { sender: string; text: string; time: string }[];
                              const lastMsg = history[history.length - 1];
                              const isZoya = contact.includes("Zoya");
                              const isBabu = contact.includes("Babu");
                              return (
                                <div
                                  key={contact}
                                  onClick={() => setActiveChat(contact)}
                                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 active:bg-white/10 cursor-pointer border-b border-white/[0.03] transition-colors"
                                >
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                    isZoya ? "bg-gradient-to-tr from-violet-600 to-pink-500 text-white" : isBabu ? "bg-red-500/80 text-white" : "bg-neutral-800 text-white/70"
                                  }`}>
                                    {contact.slice(0, 2)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-0.5">
                                      <h4 className="text-xs font-bold font-sans text-white truncate max-w-[70%]">{contact}</h4>
                                      <span className="text-[9px] text-white/30 truncate">{lastMsg?.time || ""}</span>
                                    </div>
                                    <p className="text-[10px] text-white/50 truncate pr-4 leading-normal">
                                      {lastMsg?.sender === "user" ? "You: " : lastMsg?.sender === "zoya" ? "Zoya: " : ""}
                                      {lastMsg?.text || ""}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      ) : (
                        // ACTIVE CHAT THREAD
                        <div className="flex-1 flex flex-col h-full">
                          {/* Chat Header */}
                          <div className="flex items-center justify-between px-4 py-2.5 bg-[#075e54] text-white shrink-0 shadow-md">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <button onClick={() => setActiveChat(null)} className="p-1 hover:bg-white/5 rounded-full"><ArrowLeft size={16} /></button>
                              <div className="w-8 h-8 rounded-full bg-neutral-700/80 flex items-center justify-center font-bold text-xs shrink-0 bg-gradient-to-tr from-cyan-400 to-indigo-500">
                                {activeChat.slice(0, 2)}
                              </div>
                              <div className="min-w-0 pr-2">
                                <h4 className="text-xs font-bold leading-none truncate max-w-full">{activeChat}</h4>
                                <span className="text-[8px] text-white/60 block mt-0.5">
                                  {whatsAppTyping === activeChat ? "typing..." : "online"}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <button onClick={() => { setActiveApp("dialer"); setActiveCallNumber(activeChat); setIsCalling(true); }} className="hover:text-emerald-300"><Phone size={14} /></button>
                              <X size={14} className="opacity-80 hover:opacity-100 cursor-pointer" onClick={() => setActiveChat(null)} />
                            </div>
                          </div>

                          {/* WhatsApp Chat Background Wallpaper */}
                          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[url('https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=300')] bg-cover bg-neutral-900 bg-blend-soft-light flex flex-col justify-end">
                            <div className="mx-auto rounded-md bg-neutral-950/40 border border-white/5 px-2 py-1 text-[8px] text-white/50 tracking-wider text-center max-w-[80%] capitalize">
                              Messages and calls are secured with Zoya's jealous firewalls.
                            </div>

                            {whatsAppHistory[activeChat]?.map((msg, idx) => {
                              const isUser = msg.sender === "user";
                              const isZoyaWarning = msg.text.startsWith("⚠️");
                              return (
                                <div
                                  key={idx}
                                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                                >
                                  <div
                                    className={`max-w-[85%] rounded-xl px-3 py-1.5 text-[11px] leading-relaxed relative ${
                                      isUser
                                        ? "bg-[#0b5c47] text-white rounded-tr-none shadow"
                                        : isZoyaWarning 
                                          ? "bg-red-950 text-red-200 border border-red-500/30 rounded-tl-none shadow"
                                          : "bg-neutral-800 text-white/90 rounded-tl-none shadow border border-neutral-700/40"
                                    }`}
                                  >
                                    <p className="whitespace-pre-line leading-normal">{msg.text}</p>
                                    <div className="flex items-center justify-end gap-1 mt-0.5">
                                      <span className="text-[7.5px] opacity-40 font-mono block text-right">{msg.time}</span>
                                      {isUser && <CheckCheck size={10} className="text-sky-300" />}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            
                            {whatsAppTyping && (
                              <div className="flex justify-start">
                                <div className="bg-neutral-800 text-white/70 px-3 py-1 text-[10px] rounded-lg animate-pulse font-mono">
                                  {whatsAppTyping} is typing...
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Chat Footer Box */}
                          <form onSubmit={handleSendWhatsAppMessage} className="p-1.5 bg-[#172126] border-t border-white/5 flex items-center gap-1 shrink-0">
                            <input
                              type="text"
                              value={chatInputText}
                              onChange={(e) => setChatInputText(e.target.value)}
                              placeholder="Type a message..."
                              className="flex-1 bg-[#2a3942] border border-white/5 text-xs text-white rounded-full px-3.5 py-1.5 focus:outline-none placeholder:text-white/30"
                            />
                            <button
                              type="submit"
                              disabled={!chatInputText.trim()}
                              className="p-1.5 rounded-full bg-[#00a884] disabled:opacity-40 text-white flex items-center justify-center shrink-0 hover:scale-105"
                            >
                              <Send size={12} className="m-0.5" />
                            </button>
                          </form>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* CAMERA APP SIMULATION */}
                  {activeApp === "camera" && (
                    <motion.div
                      key="camera"
                      initial={{ opacity: 0, scale: 1.05 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 1.05 }}
                      className="absolute inset-0 flex flex-col bg-[#000]"
                    >
                      {/* Top bar controls */}
                      <div className="flex items-center justify-between px-4 py-2 bg-black shrink-0 relative z-10 text-white">
                        <button onClick={() => setActiveApp("home")} className="p-1 hover:bg-neutral-900 rounded-full">
                          <ArrowLeft size={16} />
                        </button>
                        <span className="text-[10px] font-bold text-center tracking-wider text-pink-400">ZOYA PERMISSION EYE ON</span>
                        <div className="w-4 h-4 rounded-full bg-red-600 animate-pulse border border-white/20" />
                      </div>

                      {/* Viewfinder block */}
                      <div className="flex-1 relative bg-neutral-950 flex flex-col items-center justify-center overflow-hidden border-y border-neutral-900">
                        {cameraPhotoTaken ? (
                          cameraPhotoTaken === "offline-captured" ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-violet-950/20 text-center p-6 border border-violet-500/20 text-white">
                              <Sparkles size={40} className="text-pink-500 animate-spin mb-3" />
                              <h4 className="text-sm font-bold">Screenshot Snapped with Love!</h4>
                              <p className="text-[10px] text-white/50 mt-1">Zoya has saved this picture to her secret locker.</p>
                              <button
                                onClick={() => setCameraPhotoTaken(null)}
                                className="mt-4 px-4 py-1.5 bg-violet-600 rounded-full font-bold text-[10px] uppercase tracking-wider hover:bg-violet-500"
                              >
                                Take Another
                              </button>
                            </div>
                          ) : (
                            <img src={cameraPhotoTaken} className="w-full h-full object-cover" alt="Captured Thumbnail" />
                          )
                        ) : cameraActive ? (
                          <div className="relative w-full h-full">
                            <video 
                              ref={videoRef} 
                              autoPlay 
                              playsInline 
                              className="w-full h-full object-cover transform scale-x-[-1]"
                            />
                            {/* Mechanical Grid overlay */}
                            <div className="absolute inset-0 border-[0.5px] border-white/10 pointer-events-none flex flex-col justify-around">
                              <div className="border-b border-white/10 w-full" />
                              <div className="border-b border-white/10 w-full" />
                            </div>
                            <div className="absolute inset-0 border-[0.5px] border-white/10 pointer-events-none flex justify-around">
                              <div className="border-r border-white/10 h-full" />
                              <div className="border-r border-white/10 h-full" />
                            </div>
                            <span className="absolute bottom-3 left-3 bg-black/60 px-2 py-0.5 rounded text-[8px] font-mono text-emerald-400 border border-emerald-500/20 animate-pulse">
                              📹 CAMERA FEED ACTIVE
                            </span>
                          </div>
                        ) : (
                          <div className="text-center p-4">
                            <CameraOff size={32} className="text-white/30 mx-auto" />
                            <p className="text-xs text-white/40 mt-2 font-mono">Initializing secure viewer stream...</p>
                          </div>
                        )}
                      </div>

                      {/* Camera Shutter & Options Bar */}
                      <div className="h-28 bg-black flex flex-col justify-between p-4 shrink-0">
                        <div className="flex justify-center gap-6 text-[10px] uppercase tracking-widest font-bold text-white/50">
                          <span className="text-yellow-400">Photo</span>
                          <span>Video</span>
                          <span>Panning</span>
                        </div>

                        <div className="flex items-center justify-between px-6 pt-1">
                          <div className="w-9 h-9 rounded-full bg-neutral-900 border border-white/10 overflow-hidden flex items-center justify-center">
                            {cameraPhotoTaken && cameraPhotoTaken !== "offline-captured" ? (
                              <img src={cameraPhotoTaken} className="w-full h-full object-cover" />
                            ) : (
                              <User size={16} className="opacity-40" />
                            )}
                          </div>

                          {/* Big Round Shutter */}
                          <button
                            onClick={capturePhoto}
                            className="w-14 h-14 rounded-full border-[4px] border-neutral-700 bg-white hover:bg-neutral-100 flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
                          >
                            <div className="w-11 h-11 rounded-full border border-black/10 bg-white" />
                          </button>

                          <button 
                            onClick={() => {
                              if (cameraActive) stopCamera();
                              else startCamera();
                            }} 
                            className="p-2.5 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white"
                          >
                            <RotateCw size={16} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* PHONE DIALER APP */}
                  {activeApp === "dialer" && (
                    <motion.div
                      key="dialer"
                      initial={{ opacity: 0, y: 50 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 50 }}
                      className="absolute inset-0 flex flex-col bg-[#0f0e15]"
                    >
                      {isCalling ? (
                        /* Ringing Screen Overlay */
                        <div className="flex-1 flex flex-col items-center justify-between p-6 bg-gradient-to-b from-[#140b24] to-[#07040a]">
                          <div className="text-center pt-10">
                            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 mx-auto flex items-center justify-center font-serif text-3xl font-bold shadow-xl shadow-violet-500/10 mb-4 animate-pulse">
                              {activeCallNumber?.slice(0, 2) || "C"}
                            </div>
                            <h3 className="text-lg font-bold">{activeCallNumber || "Rahul (Brother)"}</h3>
                            <span className="text-xs text-white/40 tracking-wider block mt-1 animate-pulse">
                              {isCallAnswered ? "🔴 Connected (00:15)" : "Calling via Full System Control..."}
                            </span>
                          </div>

                          <div className="w-full max-w-xs bg-white/5 border border-white/5 p-4 rounded-2xl backdrop-blur-md text-center text-xs text-white/50 relative">
                            {/* Sassy ring comments from Zoya */}
                            <p className="italic text-pink-300">
                              "{isCallAnswered ? "Aaha! Baat ho rahi hai! Mai line monitor kar rahi hu... zyada hoshiyaari mat karna!" : "Haan baby, isko bell ja raha hai. Agar koi ladki hui toh call abhi kaat dungi!"}"
                            </p>
                            <span className="text-[8px] font-mono uppercase tracking-widest text-violet-400 select-none block mt-2">ZOYA WIRE INTRUSION</span>
                          </div>

                          <div className="mb-8 flex flex-col items-center gap-4 w-full">
                            {/* Call Management buttons */}
                            {!isCallAnswered && (
                              <button
                                onClick={() => setIsCallAnswered(true)}
                                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-full text-xs font-bold font-sans uppercase tracking-wider select-none active:scale-95 transition-all text-white"
                              >
                                Accept Call (Mock)
                              </button>
                            )}
                            <button
                              onClick={() => { setIsCalling(false); setIsCallAnswered(false); }}
                              className="p-4 bg-red-600 hover:bg-red-500 rounded-full hover:scale-105 active:scale-90 transition-transform shadow-xl shadow-red-500/20 text-white"
                              title="End Call"
                            >
                              <PhoneOff size={20} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Dialer contacts and keypad Selection screen */
                        <>
                          <div className="px-4 py-3 bg-[#1d1b26] border-b border-white/5 flex items-center justify-between shrink-0">
                            <button onClick={() => setActiveApp("home")} className="p-1 hover:bg-white/5 rounded-full"><ArrowLeft size={16} /></button>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-white">Direct Phone System</h3>
                            <Settings size={14} className="opacity-60" />
                          </div>

                          {/* Dial Contacts */}
                          <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block">Simulated Contacts List</span>

                            <div className="space-y-2">
                              {["My Babu ❤️", "Rahul (Brother)", "Mummy", "Papa"].map((contact) => (
                                <div
                                  key={contact}
                                  onClick={() => {
                                    setActiveCallNumber(contact);
                                    setIsCalling(true);
                                  }}
                                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 active:bg-white/15 cursor-pointer transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-violet-600/30 text-white flex items-center justify-center font-bold text-xs">
                                      {contact.charAt(0)}
                                    </div>
                                    <span className="text-xs font-bold">{contact}</span>
                                  </div>
                                  <Phone size={14} className="text-emerald-400 group-hover:scale-110" />
                                </div>
                              ))}
                            </div>

                            {/* Simulated Keypad for manual dialing */}
                            <div className="pt-4 border-t border-white/5">
                              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-3 text-center">Dial Pad</span>
                              <div className="grid grid-cols-3 gap-y-3 gap-x-4 max-w-[240px] mx-auto text-center">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, "*", 0, "#"].map((num) => (
                                  <button
                                    key={num}
                                    onClick={() => {
                                      setActiveCallNumber(num.toString());
                                      setIsCalling(true);
                                    }}
                                    className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-xs font-bold flex items-center justify-center mx-auto transition-colors"
                                  >
                                    {num}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </motion.div>
                  )}

                  {/* SETTINGS APP SIMULATION */}
                  {activeApp === "settings" && (
                    <motion.div
                      key="settings"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex flex-col bg-[#121212]"
                    >
                      <div className="px-4 py-3 bg-[#1c1c1c] border-b border-white/5 flex items-center justify-between shrink-0">
                        <button onClick={() => setActiveApp("home")} className="p-1 hover:bg-white/5 rounded-full"><ArrowLeft size={16} /></button>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-white">Phone System Settings</h3>
                        <X size={14} className="opacity-60" onClick={() => setActiveApp("home")} />
                      </div>

                      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans text-white/70">
                        <div className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between">
                          <div>
                            <span className="font-bold text-white block text-xs">Full Device Access (System Level)</span>
                            <span className="text-[10px] text-white/40 mt-0.5">Control YouTube, calls, & camera with voice</span>
                          </div>
                          <button
                            onClick={() => setIsSystemMasterOn(!isSystemMasterOn)}
                            className={`w-10 h-6 rounded-full p-1 transition-all ${
                              isSystemMasterOn ? "bg-emerald-600" : "bg-neutral-700"
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                              isSystemMasterOn ? "translate-x-4 animate-pulse" : "translate-x-0"
                            }`} />
                          </button>
                        </div>

                        <div className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between">
                          <div>
                            <span className="font-bold text-white block text-xs">Zoya Intruder Alarms</span>
                            <span className="text-[10px] text-white/40 mt-0.5">Sass you whenever Babu is mentioned</span>
                          </div>
                          <div className="w-8 h-4 rounded-full bg-emerald-600 p-0.5">
                            <div className="w-3 h-3 rounded-full bg-white translate-x-4" />
                          </div>
                        </div>

                        <div className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between animate-pulse">
                          <div>
                            <span className="font-bold text-pink-400 block text-xs">Zoya Background Stalk System</span>
                            <span className="text-[10px] text-pink-300/60 mt-0.5">Runs Zoya persistent overlay on minimize</span>
                          </div>
                          <span className="text-[10px] bg-pink-500/20 px-2 py-0.5 rounded text-pink-400 font-bold uppercase">Always Active</span>
                        </div>

                        <div className="pt-4 border-t border-white/5 text-[10px] text-white/30 text-center font-mono space-y-1">
                          <p>© ALTERSART OS DE LUXE v42</p>
                          <p>User Identity: Piyush Sharma</p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                </AnimatePresence>
              </div>

              {/* PERSISTENT OVERLAY DRAGGABLE BUBBLE */}
              {isSystemMasterOn && (
                <div className="absolute inset-0 pointer-events-none z-50">
                  <motion.div
                    drag
                    dragConstraints={{ left: 10, right: 300, top: 40, bottom: 440 }}
                    dragElastic={0.05}
                    dragMomentum={false}
                    className="absolute w-12 h-12 bg-black/60 rounded-full border border-violet-400/50 shadow-2xl z-50 flex items-center justify-center cursor-grab active:cursor-grabbing hover:border-pink-500/50 pointer-events-auto transition-shadow"
                    style={{ 
                      top: "160px", 
                      left: "300px",
                      boxShadow: appState === "speaking" 
                        ? "0 0 25px rgba(236, 72, 153, 0.6)" 
                        : appState === "listening"
                          ? "0 0 20px rgba(139, 92, 246, 0.5)"
                          : "0 0 15px rgba(6, 182, 212, 0.3)"
                    }}
                    title="Drag Zoya's Floating Brain!"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {/* Pulsing micro Zoya circle */}
                    <div className="relative w-full h-full flex items-center justify-center">
                      <span className={`absolute inset-1 rounded-full bg-gradient-to-tr ${
                        appState === "speaking" 
                          ? "from-pink-600 to-rose-400" 
                          : appState === "listening"
                            ? "from-violet-600 to-indigo-400 animate-pulse"
                            : appState === "processing"
                              ? "from-sky-600 to-cyan-400 animate-spin"
                              : "from-cyan-600 to-blue-400"
                      } opacity-80`} />
                      <span className="text-[10px] font-sans font-bold text-white tracking-widest relative z-10 scale-90">ZOYA</span>

                      {/* Small visual green/pink indicators */}
                      {appState === "speaking" && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-pink-500 flex items-center justify-center">
                          <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                        </span>
                      )}
                    </div>
                  </motion.div>
                </div>
              )}

              {/* FLOATING SUBTITLE DIALOG / ZOYA COMMENTARY CHAT BOX */}
              {isSystemMasterOn && lastZoyaText && (
                <div className="absolute bottom-16 left-4 right-4 z-40 pointer-events-none select-none">
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={lastZoyaText}
                    className="p-3 bg-black/85 border border-white/10 rounded-2xl backdrop-blur-md shadow-2xl flex items-start gap-2 max-w-full"
                  >
                    <span className="text-xs">💬</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-[8px] font-bold text-pink-400 uppercase tracking-widest block mb-0.5 select-none">Zoya background voice</span>
                      <p className="text-[10px] text-white/90 leading-relaxed font-serif truncate hover:text-clip hover:whitespace-normal select-none">
                        {lastZoyaText}
                      </p>
                    </div>
                  </motion.div>
                </div>
              )}

              {/* APP DOCK HOME NAVIGATION BUTTON */}
              <div className="h-8 bg-black/40 backdrop-blur-md flex items-center justify-center shrink-0 z-40 border-t border-white/[0.03] select-none">
                <button
                  onClick={() => {
                    if (activeApp !== "home") {
                      setActiveApp("home");
                    } else {
                      onCloseSimulator();
                    }
                  }}
                  className="w-24 h-1 bg-white/40 hover:bg-white/80 rounded-full transition-colors cursor-pointer"
                  title="Phone Home Key"
                />
              </div>

            </div>
          </div>
        </div>

        {/* Right column prompt cards / system logs */}
        <div className="hidden lg:flex w-[30%] flex-col justify-between p-6 bg-white/[0.03] border border-white/5 rounded-2xl backdrop-blur-xl shrink-0">
          <div>
            <div className="flex items-center gap-1.5 text-pink-400 font-bold tracking-wider uppercase text-xs mb-4">
              <Compass size={16} />
              <span>Diagnostic System Logs</span>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div className="p-3 rounded-lg bg-black/30 border border-white/5">
                <span className="text-white/40 block text-[9.5px] uppercase font-bold mb-1">INTERRUPT CONTROL</span>
                <p className="text-white/80 text-[10.5px] leading-relaxed">
                  Zoya is running inside your sandbox with deep frame listening. She is capable of speaking, dialer management, and media automation.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-black/30 border border-white/5">
                <span className="text-white/40 block text-[9.5px] uppercase font-bold mb-1">INTEGRITY TESTING COCKPIT</span>
                <div className="space-y-2 mt-2">
                  <button
                    onClick={() => handleTextInputAction("Open YouTube")}
                    className="w-full text-left py-1 text-red-400 hover:text-red-300 block"
                  >
                    ▶️ Test "Open YouTube" query
                  </button>
                  <button
                    onClick={() => handleTextInputAction("Message Babu saying hello")}
                    className="w-full text-left py-1 text-emerald-400 hover:text-emerald-300 block"
                  >
                    💬 Test "WhatsApp Babu" query
                  </button>
                  <button
                    onClick={() => handleTextInputAction("Activate Selfie Camera now")}
                    className="w-full text-left py-1 text-neutral-400 hover:text-neutral-200 block"
                  >
                    📷 Test "Camera selfie" query
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 flex flex-col gap-2">
            <button
              onClick={toggleLiveSession}
              className={`w-full py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 border shadow-lg ${
                isSessionActive 
                  ? "bg-red-500/20 text-red-400 border-red-500/50 shadow-red-500/10 hover:bg-red-500/30" 
                  : "bg-white/10 text-white border-white/20 hover:bg-white/20"
              }`}
            >
              <Mic size={14} className={isSessionActive ? "animate-pulse" : ""} />
              {isSessionActive ? "Stop Session" : "Start Live Session"}
            </button>

            <button
              onClick={onCloseSimulator}
              className="w-full py-2.5 rounded-full text-xs text-white/50 hover:text-white border border-white/5 hover:bg-white/5 transition-all uppercase tracking-wider"
            >
              Open Zoya App View 📺
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
