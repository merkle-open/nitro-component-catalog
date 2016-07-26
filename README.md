# Nitro Component Catalog Plugin

[![npm version](https://badge.fury.io/js/%40namics%2Fnitro-component-catalog.svg)](https://badge.fury.io/js/%40namics%2Fnitro-component-catalog)
[![Build Status](https://travis-ci.org/namics/nitro-component-catalog.svg?branch=master)](https://travis-ci.org/namics/nitro-component-catalog)
[![Coverage Status](https://coveralls.io/repos/github/namics/nitro-component-catalog/badge.svg?branch=master)](https://coveralls.io/github/namics/nnitro-component-catalog?branch=master)

This plugin allows you to navigate and preview all your components.

## Example preview

![Component view](https://raw.githubusercontent.com/namics/nitro-component-catalog/master/preview.png)

## Installation

```bash
npm i --save-dev nitro-component-catalog
```

## Integration into nitro

Place the following configuration file to your `projects/routes/pattern-catalog.js`

**component-catalog.js**
```js
var nitroPatternNavigation = require('@namics/nitro-component-catalog');
var path = require('path');
// Frontify demos
module.exports = function(app) {

  app.use('/', nitroComponentCatalog({
    // The location of your component source files
    root: path.resolve(__dirname, '../../components'),

    // The component preview view - 'preview' resolves to  views/component.hbs
    componentView: 'component',

    // The example view - 'example' resolves to views/example.hbs
    exampleView: 'example',
    
    // The example partial - '_partials/example' resolves to views/_partials/example.hbs
    examplePartial: '_partials/example',

    // The navigation view - 'navigation' resolves to views/navigation.hbs
    navigationView: 'navigation',
    
    // Optional - additional view data
    viewData: app.locals,

    // Optional if you are using webpack you might pass the compiler instance
    // This will NOT handle your webpack compilation but only visualise the dependencies
    webpackApp: webpack(webpackConfig),

    // Optional - if your project needs specific resolver settings you can pass
    // a custom resolver instance
    nitroComponentResolver: new NitroComponentResolver(/* ... */),

    // Optional - if your project needs additional validations on the pattern.json
    // you can pass a custom validator instance
    nitroComponentValidator: new NitroComponentValidator(/* ... */),
  }));

};
```
