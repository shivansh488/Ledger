import numpy as np
import cv2
from tensorflow.keras.models import load_model
from captcha_config import CHARACTERS, CAPTCHA_LENGTH, IMAGE_WIDTH, IMAGE_HEIGHT
import sys

# Load model
model = load_model("captcha_model.h5")

# Preprocess input image
def preprocess_image(image_path):
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    img = cv2.resize(img, (IMAGE_WIDTH, IMAGE_HEIGHT))
    img = img / 255.0
    img = np.expand_dims(img, axis=-1)  # Add channel
    img = np.expand_dims(img, axis=0)   # Add batch
    return img

# Decode predictions
def decode_prediction(preds):
    label = ""
    for pred in preds:
        idx = np.argmax(pred)
        label += CHARACTERS[idx]
    return label

# Usage: python predict_captcha.py captcha_22.png
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("⚠️ Please provide the image path.")
        sys.exit()

    image_path = sys.argv[1]
    img = preprocess_image(image_path)
    preds = model.predict(img)
    captcha_text = decode_prediction(preds)
    print(f"🔍 Predicted CAPTCHA: {captcha_text}")
