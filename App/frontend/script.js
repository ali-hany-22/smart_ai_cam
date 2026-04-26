// ================= 1. CONFIG & CONNECTION =================
const SERVER_URL = `http://${window.location.hostname}:5000`;

const socket = io(SERVER_URL, {
    reconnection: true,
    reconnectionAttempts: 10,
    timeout: 10000,
    transports: ['websocket']
});

// ================= 2. STATE ENGINE =================
const AppState = {
    mode: "live",

    isDrawing: false,
    currentTool: "pen",         
    lastPoint: { x: 0, y: 0 },
    smoothPoint: { x: 0, y: 0 },
    smoothing: 0.6,

    isRecording: false,

    zoom: 1.0,

    textItems: [],              
    pendingText: null,          
};

// ================= 3. DOM ELEMENTS =================
const canvas      = document.getElementById("whiteboard-canvas");
const ctx         = canvas?.getContext("2d");
const videoEl     = document.getElementById("videoStream");
const logs        = document.getElementById("logs");
const flashOverlay = document.getElementById("camera-flash");
const recStatus   = document.getElementById("recording-status");
const zoomDisplay = document.getElementById("zoom-val");
const videoPanel  = document.querySelector(".video-panel");

const ui = {
    status:     document.getElementById("socket-status"),
    fps:        document.getElementById("fps-val"),
    action:     document.getElementById("action-status"),
    wbControls: document.getElementById("whiteboard-controls"),
};

// Teaching Toolbar Elements
const wb = {
    color:       document.getElementById("wb-color"),
    thickness:   document.getElementById("wb-thickness"),
    thicknessVal:document.getElementById("wb-thickness-val"),
    eraserSize:  document.getElementById("wb-eraser-size"),
    eraserVal:   document.getElementById("wb-eraser-val"),

    penBtn:      document.getElementById("wb-pen-btn"),
    eraserBtn:   document.getElementById("wb-eraser-btn"),
    clearBtn:    document.getElementById("clear-canvas-btn"),
    recordBtn:   document.getElementById("record-btn"),
    recordIcon:  document.getElementById("record-icon"),
    snapBtn:     document.getElementById("snap-btn"),
    langBtn:     document.getElementById("wb-lang-btn"),      
    langLabel:   document.getElementById("wb-lang-label"),    

    textInput:   document.getElementById("wb-text-input"),
    fontSize:    document.getElementById("wb-font-size"),
    fontVal:     document.getElementById("wb-font-val"),
    textColor:   document.getElementById("wb-text-color"),
    addTextBtn:  document.getElementById("wb-add-text-btn"),

    textX:       document.getElementById("wb-text-x"),
    textXVal:    document.getElementById("wb-text-x-val"),
    textY:       document.getElementById("wb-text-y"),
    textYVal:    document.getElementById("wb-text-y-val"),
};

// ================= 4. INITIALIZATION =================
document.addEventListener("DOMContentLoaded", () => {
    if (videoEl) videoEl.src = `${SERVER_URL}/video_feed`;

    resizeCanvas();
    initModes();
    initControls();
    initTeachingToolbar();
    initCameraSelect();         
    initDrag();

    log("Roptics AI System Initialized & Online");
});

window.addEventListener("resize", () => {
    resizeCanvas();
    redrawAllText();           
});

// ================= 5. SOCKET EVENTS =================
socket.on("connect", () => {
    setStatus(true);
    log("Connected to AI Server");
    if (videoEl) videoEl.src = `${SERVER_URL}/video_feed?t=${Date.now()}`;
});

socket.on("disconnect", () => {
    setStatus(false);
    log("Disconnected from Server");
});

socket.on("server_change_mode", (data) => {
    setModeUI(data.mode);
    log(`👋 Gesture Switch: ${data.mode.toUpperCase()}`);
});

socket.on("gui_notification", (data) => {
    handleNotification(data);
});

socket.on("ai_update", (data) => {
    handleAIUpdate(data);
});

// ================= 6. DATA HANDLER =================
function handleAIUpdate(data) {
    if (!data) return;

    if (data.fps    && ui.fps)    ui.fps.innerText    = data.fps;
    if (data.action && ui.action) ui.action.innerText = data.action;

    if (data.zoom && data.zoom !== AppState.zoom) {
        AppState.zoom = data.zoom;
        if (zoomDisplay) zoomDisplay.innerText = data.zoom.toFixed(1);
    }

    if (data.landmarks) drawHandSkeleton(data.landmarks);

    if (AppState.mode === "teaching" && data.landmarks) {
        handleBrowserWhiteboard(data.landmarks);
    }
}

