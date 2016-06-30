var express = require('express');
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var NitroComponentResolver = require('@namics/nitro-component-resolver');
var NitroComponentValidator = require('@namics/nitro-component-validator');
var WebpackDependencyStats = require('webpack-dependency-stats');
var _ = require('lodash');
var readmeRenderer = require('./lib/readme-renderer.js');
var exampleRenderer = require('./lib/example-renderer.js');

/**
 * Extracts all dependencies and dependents for the given compmonent from the webpack stats object
 */
function getDependencyInformation(componentType, componentName, webpackDependencyStats, baseHref) {
  var result = {dependencies: [], dependents: []};
  // In case the proejct does not use webpack
  // or the first webpack build wasn't completed return an empty result
  if (!webpackDependencyStats) {
    return result;
  }
  // Turn the componentType and componentName into the webpack module identifier format
  var componentEntryPoint = './' + componentType + '/' + componentName + '/js/' + componentName + '.';
  // Search for matching webpack modules
  var moduleName = (Object.keys(webpackDependencyStats.filteredModules.byName).filter(function(name) {
    return name.indexOf(componentEntryPoint) === 0;
  })).filter(function(name) {
    return /[/][^/]+\.(js|ts)$/.test(name);
  })[0];
  // Skip if no matching webpack module for the componentType and name was found
  if (!moduleName) {
    return result;
  }
  var componentPath = componentType + '/' + componentName;
  // strip 'js/moduleName.ts' and 'css/modulename.scss'
  result.dependencies = _.sortedUniq(
      webpackDependencyStats.getDependencies(moduleName)
        // turn './atoms/moduleName/js/moduleName.ts' into 'atoms/moduleName'
        .map((dependencyName) => dependencyName.split('/').slice(1,3).join('/'))
      )
      // remove self references
      .filter((dependencyPath) => componentPath !== dependencyPath)
      // add link
      .map((dependencyPath) => ({
        name: dependencyPath,
        url: baseHref + dependencyPath
      }));
  result.dependents = _.sortedUniq(
      webpackDependencyStats.getDependents(moduleName)
        // turn './atoms/moduleName/js/moduleName.ts' into 'atoms/moduleName'
        .map((dependentName) => dependentName.split('/').slice(1,3).join('/'))
      )
      // remove self references
      .filter((dependentPath) => componentPath !== dependentPath)
      // add link
      .map((dependentPath) => ({
        name: dependentPath,
        url: baseHref + dependentPath
      }));
  return result;
}

module.exports = function(config) {
  assert(config.root && fs.existsSync(config.root), `Please specify your component root folder e.g. { root: '/a/path'}`);
  assert(config.componentView, `Please specify your component view e.g. { componentView: 'component.hbs' }`);
  assert(config.exampleView, `Please specify your example view e.g. { exampleView: 'example.hbs' }`);
  assert(config.examplePartial, `Please specify your example partial e.g. { examplePartial: 'partials/example.hbs' }`);
  assert(config.navigationView, `Please specify your navigation view e.g. { navigationView: 'navigation.hbs' }`);

  var app = express();
  var nitroComponentValidator = config.nitroComponentValidator || new NitroComponentValidator();
  var nitroPatternResolver = config.nitroPatternResolver || new NitroComponentResolver({
    rootDirectory: config.root,
    examples: true,
    readme: true,
    readmeRenderer: (resolver, renderData) => readmeRenderer(resolver, renderData),
    exampleRenderer: (resolver, renderData) => exampleRenderer(resolver, renderData, app, config.examplePartial, app.locals.baseHref + '/components/')
  });
  // Optional - track webpack dependencies
  var webpackDependencyStats;
  if (config.webpack) {
    Promise.resolve(config.webpack).then((compiler) => {
      compiler.plugin('done', function(stats) {
        webpackDependencyStats = new WebpackDependencyStats(stats, {
          srcFolder: config.root
        });
      });
    });
  }

  function getExampleRenderData(componentType, componentName, exampleName) {
    var dependencyInformation = getDependencyInformation(componentType, componentName, webpackDependencyStats, app.locals.baseHref + '/components/');
    return nitroPatternResolver.getComponent(componentType + '/' + componentName)
      .then(function(component) {
        return nitroPatternResolver.getComponentExamples(component.directory)
          .then(function(examples) {
            // Filter if only a specific example should be shown
            if (exampleName) {
              examples = examples.filter((example) => example.name === exampleName);
            }
            return nitroPatternResolver.getComponentReadme(component.directory)
              .then(function(readme) {
                return {
                  examples: examples,
                  component: component,
                  componentDependencies: dependencyInformation.dependencies,
                  componentDependents: dependencyInformation.dependents,
                  readme: readme
                };
            });
          });
        });
  }

  app.locals.baseHref = '';

  app.once('mount', () => app.locals.baseHref = app.mountpath.replace(/\/$/, ''));

  app.get('/', function(req, res, next) {
    nitroPatternResolver.getComponents()
      .then(function(patternFileInfo) {
        nitroComponentValidator.validateComponents(patternFileInfo);
        res.render(config.navigationView, {
          patternFileInfo: _.sortBy(patternFileInfo, 'name')
        });
      })
      .catch(next);
  });

  app.get('/components', function(req, res, next) {
    nitroPatternResolver.getComponents()
      .then(function(patternFileInfo) {
        nitroComponentValidator.validateComponents(patternFileInfo);
        res.render(config.navigationView, {
          patternFileInfo: _.sortBy(patternFileInfo, 'name')
        });
      })
      .catch(next);
  });

  app.get('/components/:componentType', function(req, res, next) {
    nitroPatternResolver.getComponents()
      .then(function(patternFileInfo) {
        nitroComponentValidator.validateComponents(patternFileInfo);
        res.render(config.navigationView, {
          patternFileInfo: _.sortBy(_.filter(patternFileInfo, function(pattern) {
            return pattern.type === req.params.componentType;
          }), 'name')
        });
      })
      .catch(next);
  });

  app.get('/components/:componentType/:componentName', function(req, res, next) {
    getExampleRenderData(req.params.componentType, req.params.componentName)
      .then((renderData) => {
        nitroComponentValidator.validateComponent(renderData.component);
        res.render(config.componentView, renderData);
      })
      .catch(next);
  });

  app.get('/components/:componentType/:componentName/:exampleName', function(req, res, next) {
    getExampleRenderData(req.params.componentType, req.params.componentName, req.params.exampleName)
      .then((renderData) => {
        renderData.example = renderData.examples[0];
        nitroComponentValidator.validateComponent(renderData.component);
        res.render(config.exampleView, renderData);
      })
      .catch(next);
  });

  return app;
};