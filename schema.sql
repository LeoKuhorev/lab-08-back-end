DROP TABLE IF EXISTS locations;

CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  city TEXT,
  address TEXT,
  latitude DECIMAL,
  longitude DECIMAL
);