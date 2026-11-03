-- The below is a Jinja/SQL template loop.
-- It will generate ten SELECT statements by iterating x from 0 to 9.
{% for x in range(10) %}
select {{ x }} as number {% if not loop.last %} union all {% endif %} 
    -- loop.last is important becuase it prevents the last for loop from having a union all at the end.
{% endfor %}
