{% set foods = ['pizza', 'burger', 'pasta'] %}

{% for food in foods %}
    {% if food == 'pizza' %}
        {%- set foodtype = 'meal' -%}
    {% else %}
        {%- set foodtype = 'big snack' -%}
    {% endif %}
    The {{ food }} is a {{ foodtype }}.
{% endfor %}