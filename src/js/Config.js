var sysGetConfig = function (cb) {
  var configPath = path.join(homePath, 'config');
  var configFile = path.join(configPath, 'config.json');

  var config = fse.readJsonSync(configFile);

  cb(config);
};

var sysGetConfigFile = function () {
  var configPath = path.join(homePath, 'config');
  var configFile = path.join(configPath, 'config.json');

  return configFile;
};

var sysGetConfigPath = function () {
  var configPath = path.join(homePath, 'config');
  return configPath;
};

var sysGetUrlParams = function (sParams) {
  var sPageURL = decodeURIComponent(window.location.search.substring(1)),
      sURLVariables = sPageURL.split('&'),
      sParameterName,
      i;

  for (i = 0; i < sURLVariables.length; i++) {
      sParameterName = sURLVariables[i].split('=');

      if (sParameterName[0] === sParams) {
          return sParameterName[1] === undefined ? true : sParameterName[1];
      }
  }
};
