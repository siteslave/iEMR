var fse = require('fs-extra');
var Q = require('q');
var _ = require('lodash');
var moment = require('moment');

$(function () {

  var configFile = sysGetConfigFile();
  var config = fse.readJsonSync(configFile);
  //

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
  
  var db = require('knex')({
    client: 'mysql',
    connection: config.db,
    charset: 'utf8'
  });
  //
  var Main = {
    _getService: function (date) {
      var q = Q.defer();

      db('ovst as o')
        .select('o.vstdate', 'p.cid', 'o.hn', 'o.vsttime', 'o.vn', db.raw('concat(p.pname,p.fname, " ",p.lname) as ptname'),
        't.name as pttype_name', 'o.pttypeno', 'd.name as doctor_name', 'i.name as pdx_name',
        's.name as spclty_name', 'st.name as ost_name', 'v.income', db.raw('YEAR(o.vstdate)-YEAR(p.birthday) as age'),
        db.raw('concat(v.pdx, "-", i.name) as dx'))
        .leftJoin('vn_stat as v', 'v.vn', 'o.vn')
        .innerJoin('patient as p', 'p.hn', 'o.hn')
        .leftJoin('pttype as t', 't.pttype', 'o.pttype')
        .leftJoin('doctor as d', 'd.code', 'o.doctor')
        .leftJoin('icd101 as i', 'i.code', 'v.main_pdx')
        .leftJoin('spclty as s', 's.spclty', 'o.spclty')
        .leftJoin('ovstost as st', 'st.ovstost', 'o.ovstost')
        .where('o.vstdate', date)
        // .where('o.pt_subtype', 1)
        .orderBy('o.vn')
        .then(function (rows) {
          q.resolve(rows);
        })
        .catch(function (err) {
          q.reject(err);
        });

      return q.promise;

    }
  }; // End Main{};

  $('#btnGetService').on('click', function (e) {
    e.preventDefault();

    var serviceDate = moment($('#txtDate').val(), 'DD/MM/YYYY').format('YYYY-MM-DD');
    Cookies.set('serviceDate', serviceDate);

    doGetService(serviceDate);
  });
  // Get service
  var doGetService = function (date) {
    $('#loading').css('display', 'inline');
    Main._getService(date)
    .then(function (rows) {

      var table = $('#tblVisit').DataTable({
        data: rows,
        destroy: true,
        columns: [
          { data: 'hn', title: 'HN' },
          { data: 'ptname', title: 'ชื่อ-สกุล'},
          { data: 'age', title: 'อายุ (ปี)'},
          { data: 'dx', title: 'การวินิจฉัย' }
        ],
        "columnDefs": [ {
              "targets": 4,
              "data": null,
              "defaultContent": '<div class="dropdown-button place-right">' +
                '<button class="button dropdown-toggle warning"><span class="mif mif-search mif-sm"></span></button>' +
                '<ul class="split-content d-menu place-right" data-role="dropdown">' +
                '<li><a href="#" data-name="btnGetService"><span class="mif mif-search mif-lg"></span> ข้อมูลรับบริการ/CVD/GFR</a></li>' +
                '<li><a href="#" data-name="btnGetEMR"><span class="mif mif-vpn-lock mif-lg"></span> Cloud EMR</a></li>' +
              '</ul>'
          } ],
        "order": [[ 1, "desc" ]],
        language: {
          searchPlaceholder: "คำที่ต้องการค้นหา...",
          search: "ค้นหา",
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

      $('#loading').css('display', 'none');
    }, function (err) {
      $('#loading').css('display', 'none');
      console.log(err);
    });
  };

  var serviceDate = Cookies.get('serviceDate');

  if (serviceDate) {
    $('#divDate').data('preset', serviceDate);
    doGetService(serviceDate);
  } else {
    // initial service list
    var currentDate = moment().format('YYYY-MM-DD');
    $('#divDate').data('preset', currentDate);
    doGetService(currentDate);
  }

  $('#divDate').datepicker();

  $('#tblVisit').on('click', 'a[data-name="btnGetService"]', function (e) {
    var table = $('#tblVisit').DataTable();
    var data = table.row( $(this).parents('tr') ).data();
    window.location.href = "../detail/Detail.html?hn="+ data.hn + "&vn=" + data.vn;
  });
  $('#tblVisit').on('click', 'a[data-name="btnGetEMR"]', function (e) {
    var table = $('#tblVisit').DataTable();
    var data = table.row( $(this).parents('tr') ).data();
    window.location.href = "../emr/Emr.html?hn="+ data.hn + "&vn=" + data.vn;
  });

});
