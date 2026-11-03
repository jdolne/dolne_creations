# Document to Track Jinja Syntax

Jinja is just a templating engine. It is similar to python. The most basic ways you can use jinja are to:
- setting and interracting with variables
- using IF/Then Statements for condition logic
- using For Loops to iterate over variables and product some sort of repeated code
- printing variables out into your files.

## Syntax
{% %} - this indicates some operation is happening inside the jinja context. Invisible to the end user after the code is compiled. You can set a variable here.

{{ }} - indicate we are pulling something out of the jinja context and printing it in order to produce some type of written material. Is used for expressions. These will print text to the rendered file. In most cases in dbt, this will compile your Jinja to pure SQL.

{# #} - to turn anything into a comment this is what I do in jinja. It will not be evaluated when you get to target/compiled

## Examples
To see how to create an if statement go to: if_statement.sql
To see how to create a for loop go to: for_loops.sql
To see how to access a list, look at indexing_lists.sql
To see a for loop, if statement, and list in the same place look at loops_statements_lists.sql
To see how to work with dictionaries go to dictionary.sql

### Removing white space
You will notice that there is a lot of white space imbetween the outputs for For Loops. This is because jinja is still reading th another lines. To remove the other lines entirely, you need to add minus signs inside both sides of each line where you want to remoe the white space like {%-  -%}. There is an example line in loops_statements_lists.sql

## Applying Jinja in model
It is possible to turn case whens into jinja that is more efficient and stores possible future values. Look at the pivoting_table model to see how to iterate dynamically through an item to create a pivoted table.