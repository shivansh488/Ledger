import os
import cv2
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from tensorflow.keras.models import Model
from tensorflow.keras.layers import Input, Conv2D, MaxPooling2D, Flatten, Dense
from tensorflow.keras.utils import to_categorical
from tensorflow.keras.optimizers import Adam

# ==== CONFIG ====
IMG_HEIGHT, IMG_WIDTH = 40, 120
CAPTCHA_LENGTH = 5
CHAR_SET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
NUM_CLASSES = len(CHAR_SET)
char_to_index = {c: i for i, c in enumerate(CHAR_SET)}
index_to_char = {i: c for c, i in char_to_index.items()}

# ==== HELPERS ====
def encode_label(text):
    return [char_to_index[c] for c in text]

def decode_label(indices):
    return ''.join(index_to_char[i] for i in indices)

def is_valid_label(label):
    return (
        isinstance(label, str)
        and len(label) == CAPTCHA_LENGTH
        and all(c in char_to_index for c in label)
    )

# ==== LOAD DATA ====
def load_data(img_folder, label_csv):
    df = pd.read_csv(label_csv)
    df.dropna(subset=["filename", "text"], inplace=True)

    X, y = [], []

    for _, row in df.iterrows():
        label = str(row["text"]).strip()

        if not is_valid_label(label):
            print(f"⚠️ Skipping: {row['filename']} (invalid label: '{label}')")
            continue

        img_path = os.path.join(img_folder, row["filename"])
        if not os.path.exists(img_path):
            print(f"⚠️ Image not found: {img_path}")
            continue

        img = cv2.imread(img_path, cv2.IMREAD_GRAYSCALE)
        img = cv2.resize(img, (IMG_WIDTH, IMG_HEIGHT)).astype("float32") / 255.0
        X.append(img)
        y.append(encode_label(label))

    X = np.array(X).reshape(-1, IMG_HEIGHT, IMG_WIDTH, 1)
    y = np.array(y)
    return X, y

# ==== BUILD MODEL ====
def build_model():
    input_layer = Input(shape=(IMG_HEIGHT, IMG_WIDTH, 1))
    x = Conv2D(32, (3, 3), activation='relu', padding='same')(input_layer)
    x = MaxPooling2D(pool_size=(2, 2))(x)
    x = Conv2D(64, (3, 3), activation='relu', padding='same')(x)
    x = MaxPooling2D(pool_size=(2, 2))(x)
    x = Flatten()(x)

    outputs = [Dense(NUM_CLASSES, activation='softmax', name=f'char_{i}')(x) for i in range(CAPTCHA_LENGTH)]

    model = Model(inputs=input_layer, outputs=outputs)
    model.compile(
    loss=['categorical_crossentropy'] * CAPTCHA_LENGTH,
    optimizer=Adam(),
    metrics=['accuracy'] * CAPTCHA_LENGTH
)

    return model

# ==== TRAIN ====
def train():
    X, y = load_data("captchas", "labels.csv")
    print(f"✅ Loaded {len(X)} samples")

    # Split labels into 5 parts (one per character)
    y_split = [to_categorical(y[:, i], num_classes=NUM_CLASSES) for i in range(CAPTCHA_LENGTH)]

    # Sanity check for y_split dimensions
    for i, y_part in enumerate(y_split):
        assert y_part.shape == (len(y), NUM_CLASSES), f"❌ y_split[{i}] shape is {y_part.shape}, expected ({len(y)}, {NUM_CLASSES})"

    # Do train/val split for each y part
    X_train, X_val, y0_train, y0_val, y1_train, y1_val, y2_train, y2_val, y3_train, y3_val, y4_train, y4_val = train_test_split(
        X,
        *y_split,
        test_size=0.1,
        random_state=42
    )

    y_train = [y0_train, y1_train, y2_train, y3_train, y4_train]
    y_val = [y0_val, y1_val, y2_val, y3_val, y4_val]

    model = build_model()
    model.summary()

    model.fit(
        X_train,
        y_train,
        validation_data=(X_val, y_val),
        batch_size=32,
        epochs=30
    )

    model.save("captcha_model.h5")
    print("✅ Model saved as captcha_model.h5")



if __name__ == "__main__":
    train()
