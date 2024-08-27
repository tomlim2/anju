string:str = "a8406d86e22af06dd6a9dfdebda0a33cd9c69672 e2c8a21cdc30d16446ef668c7930c79e180c3a76 8cf296df600118dd948b867cb588079d9382a077 b20caa372eecbaeee28cdcbf033f5c43e58d5829 4fe13dc08f599877b4719070a556a183a54dd4f5 6d98747b9bfed6fe86af350e162bcfe927888934 daa02671d879c220e018862f0313a1c37bc8a742 d98bb3ef09a5734c76e63585ac36a05cf3347f80 70842726a0fe2fe7035ea385001616bba50f528a 9e56be99ba6b413f0cafdaea3814aa8a6317df28"

array:list[str] = []

array = string.split(" ")

array.reverse()

trimed = (" ").join(array)
print("git cherry-pick -X theirs " + trimed)
