'use strict';

// Load Environment veriable from the .env
require('dotenv').config();

// Declare Application Dependencies
const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const path = require('path');

// Database connection
const pg = require('pg');
const client = new pg.Client(process.env.DATABASE_URL);

// Application setup
const PORT = process.env.PORT || 3000;
const app = express();
app.use(cors());

// API routes
// Serving static folder
app.use(express.static(path.join(__dirname, 'public')));

// Specifying the routes
app.get('/location', locationHandler);
app.get('/weather', weatherHandler);
app.get('/trails', trailHandler);
app.get('/events', eventsHandler);
app.get('/db', dbHandler);
app.get('*', (req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Helper functions
// Location constructor
function Location(city, geoData) {
  this.search_query = city;
  this.formatted_query = geoData.results[0].formatted_address;
  this.latitude = geoData.results[0].geometry.location.lat;
  this.longitude = geoData.results[0].geometry.location.lng;
}

// Weather constructor
function Weather(day) {
  this.forecast = day.summary;
  this.time = new Date(day.time * 1000).toString().slice(0, 15);
}

// Event constructor
function Event(object) {
  this.link = object.url;
  this.name = object.name.text;
  this.event_date = object.start.local.slice(0, 10);
  this.summary = object.summary;
}

// Trail constructor
function Trail(object) {
  this.name = object.name;
  this.location = object.location;
  this.length = object.length;
  this.stars = object.stars;
  this.star_votes = object.starVotes;
  this.summary = object.summary;
  this.trail_url = object.url;
  this.conditions = object.conditionStatus;
  this.condition_date = object.conditionDate.slice(0, 10);
  this.condition_time = object.conditionDate.slice(11);
}


async function checkDB(SQL, city, minutesToExpire) {
  try {
    const query = await client.query(SQL, [city]);
    if(query.rowCount) {
      console.log(`${city} found in database`);
      if(minutesToExpire) {
        var timeDifference = (Date.now() - query.rows[0].time_saved) / 60000;
        console.log(`The result for ${city} was saved ${timeDifference.toFixed(2)} minutes ago`);
      }
      if(!minutesToExpire || timeDifference < minutesToExpire) {
        console.table(query.rows);
        return query.rows;
      }
    }
  } catch (error) {
    console.log('Sorry, something went wrong', error);
  }
}

// Getting location from database
async function checkLocation(city, res) {
  const SQL = 'SELECT * FROM locations WHERE search_query = $1';
  try {
    const location = await checkDB(SQL, city);
    if(location) {
      res.status(200).send(location[0]);
      return true;
    }
  } catch (error) {
    console.log('Sorry, something went wrong', error);
  }
}

async function checkWeather(city, res) {
  const SQL = 'SELECT forecast, time, time_saved FROM weather JOIN locations ON weather.location_id = locations.id WHERE locations.search_query = $1';
  try {
    const weather = await checkDB(SQL, city, 60);
    if(weather) {
      res.status(200).send(weather);
      return true;
    }
  } catch (error) {
    console.log('Sorry, something went wrong', error);
  }
}

// Saving location into database
async function saveLocations(object) {
  let SQL = 'INSERT INTO locations (search_query, formatted_query, latitude, longitude) VALUES ($1, $2, $3, $4) RETURNING id';
  let safeValues = [object.search_query, object.formatted_query, object.latitude, object.longitude];
  try {
    await client.query(SQL, safeValues);
    console.log(`Location ${object.search_query} saved into database`);
    console.table(object);
  } catch (error) {
    console.log('Sorry, something went wrong', error);
  }
}

async function saveWeather(forecast, city) {
  let SQL = 'INSERT INTO weather (forecast, time, time_saved, location_id) VALUES ($1, $2, $3, (SELECT id FROM locations WHERE search_query LIKE $4))';
  let timeSaved = Date.now();
  let safeValues = [forecast.forecast, forecast.time, timeSaved, city];
  try {
    await client.query(SQL, safeValues);
    console.log('Saving weather for', city);
  } catch (error) {
    console.log('Weather couldn\'t be saved', error);
  }
}

async function clearWeather(city) {
  console.log('deleteing rows for ', city);
  let SQL = 'DELETE FROM weather WHERE location_id = (SELECT id FROM locations WHERE search_query LIKE $1)';
  await client.query(SQL, [city]);
}

// Fetch any API data
async function fetchAPI(url) {
  try {
    const apiData = await superagent.get(url);
    return apiData.body;
  } catch (error) {
    console.log('API call couldn\'t be completed', error);
  }
}

// Event Handlers
async function locationHandler(req, res) {
  const city = req.query.data;
  try {
    let cacheFound = await checkLocation(city, res);
    if(!cacheFound) {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${city}&key=${process.env.GEOCODE_API_KEY}`;
      const geoData = await fetchAPI(url);
      const location = new Location(city, geoData);
      saveLocations(location);
      res.status(200).send(location);
    }
  } catch (error) {
    errorHandler('Sorry, something went wrong', req, res);
  }
}

async function weatherHandler(req, res) {
  try {
    let weatherFound = await checkWeather(req.query.data.search_query, res);
    if(!weatherFound) {
      const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${req.query.data.latitude},${req.query.data.longitude}`;
      const weatherData = await fetchAPI(url);
      await clearWeather(req.query.data.search_query);
      const forecasts = weatherData.daily.data.map(element => new Weather(element));
      forecasts.forEach(forecast => saveWeather(forecast, req.query.data.search_query));
      res.status(200).send(forecasts);
    }
  } catch (error) {
    errorHandler('Sorry, something went wrong', req, res);
  }
}

async function trailHandler(req, res) {
  try {
    const url = `https://www.hikingproject.com/data/get-trails?lat=${req.query.data.latitude}&lon=${req.query.data.longitude}&key=${process.env.TRAIL_API_KEY}`;
    const trailBody = await fetchAPI(url);
    const trailData = trailBody.trails.map(element => new Trail(element));
    res.status(200).send(trailData);
  }
  catch (error) {
    errorHandler('Sorry, something went wrong', req, res);
  }
}

async function eventsHandler(req, res) {
  try {
    const url = `https://www.eventbriteapi.com/v3/events/search/?location.longitude=${req.query.data.longitude}&location.latitude=${req.query.data.latitude}&expand=venue&token=${process.env.EVENTBRITE_API_KEY}`;
    const eventsData = await fetchAPI(url);
    const events = eventsData.events.map(element => new Event(element));
    res.status(200).send(events);
  }
  catch (error) {
    errorHandler('Sorry, something went wrong', req, res);
  }
}

function dbHandler(req, res) {
  let SQL = 'SELECT * FROM locations';
  client.query(SQL)
    .then( results => {
      res.status(200).json(results.rows);
    });
}

function errorHandler(error, req, res) {
  res.status(500).send(error);
}

// Ensure that the server is listening for requests
client.connect()
  .then(() => {
    app.listen(PORT, () => console.log(`The server is up listening on ${PORT}`));
  })
  .catch(error => console.log('cannot connect to database', error));
