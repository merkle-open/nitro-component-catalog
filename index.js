var express = require('express');
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var NitroPatternResolver = require('nitro-pattern-resolver');
var WebpackDependencyStats = require('webpack-dependency-stats');
var _ = require('lodash');
var PatternValidator = require('nitro-pattern-validator');

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
  assert(config.exampleTemplate, `Please specify your example templat e.g. { exampleTemplate: 'example.hbs' }`);
  assert(config.navigationTemplate, `Please specify your navigation templat e.g. { navigationTemplate: 'navigation.hbs' }`);

  var app = express();
  var nitroPatternValidator = config.nitroPatternValidator || new PatternValidator();
  var nitroPatternResolver = config.nitroPatternResolver || new NitroPatternResolver({
    rootDirectory: config.root,
    examples: true
  });

  // Optional - track webpack dependencies
  var webpackDependencyStats;
  if (config.webpack) {
    config.webpack.plugin('done', function(stats) {
      webpackDependencyStats = new WebpackDependencyStats(stats, {
        srcFolder: config.root
      });
    });
  }

  function getExampleRenderData(componentType, componentName) {
    var dependencyInformation = getDependencyInformation(componentType, componentName, webpackDependencyStats, app.locals.baseHref + '/components/');
    return nitroPatternResolver.getComponent(componentType + '/' + componentName)
      // Filter if only a specific example should be shown
      .then(function(component) {
        return nitroPatternResolver.getComponentExamples(component.directory)
          .then(function(examples) {
            return {
              examples: examples,
              component: component,
              componentDependencies: dependencyInformation.dependencies,
              componentDependents: dependencyInformation.dependents,
            };
          });
        });
  }

  app.locals.baseHref = '';

  app.once('mount', () => app.locals.baseHref = app.mountpath.replace(/\/$/, ''));

  app.get('/', function(req, res, next) {
    nitroPatternResolver.getComponents()
      .then(function(patternFileInfo) {
        nitroPatternValidator.validateComponents(patternFileInfo);
        res.render(config.navigationTemplate, {
          patternFileInfo: _.sortBy(patternFileInfo, 'name')
        });
      })
      .catch(next);
  });

  app.get('/components', function(req, res, next) {
    nitroPatternResolver.getComponents()
      .then(function(patternFileInfo) {
        nitroPatternValidator.validateComponents(patternFileInfo);
        res.render(config.navigationTemplate, {
          patternFileInfo: _.sortBy(patternFileInfo, 'name')
        });
      })
      .catch(next);
  });

  app.get('/components/:componentType', function(req, res, next) {
    nitroPatternResolver.getComponents()
      .then(function(patternFileInfo) {
        nitroPatternValidator.validateComponents(patternFileInfo);
        res.render(config.navigationTemplate, {
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
        nitroPatternValidator.validateComponent(renderData.component);
        res.render(config.exampleTemplate, renderData);
      })
      .catch(next);
  });

  return app;
};