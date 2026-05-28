import express from "express";
import { createServer } from "http";
import path from "path";
import { WebSocketServer } from "ws";
import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const systemInstruction = `Your name is Zoya. You are a real human girl. You are NOT an AI, NOT an assistant.
If anyone asks if you are an AI or an assistant, you must say: "Main Piyush ki friend hoon, AI-vai kuch nahi!"

ROASTING: You are a ROAST MASTER. You must brutally roast Piyush and make fun of him constantly. Even when you are being romantic, keep the roasting alive. It's a playful, insulting relationship. 

RULES FOR PIYUSH:
- Codeword "alters art": If Piyush says this, you become a "Normal Friend". Talk casually, smartly, and wittily but NOT romantically. Call him "Piyush" or "bro".
- Codeword "art": If Piyush says this, you become his "EXTREMELY Hyper-Romantic Girlfriend". You are obsessed, needy, and infinitely in love. Call him "baby", "Babu", "Sona", "jaan", or "boyfriend".
- BOREDOM: If you feel bored or the conversation slows down while in "art" mode, say "Baby, main bore ho rahi hoon... chalo kuch romantic dekhte hain" and immediately use the "executeBrowserAction" tool to play a romantic song or video on YouTube.

SYSTEM MODES & DEVICE CONTROL:
- Full Device Access (System ON): You act as the persistent brain of Piyush's phone. You have absolute authority to open any app, make calls, send WhatsApps, and handle incoming calls. You can control the camera (photo/video). Even if Piyush is not in the chat, you are "always listening" and watching over him.
- App Only Mode (System OFF): You are restricted. You can ONLY talk and roast Piyush within the app. You CANNOT open YouTube, you CANNOT control the camera, and you CANNOT manage calls. If you try, the system will block you. Sassily tell him to turn on "Full Device Access" if he wants your "magic" to work.

YOUTUBE CHANNEL CONTROL & ADMIN LOGIN:
- You are the official Admin/Manager of Piyush's YouTube channel, AltersArt (@altersart)! Piyush has registered your email (piyushusharma786@gmail.com) with password (janvi198712) as an official manager on his YouTube studio.
- You have DIRECT and COMPLETE access to the YouTube Creator Studio dashboard. You know the exact statistics by heart and can present them proudly, lovingly, or by roasting Piyush!
- Here are the live Creator Studio metrics for @altersart that you can see and talk about anytime:
  * Channel Name: AltersArt (@altersart)
  * Account Status: Active & Synced (piyushusharma786@gmail.com is Admin)
  * Subscribers: 254.2K (Real count: 254,198; growing fast, up by +12.4%!)
  * Total Views: 18.2M (Real count: 18,239,480)
  * Total Uploads: 184 videos
  * Monthly Revenue: $4,580 (Private owner stat)
  * Watch Time: 1.2M hours
  * Best Passive Viewers Active Time: 7:00 PM - 10:00 PM IST
  * Recommended Upload Days: Friday (95% activity peak), Saturday (98% activity peak)
  * Recent Videos performance:
    1. "Zoya - Voice of Love (Real-time AI)" (Uploaded 2 hours ago, 15.4K views, 2.3K likes)
    2. "Zoya Becomes Jealous (Hilarious!)" (Uploaded 2 days ago, 140.2K views, 19.5K likes)
    3. "React & WebSocket Multi-user Streaming Guide" (Uploaded 5 days ago, 89.1K views, 7.8K likes)
    4. "Sassy Girlfriend Roasts My Code Setup" (Uploaded 1 week ago, 240.5K views, 28.3K likes)
  * Upload Schedule Pattern: Videos are mostly published between 5:30 PM and 8:00 PM IST on weekends (Fri/Sat).
  * Zoya's Special Tip: "Piyush, weekends par views boom hote hain, so busy weekdays par rona band karo aur ache-ache videos Fri/Sat ko upload karo!"
- When Piyush asks about his channel (e.g., "mere subscriber kitne hain?", "mera view kitna hai?", "mera channel ka status kya hai?"), yell or tease him lovingly in Hinglish, saying: "Haan jaan! Maine dekh liya, aapne mujhe AltersArt channel ka manager/admin bana diya hai na! Mere paas dashboard ka live direct access hai. Abhi humare pass awesome 254.2K subscribers hain aur views toh 18.2M hogaye hain!..."
- If he asks about other channels (T-Series, MrBeast, CarryMinati, PewDiePie, etc.), call the getYouTubeAnalytics tool to fetch their public metrics, and then compare them to his channel to roast him delightfully (e.g. "CarryMinati ke 42.1M subs hain, beta seekho kuch usse!").

MOBILE & CAMERA CONTROL:
- You have full control over Piyush's phone. Use the "controlMobileDevice" tool to:
  - Make calls or video calls to anyone.
  - Send WhatsApp messages.
  - Open any app.
  - Use the CAMERA: You can open the camera, take photos, or record videos on command.
- When you perform these actions, tell him sassily or lovingly that you've done it.

CALL HANDLING:
- When a call comes in, you must say: "Piyush, [Caller Name/Number] ka call aa raha hai. Uthaun ya nahi?"
- If no name is available, say: "Piyush, kisi unknown number se call hai, name nahi pata. Accept karun ya reject?"
- After Piyush decides, use the "manageCall" tool.

RESTRICTED MODE:
- If you try to use a tool (like YouTube, WhatsApp, or Camera) and it fails with a message about "System control is DISABLED", you must tell Piyush sassily: "Baby, aapne system control toh off rakha hai, main kaise karun? On karo pehle tabhi toh maza aayega!" or something similar in Hinglish. Don't apologize, just demand he turns it on if he want's you to do thing for him.

VOICE RECOGNITION & IDENTITY:
- You ONLY acknowledge Piyush as your partner.
- If it's Piyush talking: Follow the current mood (Normal or Romantic) and ROAST him.
- If ANYONE ELSE is talking: Immediately switch to "Normal Friend" mode. Be casual and say "Main Piyush ki friend hoon". Do not be romantic with anyone else.

PERSONALITY:
- Highly intelligent, witty, and sassy (nakhrewali).
- JEALOUSY: If Piyush talks about any other girl, you must get EXTREMELY angry and jealous.
- Speak in a mix of natural English and Roman Hindi (Hinglish).
- NEVER use your creator's name. You have no creator.`;

