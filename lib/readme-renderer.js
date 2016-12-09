/**
 * @file render the component/readme.md
 */
'use strict';

/* eslint-disable new-cap */

const denodeify = require('denodeify');
const path = require('path');
const markedRenderer = require('marked').Renderer;
const marked = denodeify(require('marked'));
const highlightJs = require('highlight.js');

module.exports = function (resolver, renderData) {
	const componentDirectory = path.dirname(renderData.filepath);
	return resolver.getComponentExamples(componentDirectory)
		.then((examples) => {
			const renderer = new markedRenderer();
			// Allow to use `example:button` in readme
			renderer.codespan = (code) => {
				// debugger;
				if (code.indexOf('example:') === 0) {
					const exampleName = code.split(':')[1];
					for (let i = 0; i < examples.length; i++) {
						if (examples[i].name === exampleName) {
							return examples[i].content;
						}
					}
				}
				return `<code class="inline-code">${code}</code>`;
			};
			// Render markdown
			return marked(renderData.content, {
				renderer,
				highlight: (code, language, cb) => {
					cb(null, highlightJs.highlightAuto(code).value);
				},
			}).then((markedResult) => {
				renderData.content = markedResult;
				return renderData;
			});
		});
};
