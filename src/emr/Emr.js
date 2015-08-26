var Q = require('q');
var fse = require('fs-extra');
var moment = require('moment');
var _ = require('lodash');
var path = require('path');
var fs = require('fs');

$(function () {

  // Show loading
  $('#loading').fadeIn();

  var configFile = sysGetConfigFile();
  var config = fse.readJsonSync(configFile);

  var db = require('knex')({
    client: 'mysql',
    connection: config.db,
    charset: 'utf8'
  });

  var hn = sysGetUrlParams('hn');
  var cid = sysGetUrlParams('cid');
  var hospcode = Cookies.get('hospcode');

  var Emr = {};

  // Get Patient information
  Emr.getPatientInfo = function (hn) {
    var q = Q.defer();

    db('person as p')
      .select('p.cid', 'p.pname', 'p.fname', 'p.lname',
      'p.sex', 'p.birthdate', 'p.house_regist_type_id',
      'h.address', 'v.village_moo', 'v.village_name', 't.house_regist_type_name')
      .leftJoin('house as h', 'h.house_id', 'p.house_id')
      .leftJoin('village as v', 'v.village_id', 'h.village_id')
      .leftJoin('house_regist_type as t', 't.house_regist_type_id', 'p.house_regist_type_id')
      .where('p.patient_hn', hn)
      .limit(1)
      .then(function (rows) {
        q.resolve(rows[0]);
      })
      .catch(function (err) {
        q.reject(err);
      });

    return q.promise;

  };

  Emr.getServiceHistory = function (_cid) {
    var q = Q.defer();

    $.ajax({
      url: config.cloud.url + '/service_history',
      method: 'POST',
      dataType: 'json',
      data: {
        cid: _cid,
        hospcode: hospcode,
        key: config.cloud.key
      }
    })
    .done(function (data) {
        var services = [];
        _.forEach(data.rows, function (v) {
          var obj = {};
          var y = parseInt(moment(v.date_serv).format('YYYY')) + 543;
          var date_serv = moment(v.date_serv).format('DD/MM/') + y;
          obj.date_serv = date_serv;
          obj.true_date_serv = v.date_serv;
          obj.hospcode = v.hospcode;
          obj.hospname = v.hospname;
          obj.seq = v.seq;
          obj.hn = v.hn;
          services.push(obj);
        });

        q.resolve(services);
    })
    .error(function (err) {
        q.reject(err);
      });

    return q.promise;
  };

  Emr.getServiceDetail = function (service_hospcode, hn, date_serv, seq) {
    var q = Q.defer();

    $.ajax({
      url: config.cloud.url + '/service_detail',
      method: 'POST',
      dataType: 'json',
      data: {
        hospcode: hospcode,
        key: config.cloud.key,
        service_hospcode: service_hospcode,
        hn: hn,
        seq: seq,
        date_serv: date_serv
      }
    })
    .done(function (data) {
      q.resolve(data);
      })
    .error(function (err) {
      q.reject(err);
      });

    return q.promise;
  };

  Emr.setDetail = function (data) {
    var y = parseInt(moment(data.date_serv).format('YYYY'))+543;
    var date_serv = moment(data.date_serv).format('DD/MM/') + y;
    $('#txtDateServ').val(date_serv);
    $('#txtTimeServe').val(data.time_serv);
    $('#txtHospital').val(data.hospcode + " - " + data.hospname);
    $('#txtBP').val(data.bps + '/' + data.bpd);
    $('#txtWeight').val(data.weight);
    $('#txtHeight').val(data.height);
    $('#txtCC').val(data.cc);
  };

  Emr.setTableData = function (hospcode, hn, date_serve, seq) {
    Emr.getServiceDetail(hospcode, hn, date_serve, seq)
      .then(function (data) {
        var _data = data.rows;
        Emr.setDetail(_data.detail);

        $('#tblDiagnosis').DataTable({
          data: _data.diag,
          destroy: true,
          columns: [
            { data: 'diag_code', title: 'รหัส' },
            { data: 'diag_name', title: 'รายการ' },
            { data: 'diag_type', title: 'ประเภทการวินิจฉัย' }
          ],
          "paging": false,
          "info": false,
          "searching": false,
          language: {
            "emptyTable": "ไม่พบข้อมูล"
          }
        });

        $('#tblProcedures').DataTable({
          data: _data.proced,
          destroy: true,
          columns: [
            { data: 'proced_name', title: 'รายการหัตถการ' },
            { data: 'price', title: 'ราคา' }
          ],
          "paging": false,
          "info": false,
          "searching": false,
          language: {
            "emptyTable": "ไม่พบข้อมูล"
          }
        });

        $('#tblDrugs').DataTable({
          data: _data.drug,
          destroy: true,
          columns: [
            { data: 'drug_name', title: 'รายการยา' },
            { data: 'usage_name', title: 'วิธีใช้' },
            { data: 'price', title: 'ราคา' },
            { data: 'qty', title: 'จำนวน' },
            { data: 'totalPrice', title: 'รวม' }
          ],
          "paging": false,
          "info": false,
          "searching": false,
          language: {
            "emptyTable": "ไม่พบข้อมูล"
          }
        });

        $('#tblCharges').DataTable({
          data: _data.charge,
          destroy: true,
          columns: [
            { data: 'charge_name', title: 'รายการค่าใช้จ่าย' },
            { data: 'price', title: 'ราคา' },
            { data: 'qty', title: 'จำนวน' },
            { data: 'totalPrice', title: 'รวม' }
          ],
          "paging": false,
          "info": false,
          "searching": false,
          language: {
            "emptyTable": "ไม่พบข้อมูล"
          }
        });

        $('#tblLabs').DataTable({
          data: _data.lab,
          destroy: true,
          columns: [
            { data: 'lname', title: 'รายการ' },
            { data: 'lresult', title: 'ผล' },
            { data: 'lunit', title: 'หน่วย' }
          ],
          "paging": false,
          "info": false,
          "searching": false,
          language: {
            "paginate": {
              "next": "&gt;",
              "previous": "&lt"
            },
            "emptyTable": "ไม่พบข้อมูล",
            "info": "แสดงหน้า _PAGE_ จาก _PAGES_",
            "loadingRecords": "กรุณารอซักครู่...",
            "lengthMenu": "แสดง _MENU_ เรคอร์ด"
          }
        });

        $('#loading').fadeOut();

      }, function (err) {
        $('#loading').fadeOut();
        $.Notify({
          caption: 'เกิดข้อผิดพลาด',
          content: 'ไม่สามารถแสดงข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่อ',
          icon: "<span class='mif-vpn-publ'></span>",
          type: 'alert'
        });
        console.log(err);
      });
  };

  Emr.getPatientInfo(hn)
    .then(function (rows) {
      var fullname = rows.pname + rows.fname + " " + rows.lname;
      var y = parseInt(moment(rows.birthdate).format('YYYY')) + 543;
      var age = parseInt(moment().format('YYYY')) - parseInt(moment(rows.birthdate).format('YYYY'));
      var birthDate = moment(rows.birthdate).format('DD/MM/') + y;
      var sex = rows.sex == "1" ? "ชาย" : "หญิง";

      $('#txtCID').text(cid);
      $('#txtFullname').text(fullname);
      $('#txtBirth').text(birthDate);
      $('#txtAge').text(age);
      $('#txtSex').text(sex);

      return Emr.getServiceHistory(cid);
    })
    .then(function (rows) {
      var data = _.first(rows);
      var date_serve = moment(data.true_date_serv).format('YYYY-MM-DD');
      Emr.setTableData(data.hospcode, data.hn, date_serve, data.seq);

      $('#tblHistory').DataTable({
        data: rows,
        "ordering": false,
        "columnDefs": [ {
          "targets": 2,
          "data": null,
          "defaultContent": '<button class="button primary" data-name="btnGetService"><span class="mif mif-search mif-sm"></span></button>'
        } ],
        "columns": [
          { data: 'date_serv', title: 'วันที่' },
          { data: 'hospname', title: 'หน่วยบริการ' }
        ],
        "paging": true,
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

    }, function (err) {
      console.log(err);
    });

  $(document).on('click', 'button[data-name="btnGetService"]', function (e) {
    e.preventDefault();

    var table = $('#tblHistory').DataTable();
    var data = table.row( $(this).parents('tr') ).data();
    var date_serve = moment(data.true_date_serv).format('YYYY-MM-DD');

    Emr.setTableData(data.hospcode, hn, date_serve, data.seq);

  });

  // initial tabs
  $(".tabcontrol").tabControl();

});