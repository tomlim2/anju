import unreal

cameras: list[unreal.CameraActor]
sorted_cameras = sorted(cameras, key=lambda camera: (int( camera.get_actor_label().lower().partition('photospot')[2].partition('_')[0]), int( camera.get_actor_label().partition('_')[2]) if '_' in  camera.get_actor_label() else 0))

# sorted_cameras = sorted(cameras, key=lambda camera: camera.get_actor_label())

# testArray = ['Photospot1', 'Photospot10_1', 'Photospot10_2','Photospot10_3', 'Photospot2', 'Photospot3', 'Photospot4', 'Photospot5', 'Photospot6', 'Photospot7', 'Photospot8', 'Photospot9']

# sortedArray = sorted(testArray, key=lambda x: (int(x.partition('Photospot')[2].partition('_')[0]), int(x.partition('_')[2]) if '_' in x else 0))
# print(sortedArray)


# sorted(testArray, key=lambda camera: (int( camera.get_actor_label().partition('Photospot')[2].partition('_')[0]), int( camera.get_actor_label().partition('_')[2]) if '_' in  camera.get_actor_label() else 0))