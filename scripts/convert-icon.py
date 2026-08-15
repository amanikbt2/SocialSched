from PIL import Image
import os

def main():
    icon_png_path = os.path.join(os.path.dirname(__file__), '../assets/icon.png')
    icon_ico_path = os.path.join(os.path.dirname(__file__), '../assets/icon.ico')

    if not os.path.exists(icon_png_path):
        print(f"Error: {icon_png_path} does not exist.")
        return

    print("Opening icon.png...")
    img = Image.open(icon_png_path)

    # Standard Windows multi-resolution icon sizes
    sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    
    print("Saving multi-resolution icon.ico...")
    img.save(icon_ico_path, format='ICO', sizes=sizes)
    print(f"Successfully generated: {icon_ico_path}")

if __name__ == "__main__":
    main()
