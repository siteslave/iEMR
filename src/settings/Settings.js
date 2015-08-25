var fse = require('fs-extra');

$(function () {

  $('#btnSave').on('click', function (e) {
    e.preventDefault();

    var config = {};

    config.host = $('#txtHost').val();
    config.port = $('#txtPort').val();
    config.database = $('#txtDatabase').val();
    config.user = $('#txtUsername').val();
    config.password = $('#txtPassword').val();
    config.uploadUrl = $('#txtUploadUrl').val();

    if (!config.host || !config.port || !config.database || !config.user || !config.password || !config.uploadUrl) {
      $.Notify({
        caption: 'เกิดข้อผิดพลาด',
        content: 'กรุณากรอกข้อมูลให้ครบ',
        type: 'alert',
        icon: "<span class='mif-notification'></span>"
      });
    } else {
      saveConfig(config, function (err) {
        if (err) {
          console.log(err);
          $.Notify({
            caption: 'เกิดข้อผิดพลาด',
            content: 'ไม่สามารถบันทึกข้อมูลได้',
            type: 'alert',
            icon: "<span class='mif-notification'></span>"
          });
        } else {
          $.Notify({
            caption: 'การบันทึกข้อมูล',
            content: 'บันทึกข้อมูลการกำหนดค่าการเชื่อมต่อเสร็จเรียบร้อย',
            type: 'success',
            icon: "<span class='mif-notification'></span>"
          });
        }
      });
    }

  });

  // Save config
  var saveConfig = function (config, cb) {
    var dataConfig = {
      db: {
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password
      },
      cloud: {
        uploadUrl: config.uploadUrl
      }
    };

    var configFile = sysGetConfigFile();
    fse.writeJson(configFile, dataConfig, function (err) {
      if (err) {
        cb(err);
      } else {
        cb(null);
      }
    });
  };

  var getConfig = function () {

    var configFile = sysGetConfigFile();
    var config = fse.readJsonSync(configFile);

    $('#txtHost').val(config.db.host);
    $('#txtPort').val(config.db.port);
    $('#txtDatabase').val(config.db.database);
    $('#txtUsername').val(config.db.user);
    $('#txtPassword').val(config.db.password);
    $('#txtUploadUrl').val(config.cloud.uploadUrl);

  };
  // Initial configure data to the form
  getConfig();

});
