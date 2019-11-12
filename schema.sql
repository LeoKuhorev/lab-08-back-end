DROP TABLE IF EXISTS locations, weather;

CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  search_query TEXT,
  formatted_query TEXT,
  latitude DECIMAL,
  longitude DECIMAL
);

CREATE TABLE weather (
  id SERIAL PRIMARY KEY,
  forecast TEXT,
  time TEXT,
  time_saved BIGINT,
  location_id INTEGER NOT NULL,
  FOREIGN KEY (location_id) REFERENCES locations(id)
)
