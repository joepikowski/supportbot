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
    this.chatCallback = function(){};
};

module.exports = function(data){
    return new WtfDocs().set(data);
};

//Class Methods

WtfDocs.prototype = DataModel();

//Chat Methods

WtfDocs.prototype.chatRequest = function(Input){
    this.setOne("chatCallback",Input.callback);
    this.getWTFExportURL(this.getFileByExportURL.bind(this,this.chatGetWTFLine.bind(this)));
};

WtfDocs.prototype.getFileByExportURL = function(httpCallback,err,res){
    if (err){
        if (err.code === 401){
            this.oauth2Client.refreshAccessToken(requeue.bind(this));
            function requeue(err,tokens){
                if (err){
                    console.log(err,"Google Drive API Request Error");
                    this.setOne("output","Bad WTF Docs Request :(");
                }else{
                    this.getWTFExportURL(this.getFileByExportURL.bind(this,this.chatGetWTFLine.bind(this)));
                }
            }
        }else{
            console.log(err,"Google Drive API Request Error");
            this.setOne("output","Bad WTF Docs Request :(");
        }
    }else{
        try {
            var fileURL = res.exportLinks["text/csv"];
            this.getWTFFile(fileURL,httpCallback);
        } catch(err) {
            console.log(err,"Google Drive API Response Error");
            this.setOne("output","Bad WTF Docs Response :(");
        }
    }
    this.chatOutputResult();
};

WtfDocs.prototype.chatGetWTFLine = function(err,body,res){
    if (err){
        console.log(err,"Google Drive File Request Error");
        this.setOne("output","Bad WTF Docs Request :(");
    }else{
        try {
            var lines = body.split("\n");
            var r = Math.floor((Math.random() * lines.length) + 1);
            this.setOne("output",lines[r]);
        } catch(err) {
            console.log(err,"Google Drive File Response Error");
            this.setOne("output","Bad WTF Docs Response :(");
        }
    }
    this.chatOutputResult();
};

WtfDocs.prototype.chatOutputResult = function(){
    this.chatCallback(this.output);
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
