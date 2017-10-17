'use strict';

const SNMP   = require('snmp-native');
const TABLE  = require('cli-table');
const SMTP   = require('smtp-connection');
const ARGV   = require('yargs').argv;

const printers = require('./priv/config.js').printers;

const mailEnabled = ARGV.mail  || false;
const firmVersion = ARGV.firm  || false;
const tonerLevel  = ARGV.toner || false;

function sendMail(messageString) {
  const mailFrom = require('./priv/config.js').mailFrom;
  const mailTo   = require('./priv/config.js').mailTo;
  const mailHost = require('./priv/config.js').mailHost;

  var connection = new SMTP({
    host: mailHost
  });
  
  connection.connect(function() {
    console.log("connected");
  
    var envelope = {
      from: mailFrom,
      to:   mailTo
    };

    connection.send(envelope, messageString, function(err, info) {
      (err) ? console.log(err) : console.log(info);
    });

    connection.quit();
    console.log("connection closed");
  });
};

var tabHeader = ['Device', 'Address', 'Total', 'Duplex', 'Scans'];
var tabWidths = [30,17,10,10,10];

if (tonerLevel) {
  tabHeader = tabHeader.concat(['Black', 'Cyan', 'Magenta', 'Yellow']);
  tabWidths = tabWidths.concat([10,9,9,9]);
};

if (firmVersion) { 
  tabHeader = tabHeader.concat(['Control', 'Engine', 'Boot']);
  tabWidths = tabWidths.concat([24,24,24]);
};

var table = new TABLE({
  head: 	tabHeader,
  colWidths: 	tabWidths,
});

printers.forEach(function(printer) {
  var session = new SNMP.Session({ host: printer, port: 161, community: 'public', timeouts: [3000] });

  var oids = [
    [1,3,6,1,2,1,1,1,0],[1,3,6,1,4,1,18334,1,1,1,5,7,2,1,1,0],[1,3,6,1,4,1,18334,1,1,1,5,7,2,1,3,0],
    [1,3,6,1,4,1,18334,1,1,1,5,7,2,1,5,0],[1,3,6,1,2,1,43,11,1,1,9,1,4],[1,3,6,1,2,1,43,11,1,1,9,1,1],
    [1,3,6,1,2,1,43,11,1,1,9,1,2],[1,3,6,1,2,1,43,11,1,1,9,1,3],[1,3,6,1,4,1,18334,1,1,1,5,5,1,1,3,1],
    [1,3,6,1,4,1,18334,1,1,1,5,5,1,1,3,2],[1,3,6,1,4,1,18334,1,1,1,5,5,1,1,3,3]
  ];

  session.getAll({ oids: oids }, function (err, res) { 
    if (err) { 
      table.push( [err, printer] );
    } else { 
      if (res.length === oids.length) {
        let row = []; 
        row.push( res[0].value, printer, res[1].value, res[2].value, res[3].value );
        if (tonerLevel) {
          if((res[0].value).match(/C35/)) {
            row.push( ((res[4].value)/60).toFixed(2), 
                      ((res[5].value)/60).toFixed(2), 
                      ((res[6].value)/60).toFixed(2),
                      ((res[7].value)/60).toFixed(2) );
          } else {
            row.push( (res[4].value).toFixed(2), 
                      (res[5].value).toFixed(2), 
                      (res[6].value).toFixed(2),
                      (res[7].value).toFixed(2) );
          };
        };
        if (firmVersion) {
          row.push( res[8].value, res[9].value, res[10].value );
        };
        table.push(row);
      } else {
        table.push( ["Err: invalid response", printer] );
      };
    }
    session.close();
    if ((table.length) === printers.length) {
      (mailEnabled) ? sendMail(table.toString()) : console.log(table.toString());
    }
  });
});
