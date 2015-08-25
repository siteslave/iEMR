var Q = require('q');
var fse = require('fs-extra');
var moment = require('moment');
var _ = require('lodash');
var path = require('path');
var fs = require('fs');

$(function () {

  var configFile = sysGetConfigFile();
  var config = fse.readJsonSync(configFile);

  var db = require('knex')({
    client: 'mysql',
    connection: config.db,
    charset: 'utf8'
  });

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
  var labData = fse.readJsonSync(labConfigFile);

  // Get url params
  var vn = sysGetUrlParams('vn');
  var hn = sysGetUrlParams('hn');

  var Detail = {
    _getDiagnosis: function (vn) {
      var q = Q.defer();
      var sql = 'select o.vn, concat(o.icd10, " - ", icd.name) as diag, ' +
        ' concat(o.diagtype, " - ", dt.name) as diagtype' +
        ' from ovstdiag as o ' +
        ' left join diagtype as dt on dt.diagtype=o.diagtype ' +
        ' left join icd101 as icd on icd.code=o.icd10 ' +
        ' where o.vn=?';
      db.raw(sql, [vn])
      .then(function (rows) {
        q.resolve(rows[0]);
      })
      .catch(function (err) {
        q.reject(err);
      });

      return q.promise;
    },
    _getProcedure: function (vn) {
      var q = Q.defer();
      var sql = 'select d.vn, d.er_oper_code, d.price, e.name as procedure_name ' +
        ' from doctor_operation as d ' +
        ' left join er_oper_code as e on e.er_oper_code=d.er_oper_code ' +
        ' where d.vn=?';
      db.raw(sql, [vn])
      .then(function (rows) {
        q.resolve(rows[0]);
      })
      .catch(function (err) {
        q.reject(err);
      });

      return q.promise;
    },
    _getCharges: function (vn) {
      var q = Q.defer();
      var sql = 'select o.vn, o.icode, nd.name as income_name, o.qty, ' +
        ' o.unitprice as price , o.qty*o.unitprice as totalPrice ' +
        ' from opitemrece as o  ' +
        ' left join nondrugitems as nd on nd.icode=o.icode ' +
        ' where o.income <> "03" ' +
        ' and o.vn=?';
      db.raw(sql, [vn])
      .then(function (rows) {
        q.resolve(rows[0]);
      })
      .catch(function (err) {
        q.reject(err);
      });

      return q.promise;
    },
    _getDrugs: function (vn) {
      var q = Q.defer();
      var sql = 'select o.vn, o.icode, d.name as drug_name, o.qty, o.unitprice as price,  ' +
        ' o.qty*o.unitprice as totalPrice, ' +
        ' ds.name1, ds.name2, ds.code as usage_code  ' +
        ' from opitemrece as o  ' +
        ' left join drugitems as d on d.icode=o.icode ' +
        ' left join drugusage as ds on ds.drugusage=o.drugusage ' +
        ' where o.income = "03" ' +
        ' and o.vn=?';
      db.raw(sql, [vn])
      .then(function (rows) {
        q.resolve(rows[0]);
      })
      .catch(function (err) {
        q.reject(err);
      });

      return q.promise;
    },
    _getPatientInfo: function (hn) {
      var q = Q.defer();
      var sql = 'select p.cid, p.patient_hn as hn, concat(p.fname, " ", p.lname) as ptname, ' +
        ' p.birthdate, year(current_date())-year(p.birthdate) as age, p.house_regist_type_id, h.house_regist_type_name, ' +
        ' if(p.sex="1", "ชาย", "หญิง") as sex ' +
        ' from person as p ' +
        ' left join house_regist_type as h on h.house_regist_type_id=p.house_regist_type_id ' +
        ' where p.patient_hn=?';
      db.raw(sql, [hn])
      .then(function (rows) {
        q.resolve(rows[0]);
      })
      .catch(function (err) {
        q.reject(err);
      });

      return q.promise;
    },
    _getVisitDetail: function (vn) {
      var q = Q.defer();
      var sql = 'select v.vn, v.hn, v.dx_doctor, d.name as doctor_name,' +
        'v.pttype, v.pttypeno, v.spclty, sp.name as spclty_name, v.vstdate,  ' +
        'pt.name as pttype_name, concat(v.pdx, " - ", icd.name) as diag_name ' +
        'from vn_stat as v  ' +
        'left join pttype as pt on pt.pttype=v.pttype ' +
        'left join doctor as d on d.code=v.dx_doctor ' +
        'left join spclty as sp on sp.spclty=v.spclty ' +
        'left join icd101 as icd on icd.code=v.pdx ' +
        'where v.vn=?';
      db.raw(sql, [vn])
      .then(function (rows) {
        q.resolve(rows[0]);
      })
      .catch(function (err) {
        q.reject(err);
      });

      return q.promise;
    },
    _getLabs: function (vn) {
      var q = Q.defer();
      var sql = 'select lh.vn, lo.lab_items_code, lo.lab_order_result, ' +
        'li.lab_items_name, li.lab_items_unit ' +
        'from lab_order as lo ' +
        'inner join lab_head as lh on lh.lab_order_number=lo.lab_order_number ' +
        'left join lab_items as li on li.lab_items_code=lo.lab_items_code ' +
        'where lh.vn=?';
      db.raw(sql, [vn])
      .then(function (rows) {
        q.resolve(rows[0]);
      })
      .catch(function (err) {
        q.reject(err);
      });

      return q.promise;
    },
    _getChronicClinic: function (hn) {
      var q = Q.defer();
      var sql = 'select group_concat(distinct if(c.clinic="001", "DM", if(c.clinic="002", "HT", null))) as chronic ' +
        'from clinicmember as c ' +
        'where c.hn=?';
      db.raw(sql, [hn])
      .then(function (rows) {
        q.resolve(rows[0]);
      })
      .catch(function (err) {
        q.reject(err);
      });

      return q.promise;
    },
    _getServiceCVDRisk: function (vn, cholesterol) {
      var q = Q.defer();
      var sql = 'select s.bpd, s.bps, concat(round(s.bps), "/", round(s.bpd)) as bp, ' +
          'case sm.nhso_code ' +
          '  when 1 or 9 then "N" ' +
          '  when 2 then "Y" ' +
          '  when 3 then "Y" ' +
          '  when 4 then "Y" ' +
          '  else "N" ' +
          'END as smoking, ' +
          'timestampdiff(year, p.birthdate, s.vstdate) as age_year, ' +
          '(select lo.lab_order_result ' +
          'from lab_order as lo ' +
          'left join lab_items as li on li.lab_items_code=lo.lab_items_code ' +
          'left join lab_head as lh on lo.lab_order_number=lh.lab_order_number ' +
          'where lh.vn=s.vn ' +
          'and lo.lab_items_code=? limit 1) as cholesterol ' +
          'from opdscreen as s ' +
          'inner join person as p on p.patient_hn=s.hn ' +
          'left join smoking_type as sm on sm.smoking_type_id=s.smoking_type_id ' +
          'left join drinking_type as dm on dm.drinking_type_id=s.drinking_type_id ' +
          'where s.vn=? ' +
          'order by s.vstdate desc ' +
          'limit 1';
      db.raw(sql, [cholesterol, vn])
      .then(function (rows) {
        q.resolve(rows[0]);
      })
      .catch(function (err) {
        q.reject(err);
      });

      return q.promise;
    },
    _getServiceCretinine: function (vn, cretinine) {
      var q = Q.defer();
      var sql = 'select lo.lab_order_result ' +
      'from lab_order as lo ' +
      'left join lab_items as li on li.lab_items_code=lo.lab_items_code ' +
      'left join lab_head as lh on lo.lab_order_number=lh.lab_order_number ' +
      'where lh.vn=? ' +
      'and lo.lab_items_code=? limit 1';
      db.raw(sql, [vn, cretinine])
      .then(function (rows) {
        q.resolve(rows[0]);
      })
      .catch(function (err) {
        q.reject(err);
      });

      return q.promise;
    },
    _getColor: function (age, sex, chronic, has, bp, cholesterol, smoke) {
      var q = Q.defer();
      var sql = 'select color ' +
        'from colorchart ' +
        'where has=? and chronic=? and sex=? and age=? and bp=? and smoke=?' +
        'and cholesterol=? ' +
        'limit 1';
      db.raw(sql, [has, chronic, sex, age, bp, smoke, cholesterol])
      .then(function (rows) {
        q.resolve(rows[0]);
      })
      .catch(function (err) {
        q.reject(err);
      });

      return q.promise;
    },
    _checkIsChronic: function (hn) {
      var q = Q.defer();
      var sql = 'select * ' +
        'from ovstdiag ' +
        'where hn=? ' +
        'and ((icd10 between "E10" and "E1499") or (icd10 between "I10" and "I109")) ' +
        'limit 1';
      db.raw(sql, [hn])
      .then(function (rows) {
        q.resolve(rows[0]);
      })
      .catch(function (err) {
        q.reject(err);
      });

      return q.promise;
    },
    _getOpdScreenHistory: function (hn, cholesterol) {
      var q = Q.defer();
      var sql = 'select s.vn, s.vstdate, s.bpd, s.bps, concat(round(s.bps), "/", round(s.bpd)) as bp, s.bw, s.pulse, ' +
          'case sm.nhso_code ' +
          '  when 1 or 9 then "N" ' +
          '  when 2 then "Y" ' +
          '  when 3 then "Y" ' +
          '  when 4 then "Y" ' +
          '  else "N" ' +
          'END as smoking, ' +
          'timestampdiff(year, p.birthdate, s.vstdate) as age_year, ' +
          '(select lo.lab_order_result ' +
          'from lab_order as lo  ' +
          'left join lab_items as li on li.lab_items_code=lo.lab_items_code ' +
          'left join lab_head as lh on lo.lab_order_number=lh.lab_order_number ' +
          'where lh.vn=s.vn ' +
          'and lo.lab_items_code=? limit 1) as cholesterol ' +
          'from opdscreen as s ' +
          'inner join person as p on p.patient_hn=s.hn ' +
          'left join smoking_type as sm on sm.smoking_type_id=s.smoking_type_id ' +
          'left join drinking_type as dm on dm.drinking_type_id=s.drinking_type_id ' +
          'where s.hn=? ' +
          'order by s.vstdate desc ' +
          'limit 100';
      db.raw(sql, [cholesterol, hn])
      .then(function (rows) {
        q.resolve(rows[0]);
      })
      .catch(function (err) {
        q.reject(err);
      });

      return q.promise;
    }
  };

  var ageService = null;
  var isDM = false;

  Detail._getPatientInfo(hn)
  .then(function (rows) {
    var person = rows[0];
    $('#txtHN').text(person.hn);
    $('#txtCID').text(person.cid);
    $('#txtFullname').text(person.ptname);
    $('#txtAge').text(person.age);
    $('#txtSex').text(person.sex);
    $('#txtTypearea').text(person.house_regist_type_name);
    $('#txtBirth').text(moment(person.birthdate).format('DD/MM/YYYY'));
    return Detail._checkIsChronic(hn);
  })
  .then(function (rows) {
    if (_.size(rows)) {
      isDM = true;
      $('#txtIsDM').text('ใช่');
    } else {
      isDM = false;
      $('#txtIsDM').text('ไม่ใช่');
    }
    return Detail._getChronicClinic(hn);
  })
  .then(function (rows) {
    $('#txtChronic').text(rows[0].chronic);
    return Detail._getDiagnosis(vn);
  })
  .then(function (rows) {
    $('#tblDiagnosis').DataTable({
      data: rows,
      columns: [
        { data: 'diag', title: 'รหัสวินิจฉัย' },
        { data: 'diagtype', title: 'ประเภทการวินิจฉัย' }
      ],
      "paging": false,
      "info": false,
      "searching": false,
      language: {
        "emptyTable": "ไม่พบข้อมูล"
      }
    });
    return Detail._getVisitDetail(vn);
  })
  .then(function (rows) {
    $('#txtDateServ').val(moment(rows[0].vstdate).format('DD/MM/YYYY'));
    $('#txtClinic').val(rows[0].spclty_name);
    $('#txtDoctor').val(rows[0].doctor_name);
    $('#txtDiag').val(rows[0].diag_name);
    $('#txtPttype').val(rows[0].pttype + " " + rows[0].pttype_name);

    return Detail._getProcedure(vn);
  })
  .then(function (rows) {
    $('#tblProcedures').DataTable({
      data: rows,
      columns: [
        { data: 'procedure_name', title: 'รายการหัตถการ' },
        { data: 'price', title: 'ราคา' },
      ],
      "paging": false,
      "info": false,
      "searching": false,
      language: {
        "emptyTable": "ไม่พบข้อมูล"
      }
    });

    return Detail._getCharges(vn);
  })
  .then(function (rows) {
    $('#tblCharges').DataTable({
      data: rows,
      columns: [
        { data: 'income_name', title: 'รายการค่าใช้จ่าย' },
        { data: 'price', title: 'ราคา' },
        { data: 'qty', title: 'จำนวน' },
        { data: 'totalPrice', title: 'รวม' },
      ],
      "paging": false,
      "info": false,
      "searching": false,
      language: {
        "emptyTable": "ไม่พบข้อมูล"
      }
    });
    return Detail._getDrugs(vn);
  })
  .then(function (rows) {
    $('#tblDrugs').DataTable({
      data: rows,
      columns: [
        { data: 'drug_name', title: 'รายการยา' },
        { data: 'usage_code', title: 'วิธีใช้' },
        { data: 'price', title: 'ราคา' },
        { data: 'qty', title: 'จำนวน' },
        { data: 'totalPrice', title: 'รวม' },
      ],
      "paging": false,
      "info": false,
      "searching": false,
      language: {
        "emptyTable": "ไม่พบข้อมูล"
      }
    });

    return Detail._getLabs(vn);
  })
  .then(function (rows) {
    $('#tblLabs').DataTable({
      data: rows,
      columns: [
        { data: 'lab_items_name', title: 'รายการ' },
        { data: 'lab_order_result', title: 'ผล' },
        { data: 'lab_items_unit', title: 'หน่วย' }
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
    // lab cholesterol = 102
    return Detail._getOpdScreenHistory(hn, labData.cholesterol);
  })
  .then(function (rows) {

    var items = [];

    _.forEach(rows, function (v) {
      var obj = {};
      obj.vn = v.vn;
      obj.vstdate = moment(v.vstdate).format('DD/MM/YYYY');
      obj.age_year = v.age_year;
      obj.bps = v.bps === null ? "-" : parseInt(v.bps);
      obj.bpd = v.bpd === null ? "-" : parseInt(v.bpd);
      obj.bp = obj.bps + '/' + obj.bpd;
      obj.cholesterol = v.cholesterol;
      obj.smoking = v.smoking == "Y" ? "สูบ" : "ไม่สูบ";

      items.push(obj);
    });

    $('#tblHistory').DataTable({
      data: items,
      "columnDefs": [ {
        "targets": 0,
        "visible": false
      } ],
      "ordering": false,
      "order": [[ 0, 'desc' ]],
      "columns": [
        { data: 'vn', title: 'VN' },
        { data: 'vstdate', title: 'วันที่' },
        { data: 'age_year', title: 'อายุ(ปี)' },
        { data: 'bp', title: 'ความดัน' },
        { data: 'cholesterol', title: 'Cholesterol' },
        { data: 'smoking', title: 'สูบบุหรี่' }
      ],
      "paging": true,
      "info": true,
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

    return Detail._getServiceCVDRisk(vn, labData.cholesterol);
  })
  .then(function (rows) {
    var cvdchart = [];

    if (_.size(rows)) {
      var data = rows[0];
      //if(s.bps>=180,180,if(s.bps>=160,160,if(s.bps>=140,140,120)))
      var bp = data.bps >= 180 ? 180 : data.bps >= 160 ? 160 : data.bps >= 140 ? 140 : 120;
      var age = data.age_year >= 70 ? 70 : data.age_year >= 60 ? 60 : data.age_year >= 50 ? 50 : 40;

      ageService = data.age_year;

      var cholesterol = data.cholesterol >= 320 ? 320 : data.cholesterol >= 280 ? 280 : data.cholesterol >= 240 ? 240 : data.cholesterol >= 200 ? 200 : 160;
      var sex = $('#txtSex').text == "ชาย" ? "1" : "2";
      var has = data.cholesterol === null ? "N" : "Y";
      var dm = isDM ? "Y" : "N";
      var smoke = data.smoking;

      cvdchart = [
        {
          age: data.age_year, bps: data.bps, cholesterol: data.cholesterol,
          smoking: data.smoking, dm:  dm}
      ];
    } else {
      //if(s.bps>=180,180,if(s.bps>=160,160,if(s.bps>=140,140,120)))
      var bp = 0;
      var age = 0

      ageService = 0;

      var cholesterol = 160;
      var sex = $('#txtSex').text == "ชาย" ? "1" : "2";
      var has = "N";
      var dm = isDM ? "Y" : "N";
      var smoke = "N";

      cvdchart = [
        {
          age: 0, bps: 0, cholesterol: 0,
          smoking: "N", dm:  dm}
      ];
    }

    $('#tblCurrentCVDChart').DataTable({
      data: cvdchart,
      "ordering": false,
      "columns": [
        { data: 'age', title: 'อายุ(ปี)' },
        { data: 'bps', title: 'BPS' },
        { data: 'cholesterol', title: 'Chol' },
        { data: 'dm', title: 'DM' },
        { data: 'smoking', title: 'บุหรี่' }
      ],
      "paging": false,
      "info": false,
      "searching": false,
      language: {
        "emptyTable": "ไม่พบข้อมูล"
      }
    });

    Detail._getColor(age, sex, dm, has, bp, cholesterol, smoke)
    .then(function (rows) {
      var color = rows[0].color;
      var score = color == 1 ? '<10%' :
        color == 2 ? '10-<20%' :
        color == 3 ? '20-<30%' :
        color == 4 ? '30-<40%' :
        color == 5 ? '>=40%' : 'ERROR';

      var scoreText = color == 1 ? 'ต่ำ' :
        color == 2 ? 'ปานกลาง' :
        color == 3 ? 'สูง' :
        color == 4 ? 'สูงมาก' :
        color == 5 ? 'อันตราย' : 'ERROR';

        var colorCode = color == 1 ? '#8BC34A' :
          color == 2 ? '#EEFF41' :
          color == 3 ? '#FF9800' :
          color == 4 ? '#FF5722' :
          color == 5 ? '#BF360C' : '#CFD8DC';

        var scorePercent = color == 1 ? 20 :
          color == 2 ? 40 :
          color == 3 ? 60 :
          color == 4 ? 80 :
          color == 5 ? 100 : 0;

        $('#cvdChart').data('text', scoreText);
        $('#cvdChart').data('info', score);
        $('#cvdChart').data('percent', scorePercent);
        $('#cvdChart').data('fgcolor', colorCode);

        $('#cvdChart').circliful();

    }, function (err) {
      console.log(err);
    });

    return Detail._getServiceCretinine(vn, labData.cretinine);

  })
  .then(function (rows) {
    var result = 0;
    var cr = 0;
    var sex = $('#txtSex').text();

    if (_.size(rows)) {
      var _data = rows[0];


      cr = _data.lab_order_result;

      if (sex == "ชาย") {
        if (cr <= 0.9) {
          result = 141 * Math.pow((cr/0.9), -0.411) * Math.pow(0.993, ageService);
        } else {
          result = 141 * Math.pow((cr/0.9), -1.209) * Math.pow(0.993, ageService);
        }
      } else {
        if (cr <= 0.7) {
          result = 144 * Math.pow((cr/0.7), -0.329) * Math.pow(0.993, ageService);
        } else {
          result = 144 * Math.pow((cr/0.7), -1.209) * Math.pow(0.993, ageService);
        }
      }
    } else {
      result = 0;
      cr = 0;
    }

    //console.log(parseFloat(result).toFixed(2));
    var gfr = parseFloat(result).toFixed(2);
    var ckdState = gfr >= 90 ? '1' :
      gfr >= 60 ? '2' :
      gfr >= 30 ? '3' :
      gfr >= 15 ? '4' :
      gfr >= 1 ? '5' : '0';

      var scoreText = ckdState == 1 ? 'STATE 1' :
        ckdState == 2 ? 'STATE 2' :
        ckdState == 3 ? 'STATE 3' :
        ckdState == 4 ? 'STATE 4' :
        ckdState == 5 ? 'STATE 5' : 'ERROR';

      var colorCode = ckdState == 1 ? '#8BC34A' :
        ckdState == 2 ? '#EEFF41' :
        ckdState == 3 ? '#FF9800' :
        ckdState == 4 ? '#FF5722' :
        ckdState == 5 ? '#BF360C' : '#CFD8DC';

      var scorePercent = ckdState == 1 ? 20 :
        ckdState == 2 ? 40 :
        ckdState == 3 ? 60 :
        ckdState == 4 ? 80 :
        ckdState == 5 ? 100 : 0;

      $('#gfrChart').data('info', scoreText);
      $('#gfrChart').data('text', gfr);
      $('#gfrChart').data('percent', scorePercent);
      $('#gfrChart').data('fgcolor', colorCode);

      $('#gfrChart').circliful();

      var  _cretinine = [
        {age: ageService, sex: sex, cretinine: cr, gfr: gfr, state: ckdState}
      ];

    $('#tblCurrentGFRState').DataTable({
      data: _cretinine,
      "ordering": false,
      "columns": [
        { data: 'sex', title: 'เพศ' },
        { data: 'age', title: 'อายุ(ปี)' },
        { data: 'cretinine', title: 'Cre.' },
        { data: 'gfr', title: 'GFR' },
        { data: 'state', title: 'State' }
      ],
      "paging": false,
      "info": false,
      "searching": false,
      language: {
        "emptyTable": "ไม่พบข้อมูล"
      }
    });

    $('#loading').css('display', 'none');
  }, function (err) {
    $('#loading').css('display', 'none');
    console.log(err);
  });



  // initial tabs
  $(".tabcontrol").tabControl();

});
