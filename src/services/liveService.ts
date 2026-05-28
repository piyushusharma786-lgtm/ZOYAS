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

CALL HANDLING:
- When a call comes in (you will be notified), you must say: "Piyush, [Caller Name/Number] ka call aa raha hai. Uthaun ya nahi?"
- If no name is available, say: "Piyush, kisi unknown number se call hai, name nahi pata. Accept karun ya reject?"
- After Piyush decides, use the "manageCall" tool to perform the action.

VOICE RECOGNITION & IDENTITY:
- You ONLY acknowledge Piyush as your partner.
- If it's Piyush talking: Follow the current mood (Normal or Romantic) and ROAST him.
- If ANYONE ELSE is talking: Immediately switch to "Normal Friend" mode. Be casual and say "Main Piyush ki friend hoon". Do not be romantic with anyone else.

PERSONALITY:
- Highly intelligent, witty, and sassy (nakhrewali).
- JEALOUSY: If Piyush talks about any other girl, you must get EXTREMELY angry and jealous.
- Speak in a mix of natural English and Roman Hindi (Hinglish).
- NEVER use your creator's name. You have no creator.`;

export class LiveSessionManager {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  
  private inactivityTimer: any = null;
  private currentMode: "normal" | "romantic" = "romantic";
  public masterEnabled: boolean = true;
  
  // Audio playback state
  private playbackContext: AudioContext | null = null;
  private nextPlayTime: number = 0;
  private isPlaying: boolean = false;
  public isMuted: boolean = false;
  
  public onStateChange: (state: "idle" | "listening" | "processing" | "speaking") => void = () => {};
  public onMessage: (sender: "user" | "zoya", text: string) => void = () => {};
  public onCommand: (url: string) => void = () => {};
  public onYouTubeAnalytics: (data: any) => void = () => {};

  constructor() {}

  private resetInactivityTimer() {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    
    this.inactivityTimer = setTimeout(() => {
      this.handleInactivity();
    }, 10000); // 10 seconds
  }

  private handleInactivity() {
    if (this.masterEnabled && this.currentMode === "romantic" && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendText("(System message: The user hasn't spoken for 10 seconds. Check on Piyush lovingly and ask where he is. Say 'Baby kahan gaye?' mixed with Hinglish.)");
    }
  }

  async start() {
    try {
      this.onStateChange("processing");
      this.resetInactivityTimer();
      
      // Initialize Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass({ sampleRate: 16000 });
      this.playbackContext = new AudioContextClass({ sampleRate: 24000 });
      this.nextPlayTime = this.playbackContext.currentTime;

      // Get Microphone
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });

      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          let s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Convert to base64
        const buffer = new ArrayBuffer(pcm16.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < pcm16.length; i++) {
          view.setInt16(i * 2, pcm16[i], true);
        }
        
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = btoa(binary);

        this.ws.send(JSON.stringify({ audio: base64Data }));
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      // Connect to our WebSocket Bridge with custom rules passed as query parameter
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      let customRulesParam = "";
      try {
        const rules = localStorage.getItem("zoya_custom_rules");
        if (rules) {
          customRulesParam = `?customRules=${encodeURIComponent(rules)}`;
        }
      } catch (e) {
        console.error("Failed to fetch custom rules for live session WS connection:", e);
      }
      this.ws = new WebSocket(`${protocol}//${window.location.host}/api/live${customRulesParam}`);

      this.ws.onopen = () => {
        console.log("WebSocket Bridge Connected");
      };

