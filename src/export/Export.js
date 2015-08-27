
$(function () {
  var Q = require('q');
  var moment = require('moment');
  var fs = require('fs');
  var path = require('path');
  var fse = require('fs-extra');
  var _ = require('lodash');
  var request = require('request');

  var _hospcode = null;

  $('#loading').fadeOut();
  $('#divUpload').fadeOut();

  var configFile = sysGetConfigFile();
  var config = fse.readJsonSync(configFile);

  var db = require('knex')({
    client: 'mysql',
    connection: config.db,
    charset: 'utf8'
  });

  //var homeDir = path.join(homePath, 'khos');
  var exportDir = path.join(homePath, 'export');
  var zipDir = path.join(homePath, 'zip');
  // remove old file
  fse.removeSync(exportDir);
  // Check or create extract directory
  fse.ensureDirSync(exportDir);
  fse.ensureDirSync(zipDir);

  var Export = {
    getWaitingFiles: function () {
      fs.readdir(zipDir, function (err, files) {
        if (err) return;

        var wFiles = [];
        _.forEach(files, function (file) {
          var obj = {};
          obj.name = file;
          obj.path = path.join(zipDir, file);
          wFiles.push(obj);
        });

        $('#tblFiles').DataTable({
          data: wFiles,
          destroy: true,
          "ordering": false,
          "columnDefs": [ {
            "targets": 1,
            "data": null,
            "defaultContent": '' +
            '<button class="button primary" data-name="btnUpload">' +
            '<span class="mif mif-upload mif-sm"></span>' +
            '</button> &nbsp; <button class="button warning" data-name="btnRemove">' +
            '<span class="mif mif-exit mif-sm"></span>' +
            '</button>'
          } ],
          "columns": [
            //{ data: 'name', title: 'ชื่อไฟล์' },
            { data: 'path', title: 'ที่อยู่' }
          ],
          "paging": false,
          "info": false,
          "searching": false,
          language: {
            searchPlaceholder: "คำที่ต้องการค้นหา...",
            search: "ค้นหา",
            "paginate": {
              "next": "&gt;",
              "previous": "&lt"
            },
            "emptyTable": "ไม่พบข้อมูล",
            "info": "หน้า _PAGE_ จาก _PAGES_",
            "loadingRecords": "กรุณารอซักครู่...",
            "lengthMenu": "แสดง _MENU_ เรคอร์ด"
          }
        });
      });
    },
    getHospcode: function () {
      var q = Q.defer();

      db('opdconfig')
        .select('hospitalcode')
        .then(function (rows) {
          q.resolve(rows[0].hospitalcode);
        })
        .catch(function (err) {
          q.reject(err);
        });

      return q.promise;
    },
    getPerson: function (hn) {
      var q = Q.defer();

      db('person as p')
        .select(
        'p.cid as CID', 'p.patient_hn as HN', 'p.fname as FNAME', 'p.lname as LNAME', 'p.birthdate as BIRTH',
        'p.sex as SEX', 'p.house_regist_type_id as TYPEAREA'
      )
        .whereIn('p.patient_hn', hn)
        .then(function (rows) {
          q.resolve(rows);
        })
        .catch(function (err) {
          q.reject(err);
        });

      return q.promise;
    },
    // Export service
    getService: function (start, end) {
      var q = Q.defer();
      db('ovst as o')
        .select(
        'o.vn as SEQ', 'o.hn as HN', 'o.vstdate as DATE_SERV', 'o.vsttime as TIME_SERV', 's.bps as BPS',
        's.bpd as BPD', 's.bw as WEIGHT', 's.height as HEIGHT', 's.cc as CC'
      )
        .leftJoin('opdscreen as s', 's.vn', 'o.vn')
        .innerJoin('patient as p', 'p.hn', 'o.hn')
        .innerJoin('ovstdiag as od', 'od.vn', 'o.vn')
        .whereNotNull('o.vn')
        //.where(function () {
        //  this.whereBetween('od.icd10', ['E100', 'E149'])
        //    .orWhere(function () {
        //      this.whereBetween('od.icd10', ['I10', 'I159']);
        //    });
        //})
        .whereBetween('o.vstdate', [start, end])
        .then(function (rows) {
          q.resolve(rows);
        })
        .catch(function (err) {
          q.reject(err);
        });

      return q.promise;
    },

    getDrug: function (vn) {
      var q = Q.defer();
      db('opitemrece as o')
        .select(
        'o.hn as HN', 'o.vn as SEQ', 'o.icode as ICODE', 'o.qty as QTY',
        'o.unitprice as PRICE', 'd.name as DRUG_NAME', 'd.units as UNIT',
        'd.did as STDCODE', 'ds.code as USAGE'
      )
        .innerJoin('drugitems as d', 'd.icode', 'o.icode')
        .leftJoin('drugusage as ds', 'ds.drugusage', 'o.drugusage')
        .where('o.income', '03')
        .whereIn('o.vn', vn)
        .then(function (rows) {
          q.resolve(rows);
        })
        .catch(function (err) {
          q.reject(err);
        });

      return q.promise;
    },

    getLab: function (vn) {
      var q = Q.defer();
      db('lab_head as lh')
        .select(
        'lh.hn as HN', 'lh.vn as SEQ', 'li.lab_items_code as LCODE', 'li.lab_items_name as LNAME',
        'lo.lab_order_result AS LRESULT',  'li.lab_items_unit as LUNIT'
      )
        .innerJoin('lab_order as lo', 'lo.lab_order_number', 'lh.lab_order_number')
        .innerJoin('lab_items as li', 'li.lab_items_code', 'lo.lab_items_code')
        .whereRaw('length(lo.lab_order_result) > 0')
        .whereIn('lh.vn', vn)
        .then(function (rows) {
          q.resolve(rows);
        })
        .catch(function (err) {
          q.reject(err);
        });

      return q.promise;
    },

    getDiag: function (vn) {
      var q = Q.defer();
      db('ovstdiag as od')
        .select(
        'od.hn as HN', 'od.vn AS SEQ', 'od.icd10 AS DIAG_CODE', 'od.diagtype AS DIAG_TYPE'
      )
        .whereIn('od.vn', vn)
        .then(function (rows) {
          q.resolve(rows);
        })
        .catch(function (err) {
          q.reject(err);
        });

      return q.promise;
    },

    getProced: function (vn) {
      var q = Q.defer();

      db('doctor_operation as o')
        .select(
        'v.hn as HN', 'o.vn as SEQ', 'o.icd9 as PROCED', 'o.price as PRICE'
      )
        .innerJoin('ovst as v', 'v.vn', 'o.vn')
        .whereIn('o.vn', vn)
        .then(function (rows) {
          q.resolve(rows);
        })
        .catch(function (err) {
          q.reject(err);
        });

      return q.promise;
    },

    getCharge: function (vn) {
      var q = Q.defer();

      db('opitemrece as o')
        .select(
        'o.hn as HN', 'o.vn as SEQ', 'o.icode as CHARGE_CODE', 'd.name as CHARGE_NAME',
        'o.qty as QTY', 'o.unitprice as PRICE'
      )
        .innerJoin('nondrugitems as d', 'd.icode', 'o.icode')
        .whereRaw('o.income <> "03"')
        .whereIn('o.vn', vn)
        .then(function (rows) {
          q.resolve(rows);
        })
        .catch(function (err) {
          q.reject(err);
        });

      return q.promise;
    }
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

      var _start = moment(start, "DD/MM/YYYY").format('YYYY-MM-DD');
      var _end = moment(end, "DD/MM/YYYY").format('YYYY-MM-DD');
      // Default hospcode
      var _hospcode = '00000';
      var _hn = [];
      var _seq = [];

      // Create file
      var headers = [];
      headers.service = [
          'HOSPCODE', 'HN', 'SEQ', 'DATE_SERV', 'TIME_SERV', 'BPS',
          'BPD', 'WEIGHT', 'HEIGHT', 'CC', 'D_UPDATED'
        ].join('|') + '\n';

      headers.person = [
          'HOSPCODE', 'CID', 'HN', 'FNAME', 'LNAME', 'BIRTH', 'SEX',
          'TYPEAREA', 'D_UPDATED'
        ].join('|') + '\n';

      headers.drug = [
          'HOSPCODE', 'HN', 'SEQ', 'ICODE', 'QTY', 'PRICE',
          'DRUG_NAME', 'UNIT', 'STDCODE', 'USAGE_NAME', 'D_UPDATED'
        ].join('|') + '\n';

      headers.lab = [
          'HOSPCODE', 'HN', 'SEQ', 'LCODE', 'LNAME', 'LRESULT', 'LUNIT', 'D_UPDATED'
        ].join('|') + '\n';

      headers.diag = [
          'HOSPCODE', 'HN', 'SEQ', 'DIAG_CODE', 'DIAG_TYPE', 'D_UPDATED'
        ].join('|') + '\n';

      headers.proced = [
          'HOSPCODE', 'HN', 'SEQ', 'PROCED', 'PRICE', 'D_UPDATED'
        ].join('|') + '\n';

      headers.charge = [
          'HOSPCODE', 'HN', 'SEQ', 'CHARGE_CODE', 'CHARGE_NAME', 'QTY', 'PRICE', 'D_UPDATED'
        ].join('|') + '\n';

      var files = [];
      files.service = path.join(exportDir, 'service.txt');
      files.person = path.join(exportDir, 'person.txt');
      files.drug = path.join(exportDir, 'drug.txt');
      files.lab = path.join(exportDir, 'lab.txt');
      files.diag = path.join(exportDir, 'diag.txt');
      files.proced = path.join(exportDir, 'proced.txt');
      files.charge = path.join(exportDir, 'charge.txt');

      // Create header
      fs.writeFileSync(files.service, headers.service);
      fs.writeFileSync(files.person, headers.person);
      fs.writeFileSync(files.drug, headers.drug);
      fs.writeFileSync(files.lab, headers.lab);
      fs.writeFileSync(files.diag, headers.diag);
      fs.writeFileSync(files.proced, headers.proced);
      fs.writeFileSync(files.charge, headers.charge);

      var promise = Export.getHospcode()
        .then(function (hospcode) {
          _hospcode = hospcode;
          return Export.getService(_start, _end);
        })
        .then(function (rows) {

          // Create service file
          if (_.size(rows)) {
            _.forEach(rows, function (v) {
              var obj = {};
              obj.HOSPCODE = _hospcode;
              obj.HN = v.HN;
              obj.SEQ = v.SEQ;
              obj.DATE_SERV = moment(v.DATE_SERV).format('YYYYMMDD');
              obj.TIME_SERV = v.TIME_SERV;
              obj.BPS = v.BPS;
              obj.BPD = v.BPD;
              obj.WEIGHT = v.WEIGHT;
              obj.HEIGHT = v.HEIGHT;
              obj.CC = v.CC === null ? "" : v.CC.replace(/(\r\n|\n|\r)/gm,"");
              obj.UPDATED = moment().format('YYYYMMDDHHmmss');

              var str = [
                  obj.HOSPCODE, obj.HN, obj.SEQ, obj.DATE_SERV,
                  obj.TIME_SERV, obj.BPS, obj.BPD, obj.WEIGHT,
                  obj.HEIGHT, obj.CC, obj.UPDATED
                ].join('|') + '\n';
              fs.appendFileSync(files.service, str);
            });
          }

          var allHn = _.uniq(rows, 'HN');
          _.forEach(allHn, function (v) {
            _hn.push(v.HN);
          });

          var allSEQ = _.uniq(rows, 'SEQ');
          _.forEach(allSEQ, function (v) {
            _seq.push(v.SEQ);
          });

          return Export.getPerson(_hn);
        })
        .then(function (rows) {
          // PERSON
          if (_.size(rows)) {
            _.forEach(rows, function (v) {
              var obj = {};
              obj.HOSPCODE = _hospcode;
              obj.CID = v.CID;
              obj.HN = v.HN;
              obj.FNAME = v.FNAME;
              obj.LNAME = v.LNAME;
              obj.BIRTH = moment(v.BIRTH).format('YYYYMMDD');
              obj.SEX = v.SEX;
              obj.TYPEAREA = v.TYPEAREA;
              obj.UPDATED = moment().format('YYYYMMDDHHmmss');

              var str = [
                  obj.HOSPCODE, obj.CID, obj.HN, obj.FNAME,
                  obj.LNAME, obj.BIRTH, obj.SEX, obj.TYPEAREA,
                  obj.UPDATED
                ].join('|') + '\n';

              fs.appendFileSync(files.person, str);
            });
          }

          return Export.getDrug(_seq);
        })
        .then(function (rows) {
          // DRUG
          if (_.size(rows)) {
            _.forEach(rows, function (v) {
              var obj = {};
              obj.HOSPCODE = _hospcode;
              obj.HN = v.HN;
              obj.SEQ = v.SEQ;
              obj.ICODE = v.ICODE;
              obj.QTY = v.QTY;
              obj.PRICE = v.PRICE;
              obj.DRUG_NAME = v.DRUG_NAME;
              obj.UNIT = v.UNIT;
              obj.STDCODE = v.STDCODE;
              obj.USAGE = v.USAGE;
              obj.UPDATED = moment().format('YYYYMMDDHHmmss');

              var str = [
                  obj.HOSPCODE, obj.HN, obj.SEQ, obj.ICODE,
                  obj.QTY, obj.PRICE, obj.DRUG_NAME, obj.UNIT,
                  obj.STDCODE, obj.USAGE, obj.UPDATED
                ].join('|') + '\n';

              fs.appendFileSync(files.drug, str);

            });
          }

          return Export.getLab(_seq);
        })
        .then(function (rows) {
          // LAB
          if (_.size(rows)) {
            _.forEach(rows, function (v) {
              var obj = {};
              obj.HOSPCODE = _hospcode;
              obj.HN = v.HN;
              obj.SEQ = v.SEQ;
              obj.LCODE = v.LCODE;
              obj.LNAME = v.LNAME;
              obj.LRESULT = v.LRESULT;
              obj.LUNIT = v.LUNIT;
              obj.UPDATED = moment().format('YYYYMMDDHHmmss');

              var str = [
                  obj.HOSPCODE, obj.HN, obj.SEQ, obj.LCODE, obj.LNAME,
                  obj.LRESULT, obj.LUNIT, obj.UPDATED
                ].join('|') + '\n';

              fs.appendFileSync(files.lab, str);
            });
          }

          return Export.getDiag(_seq);
        })
        .then(function (rows) {
          // DIAG
          if (_.size(rows)) {
            _.forEach(rows, function (v) {
              var obj = {};
              obj.HOSPCODE = _hospcode;
              obj.HN = v.HN;
              obj.SEQ = v.SEQ;
              obj.DIAG_CODE = v.DIAG_CODE;
              obj.DIAG_TYPE = v.DIAG_TYPE;
              obj.UPDATED = moment().format('YYYYMMDDHHmmss');

              var str = [
                  obj.HOSPCODE, obj.HN, obj.SEQ, obj.DIAG_CODE, obj.DIAG_TYPE, obj.UPDATED
                ].join('|') + '\n';

              fs.appendFileSync(files.diag, str);
            });
          }

          return Export.getProced(_seq);
        })
        .then(function (rows) {
          // PROCED
          if (_.size(rows)) {
            _.forEach(rows, function (v) {
              var obj = {};
              obj.HOSPCODE = _hospcode;
              obj.HN = v.HN;
              obj.SEQ = v.SEQ;
              obj.PROCED = v.PROCED;
              obj.PRICE = v.PRICE;
              obj.UPDATED = moment().format('YYYYMMDDHHmmss');

              var str = [
                  obj.HOSPCODE, obj.HN, obj.SEQ, obj.PROCED, obj.PRICE, obj.UPDATED
                ].join('|') + '\n';

              fs.appendFileSync(files.proced, str);
            });
          }

          return Export.getCharge(_seq);
        })
        .then(function (rows) {
          // CHARGE
          if (_.size(rows)) {
            _.forEach(rows, function (v) {
              var obj = {};
              obj.HOSPCODE = _hospcode;
              obj.HN = v.HN;
              obj.SEQ = v.SEQ;
              obj.CHARGE_CODE = v.CHARGE_CODE;
              obj.CHARGE_NAME = v.CHARGE_NAME;
              obj.QTY = v.QTY;
              obj.PRICE = v.PRICE;
              obj.UPDATED = moment().format('YYYYMMDDHHmmss');

              var str = [
                  obj.HOSPCODE, obj.HN, obj.SEQ, obj.CHARGE_CODE, obj.CHARGE_NAME,
                  obj.QTY, obj.PRICE, obj.UPDATED
                ].join('|') + '\n';

              fs.appendFileSync(files.charge, str);
            });
          }

          return;
        })
        .then(function () {

          var strZipFile = 'KHOS-' + _hospcode + '-' + moment().format('YYYYMMDDHHmmss') + '.zip';
          var zipFile = path.join(zipDir, strZipFile);

          var JSZip = require('jszip');
          var zip = new JSZip();

          zip.file('person.txt', fs.readFileSync(files.person));
          zip.file('service.txt', fs.readFileSync(files.service));
          zip.file('diag.txt', fs.readFileSync(files.diag));
          zip.file('drug.txt', fs.readFileSync(files.drug));
          zip.file('proced.txt', fs.readFileSync(files.proced));
          zip.file('charge.txt', fs.readFileSync(files.charge));
          zip.file('lab.txt', fs.readFileSync(files.lab));

          var buffer = zip.generate({type: "nodebuffer"});
          fs.writeFile(zipFile, buffer, function (err) {
            if (err) {
              $('#loading').fadeOut();
              $.Notify({
                caption: 'ผลการส่งออก',
                content: 'ไม่สามารถส่งออกไฟล์ได้',
                type: 'alert'
              });
              console.log(err);
              $('#btnExport').prop('disabled', false);
            } else {
              $('#loading').fadeOut();
              $.Notify({
                caption: 'ผลการส่งออก',
                content: 'ส่งออกข้อมูลเสร็จเรียบร้อยแล้ว',
                type: 'success'
              });

              $('#btnExport').prop('disabled', false);

              Export.getWaitingFiles();
            }
          });

        }, function (err) {
          $('#loading').fadeOut();
          $('#btnExport').prop('disabled', false);
          console.log(err);
          $.Notify({
            caption: 'เกิดข้อผิดพลาด',
            content: 'กรุณาดู log file เพื่อตรวจสอบข้อผิดพลาด',
            type: 'alert'
          });
        });

    }

  });

  Export.getWaitingFiles();

  $(document).on('click', '#btnUpload', function (e) {
    e.preventDefault();
    $('#btnUpload').prop('disabled', true);

    $('#loading').fadeIn();
    var url = config.cloud.url + '/upload';

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

  $(document).on('click', 'button[data-name="btnRemove"]', function (e) {
    e.preventDefault();

    if (confirm('คุณต้องการลบไฟล์นี้ ใช่หรือไม่?')) {
      var table = $('#tblFiles').DataTable();
      var data = table.row( $(this).parents('tr') ).data();

      fse.remove(data.path, function (err) {
        if (err) {
          $.Notify({
            caption: 'เกิดข้อผิดพลาด',
            content: 'ไม่สามารถลบไฟล์ได้',
            type: 'alert'
          });
        } else {
          $.Notify({
            caption: 'การลบไฟล์',
            content: 'ลบไฟล์: ' + data.path + " เสร็จเรียบร้อย",
            type: 'success'
          });

          Export.getWaitingFiles();
        }
      });
    }
  });

  $(document).on('click', 'button[data-name="btnUpload"]', function (e) {
    e.preventDefault();

    if (confirm('คุณต้องการอัปโหลดไฟล์นี้ ใช่หรือไม่?')) {

      $('#loading').fadeIn();

      var table = $('#tblFiles').DataTable();
      var data = table.row( $(this).parents('tr') ).data();

      var _hospcode = Cookies.get('hospcode');
      // Form data
      var formData = {
        hospcode: _hospcode,
        key: config.cloud.key,
        files: fs.createReadStream(data.path)
      };
      // Do upload file
      request.post({
        url: config.cloud.url + '/upload',
        formData: formData
      }, function (err, body) {
        if (err) { // Error
          console.log(err);
          $.Notify({
            caption: 'เกิดข้อผิดพลาด',
            content: "ไม่สามารถอัปโหลดไฟล์ได้",
            type: 'alert'
          });
          $('#loading').fadeOut();
        } else { // Success
          fse.removeSync(data.path);
          $.Notify({
            caption: 'การอัปโหลดไฟล์',
            content: 'อัปโหลดไฟล์: ' + data.path + " เสร็จเรียบร้อย",
            type: 'success'
          });
          Export.getWaitingFiles();
          $('#loading').fadeOut();
        }
      });

    }

  });

});
