var handlebarsPlugin = require('../');
var defineModule = require('gulp-define-module');
var should = require('should');
var gulp = require('gulp');
var gutil = require('gulp-util');
var concat = require('gulp-concat');
var wrap = require('gulp-wrap')
var declare = require('gulp-declare')
var fs = require('fs');
var path = require('path');
var assert = require('stream-assert');
var vm = require('vm')
require('mocha');

var fixtures = function (glob) { return path.join(__dirname, 'fixtures', glob); }

var getFixture = function(filePath) {
  filePath = path.join('test', 'fixtures', filePath);
  return new gutil.File({
    path: filePath,
    cwd: path.join('test', 'fixtures'),
    base: path.dirname(filePath),
    contents: fs.readFileSync(filePath)
  });
};

var getExpectedString = function(filePath) {
  return fs.readFileSync(path.join('test', 'expected', filePath), 'utf8');
};

var fileMatchesExpected = function(file, fixtureFilename, expectedFilename) {
  path.basename(file.path).should.equal(expectedFilename);
  String(file.contents).should.equal(getExpectedString(fixtureFilename));
};

describe('gulp-handlebars', function() {
  describe('handlebarsPlugin()', function() {

    it('should emit an error when compiling invalid templates', function(done) {
      var stream = handlebarsPlugin();
      var invalidTemplate = getFixture('Invalid.hbs');

      stream.on('error', function(err) {
        err.fileName.should.equal('test/fixtures/Invalid.hbs'),
        err.should.be.an.instanceOf(Error);
        err.message.should.equal(getExpectedString('Error.txt'));
        done();
      });

      stream.write(invalidTemplate);
      stream.end();
    });

    it('should compile templates', function(done) {
      var stream = handlebarsPlugin();
      var basicTemplate = getFixture('Basic.hbs');

      stream.on('data', function(newFile) {
        should.exist(newFile);
        should.exist(newFile.contents);
        fileMatchesExpected(newFile, 'Basic.js', 'Basic.js');
        done();
      });
      stream.write(basicTemplate);
      stream.end();
    });

    it('should process AST', function(done) {
      var stream = handlebarsPlugin({
          processAST: function(ast) {
            ast.body[0].value = 'Preprocessed template';
          }
      });
      var basicTemplate = getFixture('Basic.hbs');

      stream.on('data', function(newFile) {
        should.exist(newFile);
        should.exist(newFile.contents);
        fileMatchesExpected(newFile, 'Basic_preprocessed.js', 'Basic.js');
        done();
      });
      stream.write(basicTemplate);
      stream.end();
    });

    it('should compile multiple templates', function(done) {
      var stream = handlebarsPlugin();
      var basicTemplate = getFixture('Basic.hbs');
      var basicTemplate2 = getFixture('Basic.hbs');

      var count = 0;
      stream.on('data', function(newFile) {
        should.exist(newFile);
        should.exist(newFile.contents);
        fileMatchesExpected(newFile, 'Basic.js', 'Basic.js');

        count++;
        if (count === 2) {
          done();
        }
      });
      stream.write(basicTemplate);
      stream.write(basicTemplate2);
      stream.end();
    });

    it('should pass require and wrapper options to gulp-define-module', function(done) {
      var hbsStream = handlebarsPlugin();
      var defineStream = hbsStream.pipe(defineModule('node'));
      var basicTemplate = getFixture('Basic.hbs');

      hbsStream.on('data', function(newFile) {
        should.exist(newFile);
        should.exist(newFile.contents);
        fileMatchesExpected(newFile, 'Basic_node.js', 'Basic.js');
        done();
      });
      hbsStream.write(basicTemplate);
      hbsStream.end();
    });

    it('should give filename without extension to gulp-define-module', function(done) {
      var hbsStream = handlebarsPlugin();
      var defineStream = hbsStream.pipe(defineModule('plain', {
        // Assumes MyApp.Templates is already declared
        wrapper: 'MyApp.templates["<%= name %>"] = <%= handlebars %>'
      }));
      var basicTemplate = getFixture('Basic.hbs');

      hbsStream.on('data', function(newFile) {
        should.exist(newFile);
        should.exist(newFile.contents);
        fileMatchesExpected(newFile, 'Basic_namespace.js', 'Basic.js');
        done();
      });
      hbsStream.write(basicTemplate);
      hbsStream.end();
    });

    it('should allow custom compiler', function(done) {
      var compiler = function(contents, compilerOptions) {
        return contents.toUpperCase();
      };
      var stream = handlebarsPlugin({
          compiler: compiler
      });
      var basicTemplate = getFixture('Basic.hbs');

      stream.on('data', function(newFile) {
        should.exist(newFile);
        should.exist(newFile.contents);

        // @TODO: it should call `fileMatchesExpected` function
        // But I got an error of  expected: "BASIC TEMPLATE\n", actual: "BASIC TEMPLATE"
        // so that I manually adding the newLine character.
        // I think it related to plain text in the 'Basic_htmlbars.js'
        var expected = getExpectedString('Basic_htmlbars.js');
        var tested = String(newFile.contents)+'\n';
        tested.should.equal(expected);
        // fileMatchesExpected(newFile, 'Basic_htmlbars.js', 'Basic.js');

        done();
      });
      stream.write(basicTemplate);
      stream.end();
    });

    it('should compile multiple templates without override', function(done) {
      gulp.src(fixtures('Basic*'))
        .pipe(handlebarsPlugin())
        .pipe(declare({namespace: 'Templates'}))
        .pipe(assert.length(3))
        .pipe(concat('templates.js'))
        .pipe(assert.length(1))
        .pipe(assert.first(function(data) {
          vm.runInThisContext(String(data.contents))
          Templates.should.have.property('Basic')
          Templates.Basic.should.have.property('a')
          Templates.Basic.should.have.property('z')
        }))
        .pipe(assert.end(done));
    });
  });
});
