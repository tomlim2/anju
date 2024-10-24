import unreal

cameras: list[unreal.CameraActor]
sorted_cameras = sorted(cameras, key=lambda camera: (
    int(camera.get_actor_label().lower().partition('photospot')[2].partition('_')[0] or
        camera.get_actor_label().lower().partition('samplespot')[2].partition('_')[0] or 0),
    int(camera.get_actor_label().partition('_')[2] or 0) if '_' in camera.get_actor_label() else 0
))


