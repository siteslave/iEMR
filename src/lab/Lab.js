var Q = require('q');
var _ = require('lodash');
var fse = require('fs-extra');
var fs = require('fs');
var path = require('path');

$(function () {
  var Lab = {};
  var configFile = sysGetConfigFile();
  var config = fse.readJsonSync(configFile);

  var configPath = sysGetConfigPath();
  var labConfigFile = path.join(configPath, 'lab.json');
  // Config exists
  fs.access(labConfigFile, fs.W_OK, function (err) {
    if (err) {
      var _config = {
        cretinine: 78,
        cholesterol: 102
      };

      fse.writeJsonSync(labConfigFile, _config);
    }
  });
  // Get lab config
  var lab = fse.readJsonSync(labConfigFile);

  var cre_code = lab.cretinine;
  var cho_code = lab.cholesterol;

  var db = require('knex')({
    client: 'mysql',
    connection: config.db,
    charset: 'utf8'
  });

  Lab.getList = function () {
    var q = Q.defer();

    db('lab_items')
      .orderBy('lab_items_name', 'desc')
      .then(function (rows) {
        q.resolve(rows);
      })
      .catch(function (err) {
        q.reject(err);
      });

    return q.promise;
  };


  // set lab list
  Lab.getList()
  .then(function (rows) {
    _.forEach(rows, function (v) {
      if (v.lab_items_code == cre_code) {
        $('#slCretinine').append('<option value="' + v.lab_items_code + '" selected>' + v.lab_items_name + '</option>');
      } else {
        $('#slCretinine').append('<option value="' + v.lab_items_code + '">' + v.lab_items_name + '</option>');
      }

      if (v.lab_items_code == cho_code) {
        $('#slCholesterol').append('<option value="' + v.lab_items_code + '" selected>' + v.lab_items_name + '</option>');
      } else {
        $('#slCholesterol').append('<option value="' + v.lab_items_code + '">' + v.lab_items_name + '</option>');
      }
    });
  }, function (err) {
    console.log(err);
  });

  $('#btnSave').on('click', function (e) {
    e.preventDefault();

    var cre = $('#slCretinine').val();
    var cho = $('#slCholesterol').val();
    var config = {
      cretinine: cre,
      cholesterol: cho
    };

    fse.writeJsonSync(labConfigFile, config);

    $.Notify({
      caption: 'การบันทึกข้อมูล',
      content: 'บันทึกข้อมูลการกำหนดค่า LAB เสร็จเรียบร้อยแล้ว',
      type: 'success',
      icon: "<span class='mif-notification'></span>"
    });

  });

});
