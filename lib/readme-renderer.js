/**
 * @file render the component/readme.md
 */
'use strict';
var denodeify = require('denodeify');
var path = require('path');
var markedRenderer = require('marked').Renderer;
var marked = denodeify(require('marked'));
var highlightJs = require('highlight.js');

module.exports = function(resolver, renderData) {
  var componentDirectory = path.dirname(renderData.filepath);
  return resolver.getComponentExamples(componentDirectory)
    .then(function(examples) {
      var renderer = new markedRenderer();
      // Allow to use `example:button` in readme
      renderer.codespan = (code) => {
      debugger;
        if (code.indexOf('example:') === 0) {
          var exampleName = code.split(':')[1];
          for (let i = 0; i < examples.length; i++) {
            if (examples[i].name === exampleName) {
              return examples[i].content;
            }
          }
        }
        return '<code class="inline-code">' + code + '</code>';
      };
      // Render markdown
      return marked(renderData.content, {
        renderer: renderer,
        highlight: function(code, language, callback) {
          callback(null, highlightJs.highlightAuto(code).value);
        }
      }).then(function(markedResult) {
        renderData.content = markedResult;
        return renderData;
      });
  });
};
