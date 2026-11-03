{#
Let's pretend the column amount in the raw_payments tables is in cents not dollars.

To create a macro you need:
- the begin macro statement
- variables that you want to call inside the macro... sometimes with default values
- the actual code the macro is doing
- the end macro statement
#}

{%- macro cents_to_dollars(amount, decimals = 2) -%}

 round({{amount}} * 1.0 / 100, {{decimals}} )  {# I was surprised that I still need to put squiggly brackets there. #}

{%- endmacro -%}