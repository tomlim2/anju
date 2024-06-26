import os
from PIL import Image

# from downsize import step0_downsize_settings as settings

target_drive = "D:/vs/anju/python/texture_manager/downsize/target_images/"
desired_size = 924

for root, dirs, files in os.walk(target_drive):
    for filename in files:
        print(filename)        
        if filename.lower().endswith('.jpg') or filename.lower().endswith('.png') or filename.lower().endswith('.tga') or filename.lower().endswith('.jpeg'):
            image_path = os.path.join(root, filename)
            image = Image.open(image_path)
            width, height = image.size
            if width > desired_size or height > desired_size:
                new_width = desired_size
                new_height = int(height * new_width / width)
                resized_image = image.resize((new_width, new_height))
                print(f"Resizing image: {image_path}")
                resized_image.save(image_path)

print("All images resized successfully.")