// ================= 7. NOTIFICATION HANDLER =================
function handleNotification(data) {
    const msg = data.message;

    if (msg.includes("Photo") || msg.includes("Captured")) {
        triggerFlash();
        showToast("Photo Saved!");
        log("Snapshot stored in assets/photos");
    }

    if (msg.includes("Recording Started")) {
        setRecordingUI(true);
        log("Recording started...");
    } else if (msg.includes("Recording Stopped")) {
        setRecordingUI(false);
        log("Video saved to assets/videos");
    }
}

function triggerFlash() {
    if (!flashOverlay) return;
    flashOverlay.classList.add("active");
    setTimeout(() => flashOverlay.classList.remove("active"), 150);
}

function showToast(msg) {
    const toast = document.getElementById("snap-toast");
    if (!toast) return;
    toast.innerText = msg;
    toast.style.display = "block";
    setTimeout(() => toast.style.display = "none", 2000);
}

function setRecordingUI(active) {
    AppState.isRecording = active;

    // header REC badge
    if (recStatus) recStatus.style.display = active ? "flex" : "none";

    if (wb.recordBtn) {
        wb.recordBtn.classList.toggle("recording", active);
        if (wb.recordIcon) {
            wb.recordIcon.className = active ? "fas fa-stop" : "fas fa-circle";
        }
        wb.recordBtn.childNodes[wb.recordBtn.childNodes.length - 1].textContent =
            active ? " Stop" : " Record";
    }
}

// ================= 8. TELEMETRY ENGINE (SVG) =================
function drawHandSkeleton(landmarks) {
    const svg = document.getElementById("hand-skeleton");
    if (!svg) return;

    svg.innerHTML = "";
    const W = 640, H = 480;

    const connections = [
        [0,1,2,3,4],
        [0,5,6,7,8],
        [0,9,10,11,12],
        [0,13,14,15,16],
        [0,17,18,19,20],
        [5,9,13,17]
    ];

    connections.forEach(path => {
        const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        const pts = path
            .filter(idx => landmarks[idx])
            .map(idx => `${landmarks[idx].x * W},${landmarks[idx].y * H}`)
            .join(" ");
        polyline.setAttribute("points", pts);
        polyline.setAttribute("class", "hand-connection");
        svg.appendChild(polyline);
    });

    landmarks.forEach((p, idx) => {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", p.x * W);
        circle.setAttribute("cy", p.y * H);
        circle.setAttribute("r",  idx === 8 ? "5" : "3");
        circle.setAttribute("class", idx === 8 ? "joint index-joint" : "joint");
        svg.appendChild(circle);
    });
}

// ================= 9. BROWSER WHITEBOARD (Hand Drawing) =================
function handleBrowserWhiteboard(lm) {
    if (!canvas || !ctx) return;

    const indexTip  = lm[8];
    const middleTip = lm[12];

    const rawX = indexTip.x * canvas.width;
    const rawY = indexTip.y * canvas.height;

    AppState.smoothPoint.x = AppState.smoothPoint.x * AppState.smoothing + rawX * (1 - AppState.smoothing);
    AppState.smoothPoint.y = AppState.smoothPoint.y * AppState.smoothing + rawY * (1 - AppState.smoothing);

    const isDrawing = indexTip.y < middleTip.y - 0.05;

    if (isDrawing) {
        if (!AppState.isDrawing) {
            AppState.lastPoint = { ...AppState.smoothPoint };
            AppState.isDrawing = true;
        }
        drawCanvasLine(AppState.lastPoint, AppState.smoothPoint);
        AppState.lastPoint = { ...AppState.smoothPoint };
    } else {
        AppState.isDrawing = false;
    }
}

function drawCanvasLine(p1, p2) {
    if (!ctx) return;

    if (AppState.currentTool === "eraser") {
        const size = parseInt(wb.eraserSize?.value || 20);
        ctx.clearRect(
            AppState.smoothPoint.x - size / 2,
            AppState.smoothPoint.y - size / 2,
            size, size
        );
        return;
    }

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = wb.color?.value || "#00e5ff";
    ctx.lineWidth   = parseInt(wb.thickness?.value || 5);
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.stroke();
}