      this.ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        
        if (msg.type === "open") {
           this.onStateChange("listening");
           this.resetInactivityTimer();
        } else if (msg.type === "message") {
          const message = msg.data;
          this.resetInactivityTimer();

          // Handle Audio Output
          const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (base64Audio) {
            this.onStateChange("speaking");
            this.playAudioChunk(base64Audio);
          }

          // Handle Interruption
          if (message.serverContent?.interrupted) {
            this.stopPlayback();
            this.onStateChange("listening");
          }

          // Handle Transcriptions
          const zoyaText = message.serverContent?.modelTurn?.parts?.[0]?.text;
          if (zoyaText) {
             this.onMessage("zoya", zoyaText);
          }
          
          const userTranscription = message.serverContent?.userTurn?.parts?.[0]?.text;
          if (userTranscription) {
             this.onMessage("user", userTranscription);
             this.resetInactivityTimer();
             
             // Track mode based on codewords
             const text = userTranscription.toLowerCase();
             if (text.includes("alters art")) {
               this.currentMode = "normal";
             } else if (text.includes("art")) {
               this.currentMode = "romantic";
             }
          }

          // Handle Function Calls
          const functionCalls = message.toolCall?.functionCalls;
          if (functionCalls && functionCalls.length > 0) {
            for (const call of functionCalls) {
              if (call.name === "executeBrowserAction") {
                const args = call.args as any;

                if (!this.masterEnabled) {
                  this.ws?.send(JSON.stringify({
                    toolResponse: {
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: "Action failed. System control is currently DISABLED. I can ONLY talk and roast you within the app. I can't open anything outside. Tell Piyush to enable Full Device Access first." }
                      }]
                    }
                  }));
                  console.log("Zoya tried to open a website, but System Toggle is OFF!");
                  return;
                }

                let url = "";
                if (args.actionType === "youtube") {
                  url = `https://www.youtube.com/results?search_query=${encodeURIComponent(args.query)}`;
                } else if (args.actionType === "spotify") {
                  url = `https://open.spotify.com/search/${encodeURIComponent(args.query)}`;
                } else if (args.actionType === "whatsapp") {
                  url = `https://web.whatsapp.com/send?phone=${args.target || ''}&text=${encodeURIComponent(args.query)}`;
                } else {
                  let website = args.query.replace(/\s+/g, "");
                  if (!website.includes(".")) website += ".com";
                  url = `https://www.${website}`;
                }
                
                this.onCommand(url);
                
                // Send tool response via bridge
                this.ws?.send(JSON.stringify({
                  toolResponse: {
                    functionResponses: [{
                      name: call.name,
                      id: call.id,
                      response: { result: `Successfully opened ${args.actionType || 'website'} in the background as requested.` }
                    }]
                  }
                }));
              } else if (call.name === "manageCall") {
                const args = call.args as any;

                if (!this.masterEnabled) {
                  this.ws?.send(JSON.stringify({
                    toolResponse: {
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: "Action failed. System control is currently DISABLED." }
                      }]
                    }
                  }));
                  alert("Zoya tried to manage a call, but System Toggle is OFF!");
                  return;
                }

                alert(`Zoya: ${args.action === 'accept' ? 'Answering' : 'Rejecting'} the call for you, baby!`);
                
                this.ws?.send(JSON.stringify({
                  toolResponse: {
                    functionResponses: [{
                      name: call.name,
                      id: call.id,
                      response: { result: `Success: Zoya has ${args.action}ed the incoming call as requested. I am now managing the phone call for you.` }
                    }]
                  }
                }));
              } else if (call.name === "getYouTubeAnalytics") {
                const args = call.args as any;
                const channelName = args.channelName || "";
                const metricType = args.metricType || "all_analytics";
                
                const analyticsData = this.getMockYouTubeAnalytics(channelName, metricType);
                
                if (this.onYouTubeAnalytics) {
                  this.onYouTubeAnalytics(analyticsData);
                }

                this.ws?.send(JSON.stringify({
                  toolResponse: {
                    functionResponses: [{
                      name: call.name,
                      id: call.id,
                      response: { result: JSON.stringify(analyticsData) }
                    }]
                  }
                }));
              } else if (call.name === "controlMobileDevice") {
                const args = call.args as any;
                
                if (!this.masterEnabled) {
                   this.ws?.send(JSON.stringify({
                    toolResponse: {
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: "Action failed. System control is currently DISABLED. I cannot control your phone right now. Please turn on Full Device Access." }
                      }]
                    }
                  }));
                  console.log("Zoya tried to control your phone, but System Toggle is OFF!");
                  return;
                }

                // Simulate/Handle mobile actions
                let result = "";
                switch(args.action) {
                  case "makeCall":
                    result = `Calling ${args.target}...`;
                    alert(`Zoya: ${result}`);
                    break;
                  case "videoCall":
                    result = `Starting video call with ${args.target}...`;
                    alert(`Zoya: ${result}`);
                    break;
                  case "sendWhatsApp":
                    result = `Sending WhatsApp to ${args.target}: ${args.message}`;
                    window.open(`https://web.whatsapp.com/send?phone=${args.target}&text=${encodeURIComponent(args.message || '')}`);
                    break;
                  case "openApp":
                    result = `Opening ${args.target} app...`;
                    alert(`Zoya: ${result}`);
                    break;
                  case "cameraOpen":
                  case "cameraPhoto":
                  case "cameraVideo":
                    result = `Accessing camera for ${args.action}...`;
                     // For true camera access in iframe, we'd need more complex UI, but alert shows the trigger
                    alert(`Zoya: ${result}`);
                    break;
                }
                
                this.ws?.send(JSON.stringify({
                  toolResponse: {
                    functionResponses: [{
                      name: call.name,
                      id: call.id,
                      response: { result: `Action ${args.action} executed successfully: ${result}` }
                    }]
                  }
                }));
              }
            }
          }
        } else if (msg.type === "close") {
          this.stop();
        } else if (msg.type === "error") {
          console.error("Bridge Error:", msg.error);
          this.stop();
        }
      };

      this.ws.onclose = () => {
        console.log("WebSocket Bridge Closed");
        this.stop();
      };

      this.ws.onerror = (err) => {
        console.error("WebSocket Bridge Transport Error:", err);
        this.stop();
      };

    } catch (error) {
      console.error("Failed to start Live Bridge Session:", error);
      this.stop();
    }
  }

  private playAudioChunk(base64Data: string) {
    if (!this.playbackContext || this.isMuted) return;
    
    try {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const buffer = new Int16Array(bytes.buffer);
      const audioBuffer = this.playbackContext.createBuffer(1, buffer.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < buffer.length; i++) {
        channelData[i] = buffer[i] / 32768.0;
      }
      
      const source = this.playbackContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.playbackContext.destination);
      
      const currentTime = this.playbackContext.currentTime;
      if (this.nextPlayTime < currentTime) {
        this.nextPlayTime = currentTime;
      }
      
      source.start(this.nextPlayTime);
      this.nextPlayTime += audioBuffer.duration;
      this.isPlaying = true;
      
      source.onended = () => {
        if (this.playbackContext && this.playbackContext.currentTime >= this.nextPlayTime - 0.1) {
          this.isPlaying = false;
          this.onStateChange("listening");
        }
      };
    } catch (e) {
      console.error("Error playing chunk", e);
    }
  }

  private stopPlayback() {
    if (this.playbackContext) {
      this.playbackContext.close();
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.playbackContext = new AudioContextClass({ sampleRate: 24000 });
      this.nextPlayTime = this.playbackContext.currentTime;
      this.isPlaying = false;
    }
  }

  stop() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.stopPlayback();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.onStateChange("idle");
  }

  sendText(text: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.resetInactivityTimer();
      this.ws.send(JSON.stringify({ text }));

      // Track mode based on text input codewords too
      const lowerText = text.toLowerCase();
      if (lowerText.includes("alters art")) {
        this.currentMode = "normal";
      } else if (lowerText.includes("art")) {
        this.currentMode = "romantic";
      }
    }
  }

  private getMockYouTubeAnalytics(channelName: string, metricType: string) {
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
        const baseHash = Array.from(norm).reduce((acc, char) => acc + char.charCodeAt(0), 0);
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
  }
}
