import cv2
import asyncio
import time
import logging
from contextlib import asynccontextmanager

import socketio
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

# ================= IMPORT MODULES =================
try:
    from camera.camera import CameraHandler
    from vision.hand_tracking import HandTracker
    from config import ProjectConfig
    from vision.control_mode import GestureControl
    from vision.teaching_mode import TeachingMode
    from vision.live_mode import LiveMode
    from vision.gesture_drive import GestureDriveMode
except ImportError as e:
    logging.error(f"Error importing modules: {e}")

# ================= LOGGING =================
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AI_APP")

# ================= SOCKET.IO =================
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")

# ================= INIT SYSTEMS =================
gesture_logic   = GestureControl()
teaching_mode   = TeachingMode(ProjectConfig.FRAME_WIDTH, ProjectConfig.FRAME_HEIGHT)
live_control    = LiveMode()
gesture_drive   = GestureDriveMode()  

# ================= CAMERA & TRACKER =================
cam = CameraHandler(
    ProjectConfig.CAM_INDEX,
    ProjectConfig.FRAME_WIDTH,
    ProjectConfig.FRAME_HEIGHT,
    ProjectConfig.STREAM_FPS
)

tracker = HandTracker(
    conf=ProjectConfig.HAND_CONFIDENCE,
    smoothing_alpha=ProjectConfig.TRACKING_SMOOTHING
)

# ================= MODE MANAGER =================
class ModeManager:
    def __init__(self):
        self.mode = ProjectConfig.DEFAULT_MODE

    def set(self, mode):
        if mode in ProjectConfig.MODES:
            self.mode = mode

    def get(self):
        return self.mode

mode_manager = ModeManager()
ai_task = None

# ================= AI ENGINE =================
async def ai_worker():
    fps_smooth = 0
    last_time  = time.time()
    logger.info("Roptics AI Worker started...")

    while True:
        start = time.time()

        frame = cam.get_frame()
        if frame is None:
            await asyncio.sleep(0.005)
            continue

        data           = tracker.process(frame)
        current_gesture = data.get("gesture", "none")
        fingers        = data.get("fingers", [0, 0, 0, 0, 0])
        lmList         = data.get("lmList", [])
        current_mode   = mode_manager.get()
        action         = "IDLE"

        if current_mode == "teaching":
            ai_input = {
                "x":       data.get("x", 0),
                "y":       data.get("y", 0),
                "fingers": fingers,
                "found":   data.get("found", False)
            }
            frame, action = teaching_mode.process(frame, ai_input)

        elif current_mode == "live":
            frame, action = live_control.process(frame, fingers, lmList)

            if "Photo" in action or "Captured" in action:
                await sio.emit("gui_notification", {"message": action})

            elif "Recording Started" in action:
                await sio.emit("gui_notification", {"message": "Recording Started"})

            elif "Recording Stopped" in action:
                await sio.emit("gui_notification", {"message": "Recording Stopped"})

        elif current_mode == "gesture":
            frame, action = gesture_drive.process(frame, fingers, lmList)

        elif current_mode == "security":
            # Security mode - placeholder 
            action = "SECURITY_WATCHING"

        with cam.lock:
            cam.latest_frame = frame

        new_mode = gesture_logic.get_new_mode(current_gesture, current_mode)
        if new_mode:
            mode_manager.set(new_mode)
            await sio.emit("server_change_mode", {"mode": new_mode})
            logger.info(f"🔄 Mode Auto-Switched → {new_mode}")

        now        = time.time()
        fps_smooth = fps_smooth * 0.9 + (1 / max(now - last_time, 1e-6)) * 0.1
        last_time  = now

        await sio.emit("ai_update", {
            "fps":       int(fps_smooth),
            "mode":      mode_manager.get(),
            "gesture":   current_gesture,
            "action":    action,
            "found":     data.get("found", False),
            "landmarks": data.get("landmarks", []),
            "zoom":      live_control.current_zoom,   
        })

        elapsed   = time.time() - start
        wait_time = max(0.001, (1 / ProjectConfig.MAX_AI_FPS) - elapsed)
        await asyncio.sleep(wait_time)


# ================= FASTAPI & LIFESPAN =================
@asynccontextmanager
async def lifespan(app: FastAPI):
    global ai_task
    logger.info("Roptics AI System Starting...")
    ai_task = asyncio.create_task(ai_worker())
    yield
    logger.info("Shutting down...")
    if ai_task:
        ai_task.cancel()
    cam.stop()

