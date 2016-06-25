# Nitro Pattern Navigator Plugin

This plugin allows you to navigate and preview all your components.

## Installation

```bash
npm i --save-dev nitro-pattern-navigator
```

## Adding it to nitro

Place the following configuration file to your `projects/routes/pattern-navigatior.js`

**pattern-navigatior.js**
```js
var nitroPatternNavigation = require('nitro-pattern-navigator');
var path = require('path');
var express = require('express');
// Frontify demos
module.exports = function(app) {

  app.use('/', nitroPatternNavigation({
  	root: path.resolve(__dirname, '../../components'),
    // The example view 'example' resolves to views/example.hbs
  	exampleTemplate: 'example',
    // The navigation view 'navigation' resolves to views/navigation.hbs
  	navigationTemplate: 'navigation',
    // Optional if you are using the webpack you might pass the compiler instance:
  	webpackApp: require('./webpack').webpackMiddleware
  }));

};
```