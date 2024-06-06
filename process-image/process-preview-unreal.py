import unreal
from PIL import Image
import os

def process_images(input_files, output_file):
    img1 = Image.open(input_files[0])
    img2 = Image.open(input_files[1])
    img3 = Image.open(input_files[2])

    width1, height1 = img1.size
    width2, height2 = img2.size
    width3, height3 = img3.size

    gap_width = 12

    result_img = Image.new('RGB', (width1 + width2 + width3 + 2 * gap_width, max(height1, height2, height3)), color='#aeaeae')

    result_img.paste(img1, (0, 0))
    result_img.paste(img2, (width1 + gap_width, 0))
    result_img.paste(img3, (width1 + width2 + 2 * gap_width, 0))

    result_img.save(output_file)

    # Remove input images
    for file in input_files:
        os.remove(file)

saveDataDir = unreal.Paths.project_saved_dir()
screenshotsDir = saveDataDir + "/Screenshots/WindowsEditor/"
input_directory = screenshotsDir + "/Process/"
output_directory = screenshotsDir

# Create the input and output directories if they do not exist
os.makedirs(input_directory, exist_ok=True)
os.makedirs(output_directory, exist_ok=True)

png_files = sorted([f for f in os.listdir(input_directory) if f.endswith('.png')])

for i in range(0, len(png_files), 3):
    input_files = [os.path.join(input_directory, png_files[i+j]) for j in range(3)]

    output_file_name = f'{os.path.splitext(png_files[i])[0].replace("_1", "")}_All.png'
    output_file = os.path.join(output_directory, output_file_name)

    print(f'Processing {output_file_name}')

    process_images(input_files, output_file)