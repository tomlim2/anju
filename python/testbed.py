from Lib import __lib_topaz__ as topaz
import unreal 

temp = unreal.EditorUtilityLibrary.get_selected_assets()[0]

print(temp)

ctrl : unreal.AnimationDataController = temp.controller

print(ctrl)

frames= unreal.FrameNumber(300)
f_t0 = unreal.FrameNumber(3951)
f_t1 = unreal.FrameNumber(4251)



t1f = 131.69
t2f = 141.59
sub = t2f - t1f

ctrl.set_number_of_frames(sub,t1f, t2f)