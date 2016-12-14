'use strict';

/* eslint-disable require-jsdoc, valid-jsdoc, max-len, quotes, prefer-template, no-return-assign */

const express = require('express');
const fs = require('fs');
const assert = require('assert');
const NitroComponentResolver = require('@namics/nitro-component-resolver');
const NitroComponentValidator = require('@namics/nitro-component-validator');
const WebpackDependencyStats = require('webpack-dependency-stats');
const _ = require('lodash');
const readmeRenderer = require('./lib/readme-renderer.js');
const exampleRenderer = require('./lib/example-renderer.js');

/**
 * Extracts all dependencies and dependents for the given compmonent from the webpack stats object
 */
function getDependencyInformation(componentType, componentName, webpackDependencyStats, baseHref) {
	const result = { dependencies: [], dependents: [] };
	// In case the proejct does not use webpack
	// or the first webpack build wasn't completed return an empty result
	if (!webpackDependencyStats) {
		return result;
	}
	// Turn the componentType and componentName into the webpack module identifier format
	const componentEntryPoint = `./${componentType}/${componentName}/js/${componentName}.`;
	// Search for matching webpack modules
	const moduleName = (Object.keys(webpackDependencyStats.filteredModules.byName).filter((name) => {
		return name.indexOf(componentEntryPoint) === 0;
	})).filter((name) => {
		return (/[/][^/]+\.(js|ts)$/).test(name);
	})[0];
	// Skip if no matching webpack module for the componentType and name was found
	if (!moduleName) {
		return result;
	}
	const componentPath = `${componentType}/${componentName}`;
	// strip 'js/moduleName.ts' and 'css/modulename.scss'
	result.dependencies = _.sortedUniq(
		webpackDependencyStats.getDependencies(moduleName)
		// turn './atoms/moduleName/js/moduleName.ts' into 'atoms/moduleName'
			.map((dependencyName) => dependencyName.split('/').slice(1, 3).join('/'))
	)
	// remove self references
		.filter((dependencyPath) => componentPath !== dependencyPath)
		// add link
		.map((dependencyPath) => ({
			name: dependencyPath,
			url: baseHref + dependencyPath,
		}));
	result.dependents = _.sortedUniq(
		webpackDependencyStats.getDependents(moduleName)
		// turn './atoms/moduleName/js/moduleName.ts' into 'atoms/moduleName'
			.map((dependentName) => dependentName.split('/').slice(1, 3).join('/'))
	)
	// remove self references
		.filter((dependentPath) => componentPath !== dependentPath)
		// add link
		.map((dependentPath) => ({
			name: dependentPath,
			url: baseHref + dependentPath,
		}));
	return result;
}

