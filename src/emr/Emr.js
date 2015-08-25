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

  var dsHistory = [
    {
      date: '20/08/2558',
      time: '20:33',
      hospital: '11054 รพช.เชียงยืน'
    },{
      date: '21/08/2558',
      time: '11:33',
      hospital: '11053 รพช.กันทรวิชัย'
    }
  ];

  $('#tblHistory').DataTable({
    data: dsHistory,
    "ordering": false,
    "columnDefs": [ {
      "targets": 2,
      "data": null,
      "defaultContent": '<button class="button primary"><span class="mif mif-search mif-sm"></span></button>'
    } ],
    "columns": [
      { data: 'date', title: 'วันที่' },
      { data: 'hospital', title: 'หน่วยบริการ' }
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

  // initial tabs
  $(".tabcontrol").tabControl();

});