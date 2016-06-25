'use strict';

var fs = require('fs'),
    async = require('./bower_components/async'),
    carrier = require('carrier'),
    EventBus = require('eventbusjs'),
    readline = require('linebyline'),
    eventStream = require('event-stream'),
    reduce = require("stream-reduce"),
    fse = require('fs-extra');


var langRegex = /^(\S*)\s*\=\s*(\"(.*)\"|[0-9]*)$/;

//i18n("./ressources/langs", "./ressources/input", "./ressources/output");

exports.i18n = function(langDirectory, inputDirectory, outputDirectory){
  eventStream.readArray(getFilesInPath(langDirectory))
    .pipe(eventStream.map(function (fileName, callback) {
          processLangFile(fileName, callback);
      }))
    .pipe(eventStream.map(function (dictionary, callback) {
          applyDictionaryToDirectory(
            dictionary.data,
            inputDirectory,
            outputDirectory,
            dictionary.lang,
            {}
          )
      }))
}

function processLangFile(fileName, callback){
  var a = fs.createReadStream(fileName, {flags: "r"})
    .pipe(eventStream.split())
    .pipe(eventStream.map(function (line, callback) {
        if(langRegex.test(line)){
          callback(null, line);
        }else{
          callback();
        }
      }))
    .pipe(reduce(function(acc, line) {
        // console.log(line);
        var key = line.substr(0, line.indexOf('=')).trim();
        var value = line
                      .substr(line.indexOf('=') + 1)
                      .replace(/\"/g, "")
                      .trim();
        acc[key] = value;
        return acc;
      }, {}))
      .on("data", function(obj) {
        var file = fileName.substr(fileName.lastIndexOf('/') + 1);
        var lang = file.substr(0, file.length - ".conf".length);
        callback(null, {
          data: obj,
          lang: lang
        });
      });
}

function applyDictionaryToDirectory(dictionary, inputDir, outputDir, lang, acceptedExtentions){
  // var path = process.cwd()
  var path = "./ressources/input";

  var acceptedExt = "html";

  eventStream.readArray(getFilesInPath(path))
    .pipe(eventStream.map(function (fileName, callback) {
        if(stringEndsWith(fileName, '.' + acceptedExt)){
          callback(null, fileName.substr(path.length + 1));
        }else{
          callback();
        }
      }))
    .pipe(eventStream.map(function (fileName, callback) {
      applyDictionaryToFile(fileName, inputDir, outputDir, lang, dictionary);
      callback(null, fileName);
    }))

}

function applyDictionaryToFile(fileName, inputDir, outputDir, lang, dictionary){

  inputDir = stringEndsWith(inputDir, '/') ? inputDir : inputDir + '/';
  outputDir = stringEndsWith(outputDir, '/') ? outputDir : outputDir + '/';

  console.log("Processing " + inputDir + fileName);

  var folder = outputDir + lang;

  console.log("Deleting " + folder);
  if(folder.length > 6 && lang.length >= 2){
    fse.removeSync(folder);
  }else{
    console.log("I rather prefer do not remove. This this path is souspicious " + folder);
  }
  console.log("Create " + folder);
  fs.mkdirSync(folder);

  var input = fs.createReadStream(inputDir + fileName, {flags: "r"});
  var output = fs.createWriteStream(folder + "/" + fileName, {flags: "w"});
  var regex = /\{\{(.*?)\}\}/g;

  input
    .pipe(eventStream.split())
    .pipe(eventStream.map(function (line, callback) {
        callback(null, processLine(line) + '\n');
      }))
    .pipe(output);

  function processLine(line){
    var newLine = line.replace(regex, function(enclosedKey, key){
      var value = dictionary[key];
      if (value == undefined){
        console.log("i18n WARNING : `" + key + "` is not defined");
        value = "";
      }
      return value;
    });
    return newLine;
  }
}



// Utils
function getFilesInPath(path, files){
    var files = files == undefined ? [] : files;
    fs.readdirSync(path).forEach(function(file){
        var subpath = path + '/' + file;
        if(fs.lstatSync(subpath).isDirectory()){
            getFilesInPath(subpath, files);
        } else {
            files.push(path + '/' + file);
        }
    });
    return files;
}

function stringEndsWith(string, end){
  return string.substr(-end.length) === end;
}
