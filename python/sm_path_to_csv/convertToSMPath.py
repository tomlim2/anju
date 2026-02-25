import csv

filepath = 'to-csv/clothes.csv'
data = []
sm_path_name = "/Script/Engine.SkeletalMesh'/Game/Customizing/Character_New/Clothes_Re/Female/Outer/F_Jacket_001/Skinning/F_Jacket_001.F_Jacket_001'"
sm_path_sample = "/Script/Engine.SkeletalMesh'/Game/Customizing/Character_New/Clothes_Re/Character_Gender/Clothes_Type/Cloth_Name/Skinning/Cloth_Name.Cloth_Name'"
clipping_mask_path_sample = "/Script/Engine.Texture2D'/Game/Customizing/Character_New/Clothes_Re/Character_Gender/Clothes_Type/Cloth_Name/T_Cloth_Name_B.T_Cloth_Name_B'"
with open(filepath, 'r') as file:
    csv_reader = csv.reader(file)
    next(csv_reader)
    for row in csv_reader:
        gender_name = 'Female'
        if row[1] == 'M':
            gender_name = 'Male'
        path_name = sm_path_sample.replace("Character_Gender", gender_name).replace("Clothes_Type", row[2]).replace("Cloth_Name", row[0])
        clipping_mask_path = clipping_mask_path_sample.replace("Character_Gender", gender_name).replace("Clothes_Type", row[2]).replace("Cloth_Name", row[0])
        print(clipping_mask_path)
