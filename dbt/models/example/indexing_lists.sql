{% set animals = ['dog', 'cat', 'mouse'] %} -- this is setting a list variable called animals to be a list of three strings

{# The exact same way you would access an element in a Python list #}
{{animals[0]}}

{# A for loop for your observation #}
{% for animal in animals %} 
    its working {{animal}}
{% endfor %}