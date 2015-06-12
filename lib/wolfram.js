var config = require("../config/config.js");
var DataModel = require("../model/datamodel.js");
var RequestModel = require("../model/requestmodel.js");
var httpClient = require("./httpclient.js");

var xmlParse = require("xml2js").parseString;

//Class Declaration

function Wolfram(){
    this.appid = config.wolfram.appid;
    this.hostname = config.wolfram.hostname;
    this.path = config.wolfram.path;

    this.output = [];
    this.outputCount = 0;
    this.outputLimit = 0;

    this.chatCallback = function(){};
};

module.exports = function(data){
    return new Wolfram().set(data);
};

//Class Methods

Wolfram.prototype = DataModel();

//Chat Methods

Wolfram.prototype.chatRequest = function(Input,verbose){
    this.set({
        chatCallback: Input.callback,
        outputTo: Input.to,
        outputLimit: verbose ? 10 : 2 
    });
    var input = Input.fullText;
    var callback = this.chatAssembleResults.bind(this);
    this.getPlainText(input,callback);
};

Wolfram.prototype.chatAssembleResults = function(err,res){
    if (err){
        this.setOne("output","Bad Wolfram Alpha Response :(");
        this.chatOutputResult();
    }else{
        var results = res.queryresult;
        if (results.$.success === "false"){
            if (results.didyoumeans){
                this.setOne("output","Did you mean '"+results.didyoumeans[0].didyoumean[0]._+"'?");
            }else{
                this.setOne("output","Sorry, couldn't find anything!");
            }
            this.chatOutputResult();
        }else{
            results.pod.forEach(assembleLines.bind(this));
        }

        function assembleLines(elem,ind,arr){
            if (elem.subpod[0].plaintext[0] === ""){
                this.outputCount++;
            }else{
                this.setOne("output","["+elem.$.title.toUpperCase()+"]: "+elem.subpod[0].plaintext[0].replace(/\s+/g," "));
                this.outputCount++;
                this.chatOutputResult();
            }
        };
    }
};

Wolfram.prototype.chatOutputResult = function(){
    if (this.outputCount <= this.outputLimit){
        this.chatCallback(this.output);
    }
    this.output = [];
};

// API Methods

Wolfram.prototype.getPlainText = function(input,callback){
    var query = this.setQueryParams({
        appid: this.appid,
        input: input,
        format: "plaintext"
    });
    var options = {
        path: this.path + query
    };
    this.httpsRequest("GET",options,callback);
};

Wolfram.prototype.httpsRequest = function(method,options,callback){
    var request = RequestModel({
        method: method,
        protocol: "HTTPS",
        hostname: this.hostname,
        callback: this.httpsCatchResults.bind(this,callback)
    }).set(options);
    httpClient().request(request);
};

Wolfram.prototype.httpsCatchResults = function(callback,err,body,res){
    if (err){
        callback(err);
    }else{
        try {
            xmlParse(body,callback);
        } catch(err) {
            console.log(err,"Bad Response from Wolfram Alpha API");
            callback(err);
        }
    }
};

//API Helper Methods
Wolfram.prototype.setQueryParams = function(params){
    var q = "?";
    var i = 0;
    for (p in params){
        i > 0 ? q += "&" : "";
        q += p + "=" + params[p];
        i++;
    }
    return encodeURI(q);
};