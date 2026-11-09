
Select
    propertyId as property_id
    , listingId as listing_id
    , mlsId as mls_id
    , url as listing_url
    , dataSourceId as data_source_id
    , new_construction
    , propertyType as property_type
    , last_sale_date
    , beds
    , baths
    , price
    , square_footage
    , listing_date
    , year_built
    , lot_size
    , hoa_dues
    , fullBaths as full_baths
    , latitude
    , longitude
    , street_address
    , city
    , state as state_id
    , zip
    , possibly_the_apartment_number_if_multiple_units
    , partialBaths
    , servicePolicyId
from {{ source("dc_housing_project_raw_data", "raw_houses_for_sale")}}