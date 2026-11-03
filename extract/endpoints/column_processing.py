import pandas as pd

def last_sale_data_processing(cell_data):
    if pd.isna(cell_data):
        return cell_data
    else:
        return cell_data.get('lastSoldDate')
