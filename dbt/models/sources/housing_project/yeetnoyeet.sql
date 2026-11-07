{{ config(alias = 'src_all_houses_for_sale')}}

Select *
from {{ source("dc_housing_project", "yeetnoyeet")}}