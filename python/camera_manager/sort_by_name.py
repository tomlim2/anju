import unreal

cameras: list[unreal.CameraActor]

sorted_cameras = sorted(cameras, key=lambda camera: camera.get_actor_label())

print('Sorted Cameras:', sorted_cameras)