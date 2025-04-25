import unreal

# Facial
datatable: unreal.DataTable = unreal.EditorUtilityLibrary.get_selected_assets()[0]

dt_library = unreal.DataTableFunctionLibrary
row_names = dt_library.get_data_table_row_names(datatable)

for row_name in row_names:
    row_data = unreal.DataTableRowHandle(datatable, row_name)
    print(row_data)