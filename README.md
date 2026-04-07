# Urban Analysis Interactive Platform
A robust, high-fidelity Urban Analytics ecosystem synthesizing modern Javascript 3D WebGL interfaces with high-performance locally accelerated Python Deep Learning models.

## Overview
This platform evaluates structural walkability constraints and computational fluid aerodynamics natively across geographical layouts sourced dynamically from OpenStreetMap. Utilizing an isolated standalone backend matrix, it enables complete offline resilience without sacrificing computing capacity or polluting local operating environments.

---

## 🚀 Installation & Setup

We have designed this repository to be completely self-contained. It uses a portable Python package manager (`uv`), so **you do not even need to have Python installed on your system!**

To get the app fully running from scratch:

1. **Clone the Repository**
   ```bash
   git clone https://github.com/aliksumin/Urban3DAnalysis.git
   cd Urban3DAnalysis
   ```

2. **Run the Automated Installer**
   Double-click the `install.bat` file in the root directory. This script will automatically:
   - Install all Node.js UI dependencies (`npm install`).
   - Download a portable, isolated version of the `astral-uv` Python package manager.
   - Provision a virtual isolated Python sandbox in the `backend/` folder without touching your global registry.
   - Dynamically download the 208MB Microclimate AI Neural Network (`model.onnx`) directly from HuggingFace to bypass GitHub file size limits.

3. **Launch the Application**
   Once installation is finished, double-click `run.bat`. 
   This automatically boots the PyTorch/FastAPI backend on Port 8000 and the Vite/React UI on Port 5173, instantly syncing them together and opening your browser.

---

## 🧠 Gemini AI Configuration

To utilize the advanced semantic processing features of the Walkability module (which analyzes OpenStreetMap tags and infers building functions automatically), you need to provide a Google Gemini API Key.

1. Obtain a free API key from [Google AI Studio](https://aistudio.google.com/).
2. Run the application and open the interactive 3D map.
3. In the top-left menu bar, click **Settings**.
4. Paste your API Key into the designated **Gemini API Key** field.
5. You can toggle between `Gemini 2.5 Flash` (for high-speed throughput) and `Gemini Pro` variants dynamically. Your key is stored securely in your browser's local state and is strictly used for client-side tag inference.

---

## 🏛️ Analytical Modules Breakdown

The software operates through two distinct, hyper-accurate simulation pipelines located on the right-hand panel of the interface.

### 1. **Isochrone Walkability Engine**
The Walkability Engine calculates dynamic 15-minute city constraints using pathfinding Dijkstra mathematics dynamically tied to real-world pedestrian networks.
- **Smart Routing**: It detects roads and pedestrian pathways, converting them into navigable voxel nodes that snap directly to physical terrain heights rather than functioning as simple flat radii.
- **AI-Powered Parameterization**: You can deploy an AI Agent that connects to Gemini in the background. It will massively process up to 400 buildings simultaneously, analyzing native OSM metadata and tags to intelligently deduce exactly what function the building serves (e.g., Local Shop, Hotel, Clinic, School), replacing tedious manual data entry.
- **Target Tracking HUD**: Drops an agent into the 3D space, which maps surgical closest-target arcs out to various building and non-building amenities (like Parks and Plazas), verifying urban functional distribution.

### 2. **Microclimate Wind Surrogate (Eddy3D GAN)**
A generative pipeline that outputs phenomenally accurate fluid dynamic tensors bypassing traditional CFD meshing bottlenecks.
- **Hardware-Agnostic Neural Core**: It runs entirely on ONNX CPU optimizations, taking in heightmaps and bounding box requests triggered by the 3D grid interface.
- **High-Fidelity Voxel Visualization**: When activated in the 3D environment, the backend computes velocity matrices and wake turbulence, projecting the results directly back into the 3D window natively via a colored, animated generative particle map.
- **Dynamic Orientation**: Adjust wind speed, gust ranges, and 360-degree source direction vectors inside the parameters panel to instantly witness aerodynamic shifts around city structures.

---

## Technologies & Architecture

### `\frontend`
- **React-Three-Fiber**: Primary 3D simulation pipeline bridging WebGL via React hooks. Allows instantaneous matrix translation rendering InstancedMeshes and Geometry layers.
- **Zustand**: Decoupled, subscription-based logic manager enabling autonomous background AI chunking and application-wide persistence.
- **Vite & TailwindCSS**: Aggressive development bundler rendering a pristine Cyberpunk-inspired data environment.

### `\backend`
- **FastAPI & Uvicorn**: A blazingly fast asynchronous endpoint wrapping the ONNX math predictions into standalone REST URLs easily traversable by front-end WebGL pulls.
- **ONNXRuntime**: Decodes and executes deep learning models cleanly with minimal RAM.
- **astral-uv**: The deployment package manager that sandboxes Python components, eliminating dependency hell.
