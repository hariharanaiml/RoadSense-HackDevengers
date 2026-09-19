from ultralytics import YOLO
import os

model_path = os.path.join(os.path.dirname(__file__), 'models', 'best.pt')
model = YOLO(model_path)
print('Model loaded successfully')
print('Class names:', model.names)
print('Number of classes:', len(model.names))
