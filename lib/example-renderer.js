module.exports = function(resolver, renderData, app, view) {
  return new Promise((resolve, reject) => {
    app.render(view, renderData, (err, result) => {
      if (err) {
        reject(err);
      }
      renderData.content = result;
      resolve(renderData);
    });
  });
};