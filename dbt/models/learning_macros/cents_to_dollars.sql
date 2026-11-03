{#
Let's pretend the column amount in the raw_payments tables is in cents not dollars.
This table used a macro to change this information from cents to dollars.
#}

{{ config (
    {
         "schema":"staging" 
    }
)}}
-- If you want the model to land in just staging and not dbt_jdolne_staging, you need to watch 
-- https://learn.getdbt.com/learn/course/jinja-macros-and-packages-vs-code/advanced-jinja-and-macros/advanced-jinja-and-macros?page=5
with payments as (
    SELECT *
    FROM {{ ref('raw_payments') }}
)

SELECT 
    id
    , order_id
    , payment_method
    , amount/100 as manually_converting_to_dollars
    , {{cents_to_dollars('amount')}} as using_macro_to_convert_to_dollars 
    {# I am surprised this needs to be in quotes. If I don't have 
    the quotes, the jinja parser will look for a variable named amount.#}
FROM payments