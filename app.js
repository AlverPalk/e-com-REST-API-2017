const createError = require('http-errors');
const express = require('express');
const path = require('path');
const logger = require('morgan');
const helmet = require('helmet');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const indexRouter = require('./routes/index');
const flash = require('connect-flash');
const config = require("./config/config");

const app = express();

mongoose.connect(config.db, {useNewUrlParser: true}).catch(err => createError('Database connection error'));

// view engine setup
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));


app.use(logger('dev'));
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'poBqeIxbZvF5HS2bJjMe',
  resave: false,
  saveUninitialized: false,
  store: new MongoStore({mongooseCollection: mongoose.connection, url: config.db}),
  cookie: {maxAge: 100 * 60 * 1000}
}));
app.use(flash());
app.use('/', indexRouter);

// 404
app.use((req, res) => {
  res.redirect('/');
});

module.exports = app;
