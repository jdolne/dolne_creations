WITH dog_cte AS (
  SELECT *
  FROM table as dog
  WHERE dog.name = 'Fido'
)

SELECT *
FROM DOG_CTE
where dog_cte.age > 5

