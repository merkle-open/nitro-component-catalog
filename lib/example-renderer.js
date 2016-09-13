'use strict';

/* eslint-disable max-params, prefer-template */

const path = require('path');
const html = require('html');

module.exports = function (resolver, renderData, app, view, baseUrl) {
	return new Promise((resolve, reject) => {
		app.render(view, renderData, (err, result) => {
			if (err) {
				reject(err);
			}
			const componentDirectory = path.dirname(path.dirname(renderData.filepath));
			const componentName = path.basename(componentDirectory);
			const componentType = path.basename(path.dirname(componentDirectory));
			renderData.url = baseUrl + componentType + '/' + componentName + '/' + renderData.name;
			renderData.content = html.prettyPrint(result, { indent_size: 2, max_char: 80, unformatted:[] });
			resolve(renderData);
		});
	});
};