app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

asgi_app = socketio.ASGIApp(sio, app)

# ================= VIDEO STREAM =================
def frame_generator():
    while True:
        with cam.lock:
            frame = cam.latest_frame
        if frame is None:
            time.sleep(0.01)
            continue

        ret, buffer = cv2.imencode(
            ".jpg",
            frame,
            [cv2.IMWRITE_JPEG_QUALITY, ProjectConfig.DEFAULT_QUALITY]
        )
        if not ret:
            continue

        yield (b"--frame\r\n"
               b"Content-Type: image/jpeg\r\n\r\n" + buffer.tobytes() + b"\r\n")

@app.get("/video_feed")
async def video_feed():
    return StreamingResponse(
        frame_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

# ================= SOCKET EVENTS =================
@sio.event
async def connect(sid, environ):
    logger.info(f"Dashboard Connected: {sid}")

@sio.event
async def disconnect(sid):
    logger.info(f"Dashboard Disconnected: {sid}")

@sio.event
async def change_mode(sid, data):
    mode = data.get("mode", "live")
    mode_manager.set(mode)
    gesture_logic.reset_history()   
    logger.info(f"Manual Mode Switch → {mode}")

@sio.event
async def change_camera(sid, data):
    camera_id = int(data.get("camera_id", 0))
    logger.info(f"Switching camera → {camera_id}")
    cam.switch_camera(camera_id)
    await sio.emit("gui_notification", {"message": f"Camera switched to {camera_id}"})

@sio.event
async def start_recording(sid, data=None):
    if not live_control.is_recording:
        live_control.is_recording = True
        import os
        fourcc = cv2.VideoWriter_fourcc(*'XVID')
        path   = f"{ProjectConfig.VIDEO_PATH}/record_{int(time.time())}.avi"
        live_control.video_writer = cv2.VideoWriter(
            path, fourcc, 20.0,
            (ProjectConfig.FRAME_WIDTH, ProjectConfig.FRAME_HEIGHT)
        )
        logger.info(f"Recording started: {path}")
        await sio.emit("gui_notification", {"message": "Recording Started"})

@sio.event
async def stop_recording(sid, data=None):
    if live_control.is_recording:
        live_control.is_recording = False
        if live_control.video_writer:
            live_control.video_writer.release()
            live_control.video_writer = None
        logger.info("Recording stopped")
        await sio.emit("gui_notification", {"message": "Recording Stopped"})

@sio.event
async def take_snapshot(sid, data=None):
    frame = cam.get_frame()
    if frame is not None:
        filename = f"{ProjectConfig.PHOTO_PATH}/snap_{int(time.time())}.jpg"
        cv2.imwrite(filename, frame)
        logger.info(f"📸 Snapshot saved: {filename}")
        await sio.emit("gui_notification", {"message": "Photo Captured"})

@sio.event
async def manual_servo(sid, data):
    axis  = data.get("axis", "x")
    value = int(data.get("value", 90))
    logger.info(f"🎮 Manual Servo: axis={axis}, value={value}")

    if gesture_drive.serial_enabled and gesture_drive.ser:
        try:
            cmd = f"S{axis.upper()}{value}\n"   # مثلاً: SX90 أو SY45
            gesture_drive.ser.write(cmd.encode())
        except Exception as e:
            logger.error(f"Servo serial error: {e}")

@sio.event
async def update_settings(sid, data):
    if "quality" in data:
        ProjectConfig.DEFAULT_QUALITY = max(10, min(100, int(data["quality"])))
        logger.info(f"Quality → {ProjectConfig.DEFAULT_QUALITY}%")
    if "fps" in data:
        ProjectConfig.STREAM_FPS = max(1, int(data["fps"]))
        cam.update_fps(ProjectConfig.STREAM_FPS)
        logger.info(f"FPS → {ProjectConfig.STREAM_FPS}")

@sio.event
async def set_language(sid, data):
    lang = data.get("lang", "en").lower()
    teaching_mode.set_language(lang)
    logger.info(f"Keyboard language → {lang.upper()}")
    await sio.emit("gui_notification", {"message": f"Language: {lang.upper()}"})

# ================= RUN =================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        asgi_app,
        host=ProjectConfig.SOCKET_HOST,
        port=ProjectConfig.SOCKET_PORT,
        log_level="info"
    )