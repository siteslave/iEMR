var Q = require('q');
var moment = require('moment');
var fs = require('fs');
var path = require('path');
var fse = require('fs-extra');
var _ = require('lodash');
var request = require('request');

var exportPath = path.join(getHomePath(), "cvdrisk/export");
fse.ensureDirSync(exportPath);

var targetFile = path.join(exportPath, 'CVDSCREEN.txt');
var _hospcode = null;

$(function () {
  $('#loading').fadeOut();
  $('#divUpload').fadeOut();

  var configFile = sysGetConfigFile();
  var config = fse.readJsonSync(configFile);

  var db = require('knex')({
    client: 'mysql',
    connection: config.db,
    charset: 'utf8'
  });

  var Export = {};

  Export.doExport = function (start, end) {
     var q = Q.defer();
     var sql = 'select (select hospitalcode from opdconfig limit 1) as HOSPCODE, p.cid as CID, p.person_id as PID, o.vn as SEQ, DATE_FORMAT(o.vstdate, "%Y%m%d") as DATE_SERV,  ' +
     'o.bpd as BPD, o.bps as BPS, o.bw as WEIGHT, o.height as HEIGHT, o.waist as WAIST,  ' +
     's.nhso_code as SMOKE, d.nhso_code as DRINK, ov.doctor as PROVIDER,  ' +
     'DATE_FORMAT(NOW(), "%Y%m%d%H%i%s") as UPDATED ' +
     'from opdscreen as o ' +
     'inner join person as p on p.patient_hn=o.hn ' +
     'inner join ovst as ov on ov.vn=o.vn ' +
     'left join smoking_type as s on s.smoking_type_id=o.smoking_type_id ' +
     'left join drinking_type as d on d.drinking_type_id=o.drinking_type_id ' +
     'where o.vstdate between ? and ?';

     db.raw(sql, [start, end])
     .then(function (rows) {
       q.resolve(rows[0]);
     })
     .catch(function (err) {
       q.reject(err);
     });

     return q.promise;
  };

  $('#btnExport').on('click', function (e) {
    e.preventDefault();

    var start = $('#txtStart').val();
    var end = $('#txtEnd').val();

    if (!start) {
      $.Notify({
        caption: 'เกิดข้อผิดพลาด',
        content: 'กรุณาระบุวันที่เริ่มต้น',
        type: 'alert'
      });
    } else if (!end) {
      $.Notify({
        caption: 'เกิดข้อผิดพลาด',
        content: 'กรุณาระบุวันที่สิ้นสุด',
        type: 'alert'
      });
    } else {

      $('#loading').fadeIn();
      $('#btnExport').prop('disabled', true);

      fse.removeSync(targetFile);

      var _start = moment(start, "DD/MM/YYYY").format('YYYY-MM-DD');
      var _end = moment(end, "DD/MM/YYYY").format('YYYY-MM-DD');

      Export.doExport(_start, _end)
      .then(function (rows) {
        $('#txtTotal').text(_.size(rows));
        // Ceate header
        var header = [
          'HOSPCODE', 'CID', 'PID', 'SEQ', 'DATE_SERV', 'BPD', 'BPS', 'WEIGHT', 'HEIGHT',
          'WAIST', 'SMOKE', 'DRINK', 'PROVIDER', 'UPDATED'
        ].join('|') + '\n';

        fs.writeFileSync(targetFile, header);

        _.forEach(rows, function (v) {

          _hospcode = v.HOSPCODE;

          var obj = {};
          obj.HOSPCODE = v.HOSPCODE;
          obj.CID = v.CID;
          obj.PID = v.PID;
          obj.SEQ = v.SEQ;
          obj.DATE_SERV = v.DATE_SERV;
          obj.BPD = v.BPD;
          obj.BPS = v.BPS;
          obj.WEIGHT = v.WEIGHT;
          obj.HEIGHT = v.HEIGHT;
          obj.WAIST = v.WAIST;
          obj.SMOKE = v.SMOKE;
          obj.DRINK = v.DRINK;
          obj.PROVIDER = v.PROVIDER;
          obj.UPDATED = v.UPDATED;
          var str = [
            obj.HOSPCODE, obj.CID, obj.PID, obj.SEQ, obj.DATE_SERV,
            obj.BPD, obj.BPS, obj.WEIGHT, obj.HEIGHT,
            obj.WAIST, obj.SMOKE, obj.DRINK, obj.PROVIDER, obj.UPDATED
          ].join('|') + '\n';
            fs.appendFileSync(targetFile, str);
        });

        $('#btnExport').prop('disabled', false);
        $('#txtFile').val(targetFile);
        $('#loading').fadeOut();
        $('#divUpload').fadeIn('slow');

        $.Notify({
          caption: 'ผลการส่งออก',
          content: 'ส่งออกข้อมูลเสร็จเรียบร้อยแล้ว',
          type: 'success'
        });
      }, function (err) {
        console.log(err);
        $.Notify({
          caption: 'ผลการส่งออก',
          content: 'ไม่สามารถส่งออกข้อมูลได้',
          type: 'alert'
        });
        $('#loading').fadeOut();
      });
    }

  });

  $(document).on('click', '#btnUpload', function (e) {
    e.preventDefault();
    $('#btnUpload').prop('disabled', true);

    $('#loading').fadeIn();
    var url = config.cloud.uploadUrl;

    var formData = {
      hospcode: _hospcode,
      file: fs.createReadStream(targetFile)
    };

    request.post({
      url: url,
      formData: formData
    }, function (err, res, body) {
      // console.log(res);
      // console.log(body);
      if (err) { // Error
        console.log(err);
        $.Notify({
          caption: 'เกิดข้อผิดพลาด',
          content: 'ไม่สามารถอัปโหลดไฟล์ได้',
          type: 'alert'
        });

        $('#loading').fadeOut();
        $('#btnUpload').prop('disabled', false);
      } else { // Success
        $.Notify({
          caption: 'ผลการอัปโหลด',
          content: 'อัปโหลดไฟล์เสร็จเรียบร้อยแล้ว',
          type: 'success'
        });

        $('#loading').fadeOut();
        $('#btnUpload').prop('disabled', false);
      }
   });

  });

});
