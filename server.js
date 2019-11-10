'use strict';

// Load Environment veriable from the .env
require('dotenv').config();

// Declare Application Dependencies
const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const path = require('path');

//Database connection
const pg = require('pg');
const client = new pg.Client(process.env.DATABASE_URL);

// Application setup
const PORT = process.env.PORT || 3000;
const app = express();
app.use(cors());

// let locations = {};

// API routes
// Serve static folder
app.use(express.static(path.join(__dirname, 'public')));

// Specifing the routes
app.get('/location', locationHandler);
app.get('/weather', weatherHandler);
app.get('/trails', trailHandler);
app.get('/events', eventsHandler);
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

//Event constructor
function Event(object) {
  this.link = object.url;
  this.name = object.name.text;
  this.event_date = object.start.local.slice(0, 10);
  this.summary = object.summary;
}

//Trail constructor
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

//Check locations
function checkLocations(city) {
  let location = {};
  let SQL = `SELECT address, latitude, longitude FROM locations WHERE city = '${city}'`;
  return client.query(SQL)
    .then(result => {
      location = result.rows[0];
      console.log('loc address', location.address);
      return location.address ? true : false;
    })
    .catch(err => console.log(err));
}
function saveLocations(object) {
  let SQL = 'INSERT INTO locations (city, address, latitude, longitude) VALUES ($1, $2, $3, $4) RETURNING *';
  let safeValues = [object.search_query, object.formatted_query, object.latitude, object.longitude];
  client.query(SQL, safeValues)
    .then(result => console.log(result.rows));
}

// Event Handlers
function locationHandler(req, res) {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${req.query.data}&key=${process.env.GEOCODE_API_KEY}`;
    if (false) {
      console.log('grabbing from cache');
      console.log(url);
      res.status(200).send(locations[url]);
    } else {
      superagent.get(url)
        .then(data => {
          const city = req.query.data;
          checkLocations(city)
            .then((data) => {
              if (data) {
                console.log('data!');
              }
              const geoData = data.body;
              const locationData = new Location(city, geoData);
              saveLocations(locationData);
              console.log('grabbing from API');
              res.status(200).send(locationData);

            });
        });
    }
  }
  catch (error) {
    // Some function or error message
    errorHandler('Sorry, something went wrong', req, res);
  }
}

function weatherHandler(req, res) {
  try {
    const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${req.query.data.latitude},${req.query.data.longitude}`;
    superagent.get(url)
      .then(data => {
        const weatherData = data.body;
        const forecasts = weatherData.daily.data.map(element => new Weather(element));
        res.status(200).send(forecasts);
      });
  }
  catch (error) {
    errorHandler('Sorry, something went wrong', req, res);
  }
}

function trailHandler(req, res) {
  try {
    const url = `https://www.hikingproject.com/data/get-trails?lat=${req.query.data.latitude}4&lon=${req.query.data.longitude}&key=${process.env.TRAIL_API_KEY}`;
    superagent.get(url)
      .then(data => {
        const trailBody = data.body;
        const trailData = trailBody.trails.map(element => new Trail(element));
        res.status(200).send(trailData);
      });
  }
  catch (error) {
    errorHandler('Sorry, something went wrong', req, res);
  }
}

function eventsHandler(req, res) {
  try {
    const url = `https://www.eventbriteapi.com/v3/events/search/?location.longitude=${req.query.data.longitude}&location.latitude=${req.query.data.latitude}&expand=venue&token=${process.env.EVENTBRITE_API_KEY}`;
    superagent.get(url)
      .then(data => {
        const eventsData = data.body;
        const events = eventsData.events.map(element => new Event(element));
        res.status(200).send(events);
      });
  }
  catch (error) {
    errorHandler('Sorry, something went wrong', req, res);
  }
}

function errorHandler(error, req, res) {
  res.status(500).send(error);
}


// Ensure that the server is listening for requests
// THIS MUST BE AT THE BOTTOM OF THE FILE
client.connect()
  .then(() => {
    app.listen(PORT, () => console.log(`The server is up listening on ${PORT}`));
  })
  .catch(error => console.log('cannot connect to database', error));

