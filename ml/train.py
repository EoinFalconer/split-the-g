"""Train the G-logo detector for the live kiosk viewfinder.

Downloads the public FindTheG dataset (CC BY 4.0) from Roboflow Universe,
fine-tunes a YOLO11 nano model locally, and exports ONNX for in-browser
inference via onnxruntime-web.

Usage: ROBOFLOW_API_KEY=... .venv/bin/python train.py
"""

import os
from pathlib import Path

from roboflow import Roboflow
from ultralytics import YOLO

HERE = Path(__file__).parent
DATA_DIR = HERE / "data" / "findtheg"

if not (DATA_DIR / "data.yaml").exists():
    rf = Roboflow(api_key=os.environ["ROBOFLOW_API_KEY"])
    project = rf.workspace("guinness-time").project("findtheg")
    project.version(1).download("yolov11", location=str(DATA_DIR))

model = YOLO("yolo11n.pt")
results = model.train(
    data=str(DATA_DIR / "data.yaml"),
    epochs=80,
    imgsz=640,
    batch=16,
    device="mps",
    project=str(HERE / "runs"),
    name="g-detector",
    exist_ok=True,
)

best = HERE / "runs" / "g-detector" / "weights" / "best.pt"
onnx_path = YOLO(str(best)).export(format="onnx", imgsz=320, opset=12)
print(f"\nExported for browser: {onnx_path}")
