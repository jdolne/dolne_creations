{{ config(materialized='table') }}

{% set payment_methods = dbt_utils.get_column_values(table=ref('raw_payments'), column='payment_method') %}
-- This is a way to dynamically get the distinct payment methods from the raw_payments 
-- table and use them in the pivoting logic. The only alternative is to hardcode 
-- the payment methods, which is not ideal because it requires manual updates whenever 
-- new payment methods are added. e.g.:  {% set payment_methods = ['credit_card', 'paypal', 'bank_transfer'] %}

with source_data as (
    select
        order_id
        {%- for method in payment_methods -%}
        sum(case when payment_method = '{{ method }}' then amount else 0 end) as {{ method }}_amount 
        {%- if not loop.last %} , {% endif -%} 
        {#I need to make sure that you know how to use loop last to ensure there is no comma after the 
        last payment method. The loop.last variable is a built-in variable in Jinja that returns true if the current 
        iteration is the last one. By using this condition, I can ensure that the comma is only added between payment 
        methods and not after the last one. #}
        {%- endfor -%}

        {# Notice how you have to make sure the variable x is in jinja brackets and within single quotes. 
        This is because you want the value of x to be used in the SQL statement, and it needs to be treated 
        as a string in the SQL context. Also, you can call the variable x in the alias of the sum 
        function to create dynamic column names based on the payment method. #}

    from {{ ref('raw_payments')}} as raw_payments
    GROUP BY order_id ASC
)

select * 
from source_data