// ================= 10. CANVAS MOUSE DRAWING =================
// Teaching Mode
function initCanvasMouseDrawing() {
    if (!canvas) return;

    let mouseDown = false;
    let lastMouse = { x: 0, y: 0 };

    canvas.addEventListener("mousedown", (e) => {
        mouseDown = true;
        const pos = getCanvasPos(e);
        lastMouse = pos;
        AppState.isDrawing = true;
    });

    canvas.addEventListener("mousemove", (e) => {
        if (!mouseDown) return;
        const pos = getCanvasPos(e);

        if (AppState.currentTool === "eraser") {
            const size = parseInt(wb.eraserSize?.value || 20);
            ctx.clearRect(pos.x - size / 2, pos.y - size / 2, size, size);
            redrawAllText();
        } else {
            drawCanvasLine(lastMouse, pos);
        }

        lastMouse = pos;
    });

    canvas.addEventListener("mouseup",    () => { mouseDown = false; AppState.isDrawing = false; });
    canvas.addEventListener("mouseleave", () => { mouseDown = false; AppState.isDrawing = false; });

    // Touch support 
    canvas.addEventListener("touchstart", (e) => {
        e.preventDefault();
        mouseDown = true;
        lastMouse = getCanvasPos(e.touches[0]);
    }, { passive: false });

    canvas.addEventListener("touchmove", (e) => {
        e.preventDefault();
        if (!mouseDown) return;
        const pos = getCanvasPos(e.touches[0]);
        drawCanvasLine(lastMouse, pos);
        lastMouse = pos;
    }, { passive: false });

    canvas.addEventListener("touchend", () => { mouseDown = false; });
}

function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) * (canvas.width  / rect.width),
        y: (e.clientY - rect.top)  * (canvas.height / rect.height),
    };
}

// ================= 11. TEXT ON CANVAS =================
function addTextToCanvas() {
    if (!ctx || !canvas) return;

    const text      = wb.textInput?.value?.trim();
    if (!text) { log("اكتب نص الأول!"); return; }

    const xPercent  = parseInt(wb.textX?.value  || 50) / 100;
    const yPercent  = parseInt(wb.textY?.value  || 50) / 100;
    const fontSize  = parseInt(wb.fontSize?.value || 24);
    const color     = wb.textColor?.value || "#ffffff";

    const x = canvas.width  * xPercent;
    const y = canvas.height * yPercent;

    AppState.textItems.push({ text, x: xPercent, y: yPercent, fontSize, color });

    renderText({ text, x, y, fontSize, color });

    log(`Text added: "${text}"`);
    if (wb.textInput) wb.textInput.value = "";
}

function renderText({ text, x, y, fontSize, color }) {
    if (!ctx) return;
    ctx.save();
    ctx.font         = `bold ${fontSize}px Cairo, Roboto, sans-serif`;
    ctx.fillStyle    = color;
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor  = "rgba(0,0,0,0.7)";
    ctx.shadowBlur   = 4;
    ctx.fillText(text, x, y);
    ctx.restore();
}

function redrawAllText() {
    if (!ctx || !canvas) return;
    AppState.textItems.forEach(item => {
        renderText({
            text:     item.text,
            x:        item.x * canvas.width,
            y:        item.y * canvas.height,
            fontSize: item.fontSize,
            color:    item.color,
        });
    });
}

// ================= 12. TEACHING TOOLBAR INIT =================
function initTeachingToolbar() {
    if (!wb.penBtn) return;

    // --- Pen / Eraser toggle ---
    wb.penBtn?.addEventListener("click", () => {
        AppState.currentTool = "pen";
        wb.penBtn.classList.add("active");
        wb.eraserBtn?.classList.remove("active");
        videoPanel?.classList.remove("eraser-mode");
        log("Tool: Pen");
    });

    wb.eraserBtn?.addEventListener("click", () => {
        AppState.currentTool = "eraser";
        wb.eraserBtn.classList.add("active");
        wb.penBtn?.classList.remove("active");
        videoPanel?.classList.add("eraser-mode");
        log("Tool: Eraser");
    });

    // --- Clear All ---
    wb.clearBtn?.addEventListener("click", () => {
        if (!ctx || !canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        AppState.textItems = [];
        log("Whiteboard Cleared");
    });

    // --- Record button ---
    wb.recordBtn?.addEventListener("click", () => {
        if (!AppState.isRecording) {
            socket.emit("start_recording");
            log("Recording requested...");
        } else {
            socket.emit("stop_recording");
            log("Stop recording requested...");
        }
    });

    // --- Snap button ---
    wb.snapBtn?.addEventListener("click", () => {
        socket.emit("take_snapshot");
        triggerFlash();
        showToast("Photo Saved!");
        log("Snapshot requested");
    });

    // --- Sliders live update ---
    wb.thickness?.addEventListener("input", (e) => {
        if (wb.thicknessVal) wb.thicknessVal.innerText = e.target.value;
    });

    wb.eraserSize?.addEventListener("input", (e) => {
        if (wb.eraserVal) wb.eraserVal.innerText = e.target.value;
    });

    wb.fontSize?.addEventListener("input", (e) => {
        if (wb.fontVal) wb.fontVal.innerText = e.target.value;
    });

    // --- Text Position sliders ---
    wb.textX?.addEventListener("input", (e) => {
        if (wb.textXVal) wb.textXVal.innerText = e.target.value;
    });

    wb.textY?.addEventListener("input", (e) => {
        if (wb.textYVal) wb.textYVal.innerText = e.target.value;
    });

    wb.addTextBtn?.addEventListener("click", addTextToCanvas);

    wb.textInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") addTextToCanvas();
    });

    wb.langBtn?.addEventListener("click", () => {
        const current = wb.langBtn.dataset.lang || "en";
        const next    = current === "en" ? "ar" : "en";
        wb.langBtn.dataset.lang = next;
        if (wb.langLabel) wb.langLabel.innerText = next.toUpperCase();
        socket.emit("set_language", { lang: next });
        log(`Keyboard language → ${next.toUpperCase()}`);
    });

    initCanvasMouseDrawing();
}