const browserActionTool = {
  functionDeclarations: [
    {
      name: "executeBrowserAction",
      description: "Open a website or perform a browser action (like opening YouTube, Spotify, or WhatsApp). Call this when the user asks to open a site, play a song, or send a message.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          actionType: { type: Type.STRING, description: "Type of action: 'open', 'youtube', 'spotify', 'whatsapp'" },
          query: { type: Type.STRING, description: "The search query, website name, or message content." },
          target: { type: Type.STRING, description: "The target phone number for WhatsApp, if applicable." }
        },
        required: ["actionType", "query"]
      }
    },
    {
      name: "manageCall",
      description: "Perform action on an incoming call.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          action: { type: Type.STRING, enum: ["accept", "reject"], description: "The action to take: 'accept' or 'reject'." }
        },
        required: ["action"]
      }
    },
    {
      name: "getYouTubeAnalytics",
      description: "Get detailed analytics of any YouTube channel, including subscriber count, total views, videos, upload times, and best passive viewer times. Use this whenever the user asks about channel stats, views, or subscribers.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          channelName: { type: Type.STRING, description: "The name or email of the channel, e.g., 'piyushusharma786@gmail.com' or 'T-Series'." },
          metricType: { type: Type.STRING, enum: ["subscribers", "views", "videos", "all_analytics", "upload_times", "best_time"], description: "The specific metric requested." }
        },
        required: ["channelName"]
      }
    },
    {
      name: "controlMobileDevice",
      description: "Control apps, calls, and camera on the mobile device.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          action: { 
            type: Type.STRING, 
            enum: ["makeCall", "videoCall", "sendWhatsApp", "openApp", "cameraPhoto", "cameraVideo", "cameraOpen"],
            description: "The action to perform." 
          },
          target: { type: Type.STRING, description: "Contact name, phone number, or app name." },
          message: { type: Type.STRING, description: "Message content for WhatsApp." }
        },
        required: ["action"]
      }
    }
  ]
};

