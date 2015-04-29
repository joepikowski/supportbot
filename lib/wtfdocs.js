var config = require("../config/config.js");
var DataModel = require("../model/datamodel.js");
var RequestModel = require("../model/requestmodel.js");
var httpClient = require("./httpclient.js");
var URL = require("url");

var google = require("googleapis");
var OAuth2Client = google.auth.OAuth2;
var drive = google.drive("v2");

//Class Declaration

function WtfDocs(){
    this.clientID = config.wtfdocs.clientID;
    this.clientSecret = config.wtfdocs.clientSecret;
    this.account = config.wtfdocs.account;
    this.fileID = config.wtfdocs.fileID;

    this.oauth2Client = new OAuth2Client(this.clientID,this.clientSecret)
    this.oauth2Client.credentials = {
        access_token:  config.wtfdocs.access_token,
        refresh_token: config.wtfdocs.refresh_token
    };

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
    this.getWTFExportURL(this.getFileByExportURL.bind(this,this.ircGetWTFLine.bind(this)));
};

WtfDocs.prototype.getFileByExportURL = function(httpCallback,err,res){
    if (err){
        this.setOne("output","Bad WTF Docs Request :(");
    }else{
        try {
            var fileURL = res.exportLinks["text/csv"];
            this.getWTFFile(fileURL,httpCallback);
        } catch(err) {
            this.setOne("output","Bad WTF Docs Response :(");
        }
    }
    this.ircOutputResult();
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

WtfDocs.prototype.getWTFExportURL = function(apiCallback){
    var query = {
        auth: this.oauth2Client,
        fileId: this.fileID,
        fields: "exportLinks"
    };
    this.getDriveExportById(query,apiCallback);
};

WtfDocs.prototype.getDriveExportById = function(query,apiCallback){
    drive.files.get(query,apiCallback);
};

//HTTP Methods

WtfDocs.prototype.getWTFFile = function(url,callback){
    var u = URL.parse(url);
    var options = {
        hostname: u.hostname,
        path: u.path
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
