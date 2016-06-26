module.exports = function(renderData, app, view) {
  return new Promise((resolve, reject) => {
    app.render(view, renderData, (err, result) => {
      if (err) {
        reject(err);
      }
      resolve(result);
    });
  });
};