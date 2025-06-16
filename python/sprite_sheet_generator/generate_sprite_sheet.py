import os
from PIL import Image

def generate_sprite_sheet(folder_path, output_filename, sheet_size=(1024, 1024), frame_size=80):
	"""
	Generate a sprite sheet from PNG files in the specified folder.
	
	Args:
		folder_path: Path to folder containing PNG images
		output_filename: Path to save the output sprite sheet
		sheet_size: Size of the sprite sheet (width, height)
		frame_size: Size of each frame (both width and height) in pixels
	"""
	try:
		png_files = [f for f in os.listdir(folder_path) if f.lower().endswith(('.png', '.jpg', '.webp'))]
	except FileNotFoundError:
		print(f"Error: Folder '{folder_path}' not found")
		return False
	png_files.sort()
	
	if not png_files:
		print(f"No PNG/JPG files found in {folder_path}")
		return False
	
	cols = sheet_size[0] // frame_size
	rows = sheet_size[1] // frame_size
	max_frames = cols * rows
	
	total_frames = min(len(png_files), max_frames)
	png_files = png_files[:total_frames]
	
	sprite_sheet = Image.new('RGBA', sheet_size, (0, 0, 0, 0))
	
	for i, png_file in enumerate(png_files):
		img = Image.open(os.path.join(folder_path, png_file))        
		img = img.resize((frame_size, frame_size), Image.LANCZOS)
		
		row = i // cols
		col = i % cols
		x = col * frame_size
		y = row * frame_size
		
		sprite_sheet.paste(img, (x, y), img if img.mode == 'RGBA' else None)
	
	os.makedirs(os.path.dirname(output_filename), exist_ok=True)
	sprite_sheet.save(output_filename)
	print(f"Generated sprite sheet: {output_filename} with {total_frames} frames")
	return True

def main():
	script_dir = os.path.dirname(os.path.abspath(__file__))
	base_dir = os.path.join(script_dir, "input")
	output_dir = os.path.join(script_dir, "output")
	frame_size=80
	sheet_width_height = 960
	
	os.makedirs(output_dir, exist_ok=True)
	
	folders = [f for f in os.listdir(base_dir) if os.path.isdir(os.path.join(base_dir, f))]

	for folder in folders:
		input_folder = os.path.join(base_dir, folder)
		img_files = [f for f in os.listdir(input_folder) if f.lower().endswith(('.png', '.jpg'))]
		max_cols = sheet_width_height // frame_size
		max_rows = sheet_width_height // frame_size
		max_frames = max_cols * max_rows
		frame_count = min(len(img_files), max_frames)
		output_file = os.path.join(output_dir, f"{folder}_{frame_count}.png")
		
		print(f"Processing {folder}...")
		generate_sprite_sheet(
			folder_path=input_folder,
			output_filename=output_file,
			sheet_size=(sheet_width_height, sheet_width_height),
			frame_size=frame_size
		)

if __name__ == "__main__":
	main()
