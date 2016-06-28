# Nitro Component Catalog Plugin

This plugin allows you to navigate and preview all your components.

## Installation

```bash
npm i --save-dev nitro-pattern-navigator
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

    // The navigation view - 'navigation' resolves to views/navigation.hbs
  	navigationView: 'navigation',

    // Optional if you are using the webpack you might pass the compiler instance
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