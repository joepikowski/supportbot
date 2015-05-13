var config = require("../config/config.js");
var DataModel = require("../model/datamodel.js");
var RequestModel = require("../model/requestmodel.js");
var httpClient = require("./httpclient.js");

//Class Declaration

function Giphy(){
    this.hostname = config.giphy.hostname;
    this.path = config.giphy.path;
    this.api_key = config.giphy.api_key;

    this.output = [];
    this.ircCallback = function(){};
};

module.exports = function(data){
    return new Giphy().set(data);
};

//Class Methods

Giphy.prototype = DataModel();

//IRC Methods

Giphy.prototype.ircRequest = function(Input){
    this.setOne("ircCallback",Input.callback);
    var input = Input.fullText;
    var callback = this.ircAssembleResults.bind(this);
    this.getGif(input,callback);
};

Giphy.prototype.ircAssembleResults = function(err,res){
    if (err){
        this.setOne("output","Bad Giphy Response :(");
    }else{
        try {
            var r = Math.floor(Math.random() * res.data.length);
            console.log(r);
            var gif = res.data[r].images.original.url;
            this.setOne("output",gif);
        } catch(err) {
            this.setOne("output","Couldn't Find a GIF! :(");
        }
    }
    console.log(this.output);
    this.ircOutputResult();
};

Giphy.prototype.ircOutputResult = function(){
    this.ircCallback(this.output);
    this.output = [];
};

// API Methods

Giphy.prototype.getGif = function(input,callback){
    var query = this.setQueryParams({
        q: input,
        api_key: this.api_key
    });
    var options = {
        path: this.path + query
    };
    this.httpRequest("GET",options,callback);
};

Giphy.prototype.httpRequest = function(method,options,callback){
    var request = RequestModel({
        method: method,
        protocol: "HTTP",
        hostname: this.hostname,
        callback: this.httpCatchResults.bind(this,callback)
    }).set(options);
    httpClient().request(request);
};

Giphy.prototype.httpCatchResults = function(callback,err,body,res){
    if (err){
        callback(err);
    }else{
        try {
            var results = JSON.parse(body);
            callback(null,results);
        } catch(err) {
            console.log(err,"Giphy Response Error");
            callback(err);
        }
    }
};

//API Helper Methods
Giphy.prototype.setQueryParams = function(params){
    var q = "?";
    var i = 0;
    for (p in params){
        i > 0 ? q += "&" : "";
        q += p + "=" + params[p];
        i++;
    }
    return encodeURI(q);
};
