# Urban Analysis Interactive Platform
A robust, high-fidelity Urban Analytics ecosystem synthesizing modern Javascript 3D WebGL interfaces with high-performance locally accelerated Python Deep Learning models.

## Overview
This platform evaluates structural walkability constraints and computational fluid aerodynamics natively across geographical layouts sourced dynamically from OpenStreetMap. Utilizing an isolated standalone backend matrix, it enables complete offline resilience without sacrificing computing capacity or polluting local operating environments.

## Feature Modules

### 1. **Isochrone Walkability Engine**
   - Implements Dijkstra graph pathfinding strictly alongside generated navigation nodes mapped to extracted road arrays.
   - Calculates dynamic walkable radii metrics projecting organic geometric isochrone meshes (splines) hugging real-world terrain curvature, complete with customizable aesthetic interfaces and auto-distributed building functionality markers.

### 2. **Microclimate Wind Surrogate (Eddy3D GAN)**
   - Computes advanced Eulerian-equivalent environmental turbulence vectors instantly via a PyTorch ONNX Generative Adversarial Network endpoint.
   - Operates a local Fast API interface evaluating base64 ZLIB payloads against its 208MB neural core. Outputs hyper-resolution PNG velocity graphs visually representing spatial pressures across topological intersection boxes wrapped instantly onto the interface.

## Technologies & Directories

### `\frontend`
- **React-Three-Fiber**: Primary 3D simulation pipeline bridging WebGL via React hooks. Allows instantaneous matrix translation rendering InstancedMeshes and Geometry layers independently.
- **Zustand**: Decoupled, subscription-based external logic manager broadcasting synchronous parameter changes universally without bottlenecking React rendering closures.
- **Vite & TailwindCSS**: Aggressive development bundler and utility class framework rendering a pristine Cyberpunk-inspired data panel aesthetic.

### `\backend`
- **FastAPI & Uvicorn**: A blazingly fast asynchronous Python endpoint wrapping the ONNX matrix predictions into standalone REST URLs easily traversable by front-end API pulls.
- **ONNXRuntime**: Natively decodes and executes the deep learning models hardware-agnostically with minimal RAM overhead footprint, eliminating reliance on PyTorch environments explicitly.
- **astral-uv**: The deployment package manager that dynamically sandboxes Python components strictly inside this directory, bypassing globally invasive installations.

## Installation Pipeline

Because the AI modules depend heavily upon extensive binary trees, the root structure is configured to execute absolutely isolated installations. You **do not** need Python pre-installed.

1. Double-click the `install.bat` file.
2. The payload will:
    - Download all Node packages into the frontend.
    - Securely fetch the `.exe` standalone `uv` Python wrapper natively via Powershell.
    - Provision an isolated Python environment virtually inside `/backend`.
    - Install backend dependencies and pull the `model.onnx` asset from HuggingFace safely into local folders.

## Operation & Execution

Once the execution environment is finalized, double-click `run.bat` whenever you want to utilize the platform.
1. The batch script natively spawns the Python backend proxy via a detached local host on port 8000.
2. A subsequent shell actively boots the `Vite` pipeline on Port 5173.
3. Your browser will link seamlessly, securely networking the Javascript payloads across the internal bridge dynamically.
