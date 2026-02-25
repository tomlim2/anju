package_name:str

display_name: str

display_name = package_name.split('/')[len(package_name.split('/'))-1].split('.')[0]