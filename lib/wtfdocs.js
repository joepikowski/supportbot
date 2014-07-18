var config = require("../config/config.js");
var DataModel = require("../model/datamodel.js");
var RequestModel = require("../model/requestmodel.js");
var httpClient = require("./httpclient.js");

//Class Declaration

function WtfDocs(){
    this.hostname = config.wtfdocs.hostname;
    this.path = config.wtfdocs.path;

    this.output = [];
    this.ircCallback = function(){};
};

module.exports = function(data){
    return new WtfDocs().set(data);
};

//Class Methods

WtfDocs.prototype = DataModel();

//IRC Methods

WtfDocs.prototype.ircRequest = function(Input){
    this.setOne("ircCallback",Input.callback);
    this.getWTFDoc(this.ircGetWTFLine.bind(this));
};

WtfDocs.prototype.ircGetWTFLine = function(err,body,res){
    if (err){
        this.setOne("output","Bad WTF Docs Request :(");
    }else{
        try {
            var lines = body.split("\n");
            var r = Math.floor((Math.random() * lines.length) + 1);
            this.setOne("output",lines[r]);
        } catch(err) {
            this.setOne("output","Bad WTF Docs Response :(");
        }
    }
    this.ircOutputResult();
};

WtfDocs.prototype.ircOutputResult = function(){
    this.ircCallback(this.output);
    this.output = [];
};

//API Methods

WtfDocs.prototype.getWTFDoc = function(callback){
    var options = {
        hostname: this.hostname,
        path: this.path
    };
    this.httpsRequest("GET",options,callback);
};

WtfDocs.prototype.httpsRequest = function(method,options,callback){
    var request = RequestModel({
        method: method,
        protocol: "HTTPS",
        callback: this.httpsCatchResults.bind(this,callback)
    }).set(options);

    httpClient().request(request);
};

WtfDocs.prototype.httpsCatchResults = function(callback,err,body,res){
    if (err){
        callback(err);
    }else{
        callback(null,body,res);
    }
};