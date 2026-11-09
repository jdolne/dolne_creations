import config
import requests
import pandas as pd

import endpoints.column_processing as column_processing

def all_houses_for_sale_function():

    # Variables necessary for pagination and dataframe creation.
    endpoint_specific_url = config.REALTY_API_BASE_URL + "/bylocation"
    page_variable = 1
    pagination = True
    creating_dataframe = []

    while pagination:
    
        params = {
            "locationName": "Washington",
            "locationSubName": "DC",
            "resultCount":1000,
            "page":page_variable
        }

        headers = {
            "x-realtyapi-key": config.REALTY_API_KEY
        }

        response = requests.get(endpoint_specific_url, headers=headers, params=params)
        response_json_value = response.json()

        for element in response_json_value['searchResults']:
            creating_dataframe.append(element['homeData'])

        page_variable += 1
        pagination = response_json_value["nextPage"]
        # pd.set_option('display.max_columns', None)
        # pd.set_option('display.max_rows', None)
    
    df = pd.DataFrame(creating_dataframe)
    return df

def processing_data(created_dataframe):
    for position in created_dataframe.index:
    # I SHOULD ADD SOME LANGUAGE TO MAKE SURE SOME COLUMNS EXIST
    # I think I could make this better by creating an object that was a the specific row (series) I want to transform. 
    # I would iterate through this series rather than calling the position every single time as I am doing now.
    # After transofrming the series I would add it to a new dataframe.

        created_dataframe.loc[position,"new_construction"] = created_dataframe.loc[position,"listingMetadata"].get("isNewConstruction",False)
        # amount
        created_dataframe.loc[position,"price"] = created_dataframe.loc[position,"priceInfo"].get("amount") # turn this into an integer
        # square_footage
        created_dataframe.loc[position,"square_footage"] = created_dataframe.loc[position,"sqftInfo"].get("amount") # turn this into an integer
        # listing_date
        created_dataframe.loc[position,"listing_date"] = created_dataframe.loc[position,"daysOnMarket"].get("listingAddedDate")
        # year_built
        created_dataframe.loc[position,"year_built"] = created_dataframe.loc[position,"yearBuilt"].get("yearBuilt")
        # lot_size
        created_dataframe.loc[position,"lot_size"] = created_dataframe.loc[position,"lotSize"].get("amount")
        # hoa_dues
        created_dataframe.loc[position,"hoa_dues"] = created_dataframe.loc[position,"hoaDues"].get("amount")
        # last_sale_date
        created_dataframe.loc[position,"last_sale_date"] = column_processing.last_sale_data_processing(created_dataframe.loc[position,"lastSaleData"])
        # latitude
        created_dataframe.loc[position,"latitude"] = created_dataframe.loc[position,"addressInfo"].get("centroid").get("centroid").get("latitude")
        # longitude
        created_dataframe.loc[position,"longitude"] = created_dataframe.loc[position,"addressInfo"].get("centroid").get("centroid").get("longitude")
        # street_address
        created_dataframe.loc[position,"street_address"] = created_dataframe.loc[position,"addressInfo"].get("formattedStreetLine")
        # city
        created_dataframe.loc[position,"city"] = created_dataframe.loc[position,"addressInfo"].get("city")
        # state
        created_dataframe.loc[position,"state"] = created_dataframe.loc[position,"addressInfo"].get("state")
        # zip
        created_dataframe.loc[position,"zip"] = created_dataframe.loc[position,"addressInfo"].get("zip")
        # unitNumberDisplayLevel
        created_dataframe.loc[position,"possibly_the_apartment_number_if_multiple_units"] = created_dataframe.loc[position,"addressInfo"].get("unitNumberDisplayLevel")
        # zip
        created_dataframe.loc[position,"zip"] = created_dataframe.loc[position,"addressInfo"].get("zip")

    # Columns I didn't use but maybe should: brokers ,bathInfo -- to find more information on the bathrooms ,photoUrls
    
    processed_dataframe = created_dataframe[["propertyId", "listingId", "mlsId", "url", "dataSourceId", "new_construction", "propertyType", "last_sale_date", "beds", "baths", "price", "square_footage", "listing_date", "year_built", "lot_size", "hoa_dues", "fullBaths", "latitude", "longitude", "street_address", "city", "state", "zip", "possibly_the_apartment_number_if_multiple_units", "partialBaths", "servicePolicyId"]]

    return processed_dataframe.drop_duplicates()


