{% set temperature = 80.0 %} -- this is setting a variable called temperature

Today is -- this is just text
{% if temperature > 70.0 %} -- start of the if statement
    a hot day because the temperature is {{ temperature }} degrees. 
    -- notice how you are actually calling the variable temperature here
{% else %}
    a cold day because the temperature is {{ temperature }} degrees.
{% endif %}