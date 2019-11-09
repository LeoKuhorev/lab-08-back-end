DROP TABLE IF EXISTS people;

CREATE TABLE people (
  id SERIAL PRIMARY KEY,
  first_name text,
  last_name text
);


-- In order to run the schema.sql on your local machine:
-- psql -d app_name -f schema.sql where app_name is your app
-- and on Heroku:
-- heroku pg:psql --app app_name < schema.sql where app_name is your app