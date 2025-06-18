import os
from PIL import Image
import argparse

def calculate_sheet_size(frame_size, max_sheet_size=(1024, 1024)):
	frame_width, frame_height = frame_size
	max_width, max_height = max_sheet_size
	
	max_cols = max_width // frame_width
	max_rows = max_height // frame_height
	
	sheet_width = max_cols * frame_width
	sheet_height = max_rows * frame_height
	
	return (sheet_width, sheet_height)

def generate_sprite_sheet(folder_path, output_filename, frame_size=(260, 145), fps_reduction=2, max_sheet_size=(1024, 1024)):
	try:
		png_files = [f for f in os.listdir(folder_path) if f.lower().endswith(('.png', '.jpg', '.webp'))]
	except FileNotFoundError:
		print(f"Error: Folder '{folder_path}' not found")
		return False
	png_files.sort()
	
	if not png_files:
		print(f"No PNG/JPG files found in {folder_path}")
		return False
	
	png_files = png_files[::fps_reduction]
	sheet_size = calculate_sheet_size(frame_size, max_sheet_size)

	cols = sheet_size[0] // frame_size[0]
	rows = sheet_size[1] // frame_size[1]
	max_frames = cols * rows
	
	total_frames = min(len(png_files), max_frames)
	png_files = png_files[:total_frames]
	
	sprite_sheet = Image.new('RGBA', sheet_size, (0, 0, 0, 0))
	
	for i, png_file in enumerate(png_files):
		img = Image.open(os.path.join(folder_path, png_file))        
		img_width, img_height = img.size
		target_width, target_height = frame_size
		target_ratio = target_width / target_height
		img_ratio = img_width / img_height
		
		if img_ratio > target_ratio:
			# Image is wider, crop width
			new_width = int(img_height * target_ratio)
			left = (img_width - new_width) // 2
			crop_box = (left, 0, left + new_width, img_height)
		else:
			# Image is taller, crop height
			new_height = int(img_width / target_ratio)
			top = (img_height - new_height) // 2
			crop_box = (0, top, img_width, top + new_height)
		
		img = img.crop(crop_box).resize(frame_size, Image.LANCZOS)
		
		row = i // cols
		col = i % cols
		x = col * frame_size[0]
		y = row * frame_size[1]
		
		sprite_sheet.paste(img, (x, y), img if img.mode == 'RGBA' else None)
	
	os.makedirs(os.path.dirname(output_filename), exist_ok=True)
	sprite_sheet.save(output_filename)
	print(f"Generated sprite sheet: {output_filename} with {total_frames} frames (sheet size: {sheet_size})")
	return True

def main(frame_size = (80, 80), fps_reduction = 1, is_motion = True):
	script_dir = os.path.dirname(os.path.abspath(__file__))
	base_dir = os.path.join(script_dir, "input")
	output_dir = os.path.join(script_dir, "output")

	frame_size = frame_size
	fps_reduction = fps_reduction
	is_motion = is_motion

	os.makedirs(output_dir, exist_ok=True)

	folders = [f for f in os.listdir(base_dir) if os.path.isdir(os.path.join(base_dir, f))]

	for folder in folders:
		input_folder = os.path.join(base_dir, folder)
		if is_motion:
			input_folder = os.path.join(input_folder, "png")
		if not os.path.exists(input_folder):
			print(f"Skipping {folder}: No 'png' subfolder found.")
			continue
		img_files = [f for f in os.listdir(input_folder) if f.lower().endswith(('.png', '.jpg'))]
		
		# Calculate sheet size and max frames
		sheet_size = calculate_sheet_size(frame_size)
		max_cols = sheet_size[0] // frame_size[0]
		max_rows = sheet_size[1] // frame_size[1]
		max_frames = max_cols * max_rows
		frame_count = min(len(img_files), max_frames)
		
		output_file = os.path.join(output_dir, f"{folder}_{frame_count}.png")

		print(f"Processing {folder}...")
		generate_sprite_sheet(
			folder_path=input_folder,
			output_filename=output_file,
			frame_size=frame_size,
			fps_reduction=fps_reduction
		)

if __name__ == "__main__":
	parser = argparse.ArgumentParser(description='Generate sprite sheets from image folders')
	parser.add_argument('--is_motion', type=bool, default=True, help='Whether to look for png subfolder (default: True)')
	parser.add_argument('--fps_reduction', type=int, default=1, help='FPS reduction factor (default: 1)')
	parser.add_argument('--frame_width', type=int, default=80, help='Frame width (default: 80)')
	parser.add_argument('--frame_height', type=int, default=80, help='Frame height (default: 80)')
	args = parser.parse_args()

	frame_size = (args.frame_width, args.frame_height)
	fps_reduction = args.fps_reduction
	is_motion = args.is_motion

	main(frame_size=frame_size, fps_reduction=fps_reduction, is_motion=is_motion)
