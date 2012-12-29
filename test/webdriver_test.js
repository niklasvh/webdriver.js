"use strict";
var webdriver = require('../lib/webdriver.js').webdriver,
http = require("http"),
url = require("url"),
path = require("path"),
fs = require("fs");

/*
  ======== A Handy Little Nodeunit Reference ========
  https://github.com/caolan/nodeunit

  Test methods:
    test.expect(numAssertions)
    test.done()
  Test assertions:
    test.ok(value, [message])
    test.equal(actual, expected, [message])
    test.notEqual(actual, expected, [message])
    test.deepEqual(actual, expected, [message])
    test.notDeepEqual(actual, expected, [message])
    test.strictEqual(actual, expected, [message])
    test.notStrictEqual(actual, expected, [message])
    test.throws(block, [error], [message])
    test.doesNotThrow(block, [error], [message])
    test.ifError(value)
*/

var server, browser, window;

exports['awesome'] = {
  setUp: function(done) {
    server = http.Server(function(request, response) {
      var uri = url.parse(request.url).pathname,
      filename = path.join(process.cwd(), uri);

      fs.exists(filename, function(exists) {
        if(!exists) {
          response.writeHead(404, {
            "Content-Type": "text/plain"
          });
          response.write("404 Not Found\n");
          response.end();
          return;
        }

        fs.readFile(filename, "binary", function(err, file) {
          if(err) {
            response.writeHead(500, {
              "Content-Type": "text/plain"
            });
            response.write(err + "\n");
            response.end();
            return;
          }

          response.writeHead(200);
          response.write(file, "binary");
          response.end();
        });
      });
    }).listen(5555);
    browser = new webdriver();
    done();
  },
  tearDown: function(done) {
    server.close(function() {
      done();
    });
  },

  'getData': function(test) {
    test.expect(8);

    browser.url("http://localhost:5555/test/testpage.html")
    .title(function(title){
      test.equal(title, 'Sample page', 'should fetch title');
    })
    .status(function(data){
      test.ok(data.os, 'should get browser info');
    })
    .screenshot(function(data){
      test.ok(data.length > 5000, 'should capture screenshot');
    })
    .$('#timeddiv', 5000, function(el) {
      test.ok(el.get(0), "Element found after timeout");
    })
    .$('input').attr('name', function(name) {
      test.equal(name, 'username', 'should fetch first matched items attribute');
    }).css('width', function(width){
      test.equal(width, '200px', 'should fetch first matched css property width');
    })
    .$('.test').width(function(width) {
      test.equal(width, 250, 'should fetch width of element');
    }).height(function(height) {
      test.equal(height, 50, 'should fetch height of element');
    });

    browser.url("http://google.com/")
    .$('input[name=q]').val('hello world!')
    .$('form[action="/search"]').submit();

    browser.close(function(){
      test.done();
    });
  },

  'executeScript': function(test) {
    test.expect(2);

    browser.url("http://localhost:5555/test/testpage.html")
    .execute(function(msg) {
      return "Hello " + msg;
    },["world!"], function(result) {
      test.equal(result, 'Hello world!', 'should execute javascript and return value');
    })
    .executeAsync(function(msg, callback) {
      window.setTimeout(function(){
        callback("Hello async " + msg);
      }, 0);
    },["world!"], function(result) {
      test.equal(result, 'Hello async world!', 'should execute javascript and return value');
    })
    .close(function(){
      test.done();
    });
  },
  'sourceCode': function(test) {
    test.expect(1);
    browser.url("http://localhost:5555/test/source.txt")
    .source(function(source){
      fs.readFile('test/source.txt', function (err, data) {
        test.ok(source.indexOf(data.toString()) !== -1, 'should fetch source code');
      });
    }).close(function(){
      test.done();
    });
  }
};