// ================= 13. UI & MODES =================
function initModes() {
    document.querySelectorAll(".mode-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const mode = btn.dataset.mode;
            setModeUI(mode);
            socket.emit("change_mode", { mode });
            log(`Switched to ${mode.toUpperCase()}`);
        });
    });
}

function setModeUI(mode) {
    AppState.mode = mode;

    document.querySelectorAll(".mode-btn").forEach(b => {
        b.classList.toggle("active", b.dataset.mode === mode);
    });

    if (videoPanel) videoPanel.dataset.currentMode = mode;

    if (ui.wbControls) {
        ui.wbControls.style.display = (mode === "teaching") ? "flex" : "none";
    }

    if (mode !== "teaching") {
        AppState.isDrawing = false;
        videoPanel?.classList.remove("eraser-mode");
    }
}

// ================= 14. CONTROLS INIT =================
function initControls() {
    bindSlider("quality-range", "update_settings", "quality", "q-val", "%");
    bindSlider("servo-x", "manual_servo", "x");
    bindSlider("servo-y", "manual_servo", "y");

    // Sidebar Toggle
    document.getElementById("toggle-sidebar-btn")?.addEventListener("click", () => {
        document.getElementById("sidebar")?.classList.toggle("hidden");
    });
}

function bindSlider(id, eventName, key, labelId, suffix = "") {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener("input", (e) => {
        const val = parseInt(e.target.value);
        if (labelId) {
            const label = document.getElementById(labelId);
            if (label) label.innerText = val + suffix;
        }

        if (eventName === "manual_servo") {
            socket.emit(eventName, { axis: key, value: val });
        } else {
            socket.emit(eventName, { [key]: val });
        }
    });
}

// ================= 15.AMERA SELECT =================
function initCameraSelect() {
    const camSelect = document.getElementById("camera-select");
    if (!camSelect) return;

    camSelect.addEventListener("change", (e) => {
        const cameraId = parseInt(e.target.value);
        socket.emit("change_camera", { camera_id: cameraId });
        log(`Camera switched to: ${e.target.options[e.target.selectedIndex].text}`);

        setTimeout(() => {
            if (videoEl) videoEl.src = `${SERVER_URL}/video_feed?t=${Date.now()}`;
        }, 1000);
    });
}

// ================= 16. HELPERS =================
function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();

    // حفظ الـ drawing الحالي قبل resize
    let imageData = null;
    if (canvas.width > 0 && canvas.height > 0) {
        try { imageData = ctx.getImageData(0, 0, canvas.width, canvas.height); } catch(e) {}
    }

    canvas.width  = rect.width;
    canvas.height = rect.height;

    if (imageData) {
        try { ctx.putImageData(imageData, 0, 0); } catch(e) {}
    }

    redrawAllText();
}

function setStatus(online) {
    if (!ui.status) return;
    ui.status.className = `status-badge ${online ? "connected" : "disconnected"}`;
    ui.status.innerText = online ? "Connected" : "Disconnected";
}

function initDrag() {
    const grid = document.getElementById("draggable-grid");
    if (grid && typeof Sortable !== "undefined") {
        new Sortable(grid, {
            animation: 150,
            handle: ".drag-handle",
            ghostClass: "sortable-ghost",
        });
    }
}

function log(msg) {
    if (!logs) return;
    const p = document.createElement("p");
    p.className = "log-entry";
    const time = new Date().toLocaleTimeString("ar-EG");
    p.innerText = `> [${time}] ${msg}`;
    logs.appendChild(p);
    logs.scrollTop = logs.scrollHeight;
}
