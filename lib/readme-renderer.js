var denodeify = require('denodeify');
var marked = denodeify(require('marked'));
var highlightJs = require('highlight.js');

module.exports = function(resolver, renderData) {
  return marked(renderData.content, {
    highlight: function(code, language, callback) {
      callback(null, highlightJs.highlightAuto(code).value);
    }
  }).then(function(markedResult) {
    renderData.content = markedResult;
    return renderData;
  })
};