module.exports = function (config) {
	assert(config.root && fs.existsSync(config.root), `Please specify your component root folder e.g. { root: '/a/path'}`);
	assert(config.componentView, `Please specify your component view e.g. { componentView: 'component.hbs' }`);
	assert(config.exampleView, `Please specify your example view e.g. { exampleView: 'example.hbs' }`);
	assert(config.exampleCodeView, `Please specify your example code view e.g. { exampleCodeView: 'code.hbs' }`);
	assert(config.examplePartial, `Please specify your example partial e.g. { examplePartial: 'partials/example.hbs' }`);
	assert(config.navigationView, `Please specify your navigation view e.g. { navigationView: 'navigation.hbs' }`);
	config.pageTitle = config.pageTitle || 'Pattern';

	const app = express();
	let baseHref = '';
	const nitroComponentValidator = config.nitroComponentValidator || new NitroComponentValidator();
	const nitroComponentResolver = config.nitroComponentResolver || new NitroComponentResolver({
		rootDirectory: config.root,
		examples: true,
		cacheExamples: config.cacheExamples,
		readme: true,
		readmeRenderer: (resolver, renderData) => readmeRenderer(resolver, renderData),
		exampleRenderer: (resolver, renderData) => exampleRenderer(resolver, renderData, app, config.examplePartial, baseHref + '/components/'),
	});
	// Optional - track webpack dependencies
	let webpackDependencyStats;
	if (config.webpack) {
		Promise.resolve(config.webpack).then((compiler) => {
			compiler.plugin('done', (stats) => {
				webpackDependencyStats = new WebpackDependencyStats(stats, {
					srcFolder: config.root,
				});
			});
		});
	}

	function getExampleRenderData(componentType, componentName, exampleName) {
		const dependencyInformation = getDependencyInformation(componentType, componentName, webpackDependencyStats, baseHref + '/components/');
		return nitroComponentResolver.getComponent(componentType + '/' + componentName)
			.then((component) => {
				return nitroComponentResolver.getComponentExamples(component.directory)
					.then((examples) => {
						// Filter if only a specific example should be shown
						if (exampleName) {
							examples = examples.filter((example) => example.name === exampleName);
						}
						return nitroComponentResolver.getComponentReadme(component.directory)
							.then((readme) => {
								return {
									examples,
									component,
									componentDependencies: dependencyInformation.dependencies,
									componentDependents: dependencyInformation.dependents,
									readme,
								};
							});
					});
			});
	}

	app.once('mount', () => {
		baseHref = app.mountpath.replace(/\/$/, '');
	});

	// Add href for base tag
	app.use((req, res, next) => {
		app.locals.htmlBaseHref = req.protocol + '://' + req.headers.host + '/';
		return next();
	});

	/**
	 * Returns the base data which is available for all views
	 */
	function getViewData() {
		return _.extend({}, app.locals, config.viewData, { baseHref });
	}

	// Component list
	app.get([
		'/components',
		'/components/:componentType',
	], (req, res, next) => {
		Promise.resolve(req.params.componentType
			? [req.params.componentType]
			: nitroComponentResolver.getComponentTypes()
		)
		// Get sorted component for all type as object
			.then((types) =>
				// Read and sort all package.json files
				Promise.all(
					types.map((type) =>
						nitroComponentResolver.getComponents(type)
							.then((components) => _.sortBy(components, 'name'))
					)
				)
				// Turn into object
				// { atoms: [ {..}, {..} ], molecules: [ {..}, [..]] }
					.then((typeComponents) => _.zipObject(types, typeComponents))
			)
			// Render patterns
			.then((componentTypes) => {
				const renderData = _.extend({}, getViewData(), { pageTitle: `${config.pageTitle} - overview` }, { componentTypes });
				res.render(config.navigationView, renderData);
			})
			// Report any error
			.catch(next);
	});

	// Component preview
	app.get('/components/:componentType/:componentName', (req, res, next) => {
		getExampleRenderData(req.params.componentType, req.params.componentName)
			.then((renderData) => {
				const patternData = _.extend({}, getViewData(), { pageTitle: `${config.pageTitle} ${req.params.componentName} [${req.params.componentType}]` }, renderData);
				nitroComponentValidator.validateComponent(renderData.component);
				res.render(config.componentView, patternData);
			})
			.catch(next);
	});

	// Component example detail view
	app.get('/components/:componentType/:componentName/:exampleName', (req, res, next) => {
		getExampleRenderData(req.params.componentType, req.params.componentName, req.params.exampleName)
			.then((renderData) => {
				renderData.example = renderData.examples[0];
				nitroComponentValidator.validateComponent(renderData.component);
				const patternData = _.extend({}, getViewData(), {
					pageTitle: config.pageTitle + ' ' + req.params.componentName + ' - ' + req.params.exampleName + ' [' + req.params.componentType + ']',
				}, renderData);
				res.render(config.exampleView, patternData);
			})
			.catch(next);
	});

	// Component example detail code view
	app.get('/components/:componentType/:componentName/:exampleName/code', (req, res, next) => {
		getExampleRenderData(req.params.componentType, req.params.componentName, req.params.exampleName)
			.then((renderData) => {
				renderData.example = renderData.examples[0];
				nitroComponentValidator.validateComponent(renderData.component);
				const patternData = _.extend({}, getViewData(), {
					pageTitle: config.pageTitle + ' ' + req.params.componentName + ' - ' + req.params.exampleName + ' [' + req.params.componentType + ']',
				}, renderData);
				res.render(config.exampleCodeView, patternData);
			})
			.catch(next);
	});

	return app;
};
