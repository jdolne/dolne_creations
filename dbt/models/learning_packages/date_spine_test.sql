
{{ dbt_utils.date_spine(
datepart="day",
start_date="cast('2019-01-01' as date)",
end_date="cast('2020-01-01' as date)"
)
}} 

{# 
This is just a dbt_utils macros that I am using to generate a dates table. It could definitely come in handy if I 
want to maintain all my work in dbt syntax rather than using bigquery to do this type of work.

Very small example of a package attribute. I know I have used dbt_utils in the past to make this work work before so wahooo.
 #}