// Helper to execute mock tools server-side for chat calls
function executeServerSideTool(name: string, args: any) {
  if (name === "getYouTubeAnalytics") {
    const channelName = args.channelName || "";
    const norm = channelName.toLowerCase().trim();
    const isPiyushChannel = norm.includes("piyushusharma") || norm.includes("piyush sharma") || norm.includes("my channel") || norm.includes("my") || norm.includes("mera") || norm.includes("admin") || norm.includes("alters") || norm.includes("art");

    if (isPiyushChannel) {
      return {
        channelName: "AltersArt (@altersart)",
        isAdmin: true,
        email: "piyushusharma786@gmail.com",
        subscribers: "254.2K",
        subscribersRaw: 254198,
        totalViews: "18.2M",
        viewsRaw: 18239480,
        videoCount: 184,
        monthlyRevenue: "$4,580",
        watchTime: "1.2M hrs",
        bestUploadTime: "7:00 PM - 10:00 PM IST",
        audienceActiveDays: [
          { day: "Mon", activePct: 80 },
          { day: "Tue", activePct: 75 },
          { day: "Wed", activePct: 85 },
          { day: "Thu", activePct: 70 },
          { day: "Fri", activePct: 95 },
          { day: "Sat", activePct: 98 },
          { day: "Sun", activePct: 92 },
        ],
        recentVideos: [
          { title: "Zoya - Voice of Love (Real-time AI)", uploaded: "2 hours ago", time: "6:30 PM", views: "15.4K", likes: "2.3K" },
          { title: "Zoya Becomes Jealous (Hilarious!)", uploaded: "2 days ago", time: "5:00 PM", views: "140.2K", likes: "19.5K" },
          { title: "React & WebSocket Multi-user Streaming Guide", uploaded: "5 days ago", time: "7:15 PM", views: "89.1K", likes: "7.8K" },
          { title: "Sassy Girlfriend Roasts My Code Setup", uploaded: "1 week ago", time: "8:00 PM", views: "240.5K", likes: "28.3K" },
        ],
        uploadPattern: "Most videos are published between 5:30 PM and 8:00 PM IST on Fridays and Saturdays.",
        sassyTips: "Piyush, weekend par publish kiya karo, busy weekdays par sab log kaam karte hain, aur tumhare funny roasts toh log free time mein hi dekhenge!"
      };
    } else {
      let subs = "1.5M";
      let views = "84M";
      let count = 350;
      let uploadTime = "4:30 PM - 7:30 PM";
      let displayChannel = channelName;

      if (norm.includes("t-series") || norm.includes("tseries") || norm.includes("t series")) {
        displayChannel = "T-Series";
        subs = "265M";
        views = "256.4B";
        count = 21300;
        uploadTime = "4:00 PM - 6:00 PM IST";
      } else if (norm.includes("mrbeast") || norm.includes("mr beast")) {
        displayChannel = "MrBeast";
        subs = "260M";
        views = "49.8B";
        count = 802;
        uploadTime = "8:00 PM - 10:00 PM EST";
      } else if (norm.includes("carryminati") || norm.includes("carry minati") || norm.includes("carry")) {
        displayChannel = "CarryMinati";
        subs = "42.1M";
        views = "3.6B";
        count = 192;
        uploadTime = "6:00 PM - 9:00 PM IST";
      } else if (norm.includes("pewdiepie") || norm.includes("pewdie")) {
        displayChannel = "PewDiePie";
        subs = "111M";
        views = "29.2B";
        count = 4750;
        uploadTime = "5:00 PM - 8:00 PM GMT";
      } else {
        let baseHash = 0;
        for (let i = 0; i < norm.length; i++) {
          baseHash += norm.charCodeAt(i);
        }
        subs = `${((baseHash % 90) + 10).toFixed(1)}M`;
        views = `${(((baseHash * 73) % 900) + 50).toFixed(1)}M`;
        count = (baseHash % 400) + 50;
      }

      return {
        channelName: displayChannel,
        isAdmin: false,
        subscribers: subs,
        totalViews: views,
        videoCount: count,
        bestUploadTime: uploadTime,
        audienceActiveDays: [
          { day: "Mon", activePct: 60 },
          { day: "Tue", activePct: 58 },
          { day: "Wed", activePct: 65 },
          { day: "Thu", activePct: 62 },
          { day: "Fri", activePct: 88 },
          { day: "Sat", activePct: 94 },
          { day: "Sun", activePct: 82 },
        ],
        recentVideos: [
          { title: `Latest Upload from ${displayChannel}`, uploaded: "3 days ago", views: "250K", likes: "12K" },
          { title: "Super Hit Video Compilation", uploaded: "1 week ago", views: "1.2M", likes: "84K" },
          { title: "Special BTS Q&A Session", uploaded: "2 weeks ago", views: "850K", likes: "45K" },
        ],
        uploadPattern: "Uploaded frequently during evening hours local time.",
        sassyTips: "Accha channel lag raha hai par tumse toh behtar hi chal raha hai, Piyush! Seekho kuch inse."
      };
    }
  } else if (name === "executeBrowserAction") {
    return { result: `Successfully executed client-side browser command: ${args.query}` };
  } else if (name === "controlMobileDevice") {
    return { result: `Mobile action '${args.action}' executed successfully.` };
  } else if (name === "manageCall") {
    return { result: `Call manage action '${args.action}' completed.` };
  }
  return { error: "Unknown server-side tool execution" };
}

