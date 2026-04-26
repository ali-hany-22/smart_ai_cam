import os

class ProjectConfig:
    # ================= CAMERA =================
    CAM_INDEX = 1  
    FRAME_WIDTH = 640
    FRAME_HEIGHT = 480

    # ================= STREAMING =================
    STREAM_FPS = 25
    MAX_AI_FPS = 30
    DEFAULT_QUALITY = 50   

    # ================= AI SETTINGS =================
    HAND_CONFIDENCE = 0.7
    MIN_DETECTION_CONFIDENCE = 0.7
    MIN_TRACKING_CONFIDENCE = 0.7
    TRACKING_SMOOTHING = 0.65

    # ================= SOCKET SERVER =================
    SOCKET_HOST = "0.0.0.0"
    SOCKET_PORT = 5000
    CORS_ALLOWED_ORIGINS = "*"

    # ================= ESP32 & SERIAL =================
    SERIAL_PORT = "/dev/ttyUSB0"
    BAUD_RATE = 115200
    
    CMD_UP = "U"
    CMD_DOWN = "D"
    CMD_LEFT = "L"
    CMD_RIGHT = "R"
    CMD_STOP = "S"
    
    DEADZONE_X = 50
    DEADZONE_Y = 40

    # ================= MODES =================
    DEFAULT_MODE = "live"
    MODES = ["live", "teaching", "security", "gesture"]

    # ================= TEACHING MODE (WHITEBOARD) =================
    COLORS = [
        (255, 229, 0),   # Cyan (BGR: 255, 229, 0)
        (255, 0, 255),   # Magenta
        (128, 222, 74),  # Green
        (0, 255, 255),   # Yellow
        (0, 0, 255),     # Red
        (255, 255, 255)  # White
    ]
    DRAW_THICKNESS = 8
    ERASER_THICKNESS = 80
    
    KEYS_EN = [["Q","W","E","R","T","Y","U","I","O","P"],
               ["A","S","D","F","G","H","J","K","L","<"],
               ["Z","X","C","V","B","N","M",",","."," "]]
    
    KEYS_AR = [["ض","ص","ث","ق","ف","غ","ع","ه","خ","ح"],
               ["ش","س","ي","ب","ل","ا","ت","ن","م","<"],
               ["ئ","ء","ؤ","ر","لا","ى","ة","و","ز"," "]]

    # ================= LIVE MODE (ZOOM & CAPTURE) =================
    MAX_ZOOM = 3.0
    PHOTO_PATH = "assets/photos"
    VIDEO_PATH = "assets/videos"

    # ================= DEBUG & FUTURE =================
    DEBUG = True
    ENABLE_RECORDING = True

os.makedirs(ProjectConfig.PHOTO_PATH, exist_ok=True)
os.makedirs(ProjectConfig.VIDEO_PATH, exist_ok=True)