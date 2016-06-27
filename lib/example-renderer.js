var path = require('path');

module.exports = function(resolver, renderData, app, view, baseUrl) {
  return new Promise((resolve, reject) => {
    app.render(view, renderData, (err, result) => {
      if (err) {
        reject(err);
      }
      var componentDirectory = path.dirname(path.dirname(renderData.filepath));
      var componentName = path.basename(componentDirectory);
      var componentType = path.basename(path.dirname(componentDirectory));
      renderData.url = baseUrl + componentType + '/' + componentName + '/' + renderData.name;
      renderData.content = result;
      resolve(renderData);
    });
  });
};