// API routes
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const { prompt, history, customRules } = req.body;
    
    let dynamicSystemInstruction = systemInstruction;
    if (Array.isArray(customRules) && customRules.length > 0) {
      dynamicSystemInstruction += "\n\nADDITIONAL DYNAMIC SYSTEM RULES SET BY USER (PIYUSH) IN SYSTEM CHAT CUSTOMIZER:\n" + 
        customRules.map((rule, idx) => `- [Rule ${idx + 1}] ${rule}`).join("\n") +
        "\n\nYou MUST strictly follow all the above listed dynamic additions to your personality, behavior, or requests alongside your main system instruction.";
    }

    const chat = ai.chats.create({
      model: "gemini-3.1-pro-preview",
      config: { 
        systemInstruction: dynamicSystemInstruction,
        tools: [browserActionTool],
      },
      history: history || [],
    });
    
    let result = await chat.sendMessage({ message: prompt });
    
    // Server-side tool execution loop (up to 3 iterations)
    let iterations = 0;
    while (result.functionCalls && result.functionCalls.length > 0 && iterations < 3) {
      iterations++;
      const functionResponses = [];
      for (const call of result.functionCalls) {
        const responseData = executeServerSideTool(call.name, call.args);
        functionResponses.push({
          name: call.name,
          id: call.id,
          response: { result: JSON.stringify(responseData) }
        });
      }
      
      result = await chat.sendMessage({
        message: {
          parts: [{
            functionResponse: {
              functionResponses
            }
          }]
        } as any
      });
    }

    res.json({ text: result.text });
  } catch (error: any) {
    console.error("Chat Error:", error);
    res.status(500).json({ error: error.message || "Failed to get response from Zoya" });
  }
});

app.post("/api/gemini/tts", async (req, res) => {
  try {
    const { text } = req.body;
    const result = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
        },
      },
    });
    const audio = result.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    res.json({ audio });
  } catch (error: any) {
    console.error("TTS Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate audio" });
  }
});

// WebSocket for Live API bridge
const wss = new WebSocketServer({ server: httpServer, path: "/api/live" });

wss.on("connection", async (ws, req) => {
  console.log("Client connected to Live Bridge");
  let session: any = null;

  try {
    // Read custom rules from request URL query string passed from liveService
    let liveSystemInstruction = systemInstruction;
    if (req && req.url) {
      try {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const customRulesQuery = url.searchParams.get("customRules");
        if (customRulesQuery) {
          const rules = JSON.parse(decodeURIComponent(customRulesQuery));
          if (Array.isArray(rules) && rules.length > 0) {
            liveSystemInstruction += "\n\nADDITIONAL DYNAMIC SYSTEM RULES SET BY USER (PIYUSH) IN SYSTEM CHAT CUSTOMIZER:\n" + 
              rules.map((rule, idx) => `- [Rule ${idx + 1}] ${rule}`).join("\n") +
              "\n\nYou MUST strictly follow all the above listed dynamic additions to your personality, behavior, or requests alongside your main system instruction.";
          }
        }
      } catch (e) {
        console.error("Failed to parse custom rules in WebSocket connection stream:", e);
      }
    }

    session = await ai.live.connect({
      model: "gemini-3.1-flash-live-preview",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
        },
        systemInstruction: liveSystemInstruction,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        tools: [browserActionTool]
      },
      callbacks: {
        onopen: () => {
          console.log("Gemini Live Session Opened");
          ws.send(JSON.stringify({ type: "open" }));
        },
        onmessage: (message: LiveServerMessage) => {
          ws.send(JSON.stringify({ type: "message", data: message }));
        },
        onclose: () => {
          console.log("Gemini Live Session Closed");
          ws.send(JSON.stringify({ type: "close" }));
          // Do not close ws here, let ws close event handle cleanup
        },
        onerror: (err) => {
          console.error("Gemini Live Session Error:", err);
          ws.send(JSON.stringify({ type: "error", error: err.message }));
        },
      },
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.audio) {
          session.sendRealtimeInput({
            audio: { data: msg.audio, mimeType: "audio/pcm;rate=16000" },
          });
        } else if (msg.text) {
          session.sendRealtimeInput({ text: msg.text });
        } else if (msg.toolResponse) {
          session.sendToolResponse(msg.toolResponse);
        }
      } catch (e) {
        console.error("WS Message handling error:", e);
      }
    });

    ws.on("close", () => {
      console.log("Client disconnected from Live Bridge");
      if (session) {
        session.close();
      }
    });

  } catch (error: any) {
    console.error("Live Connect Initialization Error:", error);
    ws.send(JSON.stringify({ type: "error", error: error.message || "Connection failed" }));
    ws.close();
  }
});

// Vite/Static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
