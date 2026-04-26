# 🦾 Roptics AI: Next-Gen Computer Vision Control System
> **An Advanced Human-Machine Interface (HMI) integrating MediaPipe, FastAPI, and ESP32 for Real-Time Automation.**

[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg?style=for-the-badge&logo=python)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Framework-009688.svg?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![OpenCV](https://img.shields.io/badge/OpenCV-Computer--Vision-5C3EE8.svg?style=for-the-badge&logo=opencv)](https://opencv.org/)
[![MediaPipe](https://img.shields.io/badge/Google-MediaPipe-0070D2.svg?style=for-the-badge&logo=google)](https://mediapipe.dev/)

**Roptics AI** is a sophisticated system that bridges the gap between Computer Vision and Hardware Control. It allows users to interact with their environment through hand gestures, featuring an interactive virtual whiteboard, digital media control (Zoom/Record), and real-time hardware tracking using a single-axis servo mechanism.

---

## 🏗️ System Architecture & File Structure

The project follows a **Modular Architecture**, ensuring high scalability and clean separation of concerns:

```text
SMART_AI_CAM_R/
├── 📂 backend/                  # The AI Core Engine
│   ├── 📂 camera/               # Multi-threaded Video Acquisition
│   │   └── camera.py            # Low-latency V4L2 frame handler
│   ├── 📂 vision/               # Computer Vision Algorithms
│   │   ├── hand_tracking.py     # 21-Landmark Detection & Gesture Recognition
│   │   ├── teaching_mode.py     # Virtual Whiteboard & Air-Keyboard logic
│   │   ├── live_mode.py         # Smooth Pinch-to-Zoom & Media Controller
│   │   ├── gesture_drive.py     # Serial Comm & ESP32 Pan-Servo logic
│   │   └── control_mode.py      # Automated State Machine (Mode Switcher)
│   ├── 📂 assets/               # Local Media Repository
│   │   ├── 📂 photos/           # AI-captured snapshots
│   │   └── 📂 videos/           # H.264 encoded recordings
│   ├── app.py                   # FastAPI Server & Socket.IO Entry Point
│   └── config.py                # Global Constants & Environment Settings
├── 📂 ESP32/                    # Embedded Firmware
│   └── esp32_pan_servo.ino      # C++ Micro-controller Firmware
├── 📂 frontend/                 # Interactive Dashboard
│   ├── index.html               # Main UI Layout (Cyberpunk Theme)
│   ├── style.css                # Futuristic Visual Design
│   └── script.js                # WebSocket & Real-time SVG Hand Visualization
└── 📂 test/                     # Unit Tests & Debugging Tools
🚀 Key Features
📡 1. Advanced Hand Tracking

Powered by Google MediaPipe, the system tracks 21 hand landmarks in 3D space. It calculates finger states (Open/Closed) and translates them into system actions with sub-20ms latency.
✍️ 2. Interactive Teaching Mode

Transform any space into a smart classroom:

    Air Writing: Draw on the screen using your index finger.

    Virtual Keyboard: Type text in mid-air and reposition it using drag-and-drop gestures.

    Dynamic Palettes: Change ink colors and stroke thickness via specific hand signs.

🎥 3. Smart Media Control (Live Mode)

    Smooth Pinch-to-Zoom: A digital zoom mechanism with exponential smoothing for professional-grade transitions.

    Gesture Snapshots: Capture high-resolution images using a "Thumbs Up" gesture.

    Remote Recording: Start/Stop video recording using the "Peace" sign.

⚙️ 4. Hardware Tracking (ESP32 Integration)

The gesture_drive module analyzes the hand's spatial coordinates and transmits directional commands (Right, Left, Stop) via Serial to an ESP32, which drives a Pan-Servo motor to keep the user in the frame.
🛠️ Installation & Setup
1. Prerequisites

    OS: Ubuntu 22.04+ (Recommended for optimal V4L2 performance).

    Environment: Python 3.10+.

    Hardware: ESP32 + SG90/MG90 Servo Motor.

2. Software Setup
Bash

# Clone the repository
git clone https://github.com/ali-hany-22/smart_AI_cam.git
cd SMART_AI_CAM_R

# Install required packages
pip install opencv-python mediapipe fastapi uvicorn python-socketio pyserial numpy

3. Execution

    Connect the ESP32 via USB.

    Grant Serial permissions: sudo chmod 666 /dev/ttyUSB0.

    Run the backend: python3 backend/app.py.

    Open frontend/index.html in a modern browser.

👤 Author

Ali Hany Ali Nosseir

    3rd Year AI Student @ Kafrelsheikh Unrt_iversity

    Aspiring Data Scientist & Computer Vision Engineer

🛡️ License

This project is open-source and available under the MIT License.

Don't forget to add a screenshot of your Cyberpunk dashboard here! It will make the project stand out even more. 🦾🚀
