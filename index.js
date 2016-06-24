var express = require('express');
var fs = require('fs');
var path = require('path');
var assert = require('assert');
var NitroPatternResolver = require('nitro-pattern-resolver');
var _ = require('lodash');

function getDependencyInformation(componentType, componentName, webpackStats) {
  if (!webpackStats) {
    return;
  }
  var componentPattern = /(components)[\\\/]([^\\\/]+)[\\\/]([^\\\/]+)/;
  var components = {};
  var modules = {};
  var moduleComponentMapping = {};
  var webpackModules = webpackStats.toJson().modules
    .filter((module) => module.name && componentPattern.test(module.name));

  webpackModules.forEach(function(module) {
    var componentPath = module.name.match(componentPattern);
    var moduleName = componentPath[2] + '/' + componentPath[3];
    moduleComponentMapping[module.id] = moduleName;
    components[moduleName] = {
      name: moduleName,
      componentType: componentPath[2],
      componentName: componentPath[3],
      dependents: {},
      dependencies: {}
    };
    modules[module.id] = {
      id: module.id,
      componentType: componentPath[2],
      componentName: componentPath[3],
    }
  });

  webpackModules.forEach((module) => module.reasons.forEach((reason) => {
    var moduleName = moduleComponentMapping[module.id];
    var reasonName = moduleComponentMapping[reason.moduleId];
    if (reasonName && reasonName !== moduleName && components[reasonName]) {
      components[reasonName].dependencies[moduleName] = components[moduleName];
      components[moduleName].dependents[reasonName] = components[reasonName];
    }
  }));

  webpackModules.forEach((module) => {
    var component = components[moduleComponentMapping[module.id]];
    component.dependencies = Object.values(component.dependencies);
    component.dependents = Object.values(component.dependents);
  });

  return components[componentType + '/' + componentName];
}

module.exports = function(config) {
  assert(config.root && fs.existsSync(config.root), `Please specify your component root folder e.g. { root: '/a/path'}`);
  assert(config.exampleTemplate, `Please specify your example templat e.g. { exampleTemplate: 'example.hbs' }`);
  assert(config.navigationTemplate, `Please specify your navigation templat e.g. { navigationTemplate: 'navigation.hbs' }`);
  var app = express();
  var nitroPatternResolver = config.nitroPatternResolver || new NitroPatternResolver({
    rootDirectory: config.root,
    examples: true
  });


  var webpackStats;
  if (config.webpackApp) {
    config.webpackApp.on('compilation-done', function(stats) {
      webpackStats = stats;
    });
  }

  function getExampleRenderData(componentType, componentName) {
    var depdencyInformation = getDependencyInformation(componentType, componentName, webpackStats);
    // Fallback if dependencies couldn't be read
    if (!dependencyInformation) {
      dependencyInformation = {
        dependencies: []
        dependents: []
      }
    }
    return nitroPatternResolver.getComponent(componentType + '/' + componentName)
      // Filter if only a specific example should be shown
      .then(function(component) {
        return nitroPatternResolver.getComponentExamples(component.directory)
          .then(function(examples) {
            return {
              examples: examples,
              component: component,
              componentDependencies: depdencyInformation.dependencies.map(function(dependency) {
                dependency.url = app.locals.baseHref + '/components/' + dependency.name;
                return dependency;
              }),
              componentDependents: depdencyInformation.dependents.map(function(dependent) {
                dependent.url = app.locals.baseHref + '/components/' + dependent.name;
                return dependent;
              })
            };
          });
        });
  }

  app.locals.baseHref = '';

  app.once('mount', () => app.locals.baseHref = app.mountpath.replace(/\/$/, ''));

  app.get('/', function(req, res, next) {
    nitroPatternResolver.getComponents()
      .then(function(patternFileInfo) {
        res.render(config.navigationTemplate, {
          patternFileInfo: _.sortBy(patternFileInfo, 'name')
        });
      })
      .catch(next);
  });

  app.get('/components', function(req, res, next) {
    nitroPatternResolver.getComponents()
      .then(function(patternFileInfo) {
        res.render(config.navigationTemplate, {
          patternFileInfo: _.sortBy(patternFileInfo, 'name')
        });
      })
      .catch(next);
  });

  app.get('/components/:componentType', function(req, res, next) {
    nitroPatternResolver.getComponents()
      .then(function(patternFileInfo) {
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
      .then((renderData) => res.render(config.exampleTemplate, renderData))
      .catch(next);
  });

  return app;
};