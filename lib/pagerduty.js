var config = require("../config/config.js");
var DataModel = require("../model/datamodel.js");
var RequestModel = require("../model/requestmodel.js");
var httpClient = require("./httpclient.js");
var moment = require("moment");

//Class Declaration

function Pagerduty(){
    //this.appid = config.pagerduty.appid;
    this.hostname = config.pagerduty.hostname;
    this.path = config.pagerduty.path;
    this.token = config.pagerduty.token;

    this.output = [];
    this.outputCount = 0;
    this.outputLimit = 0;

    this.chatCallback = function(){};
};

module.exports = function(data){
    return new Pagerduty().set(data);
};

//Class Methods

Pagerduty.prototype = DataModel();

//Chat Methods

Pagerduty.prototype.chatRequest = function(Input){
    this.set({
        chatCallback: Input.callback,
        outputTo: Input.to,
    });
    var input = Input.fullText;
    var callback = this.chatAssembleResults.bind(this);
    this.getPlainText(input,callback);
};

Pagerduty.prototype.chatAssembleResults = function(err,res){
    if (err){
        this.setOne("output","Bad Pagerduty Response :(");
        this.chatOutputResult();
    }else{
        var user = res.users[0].name;
        this.setOne("output",user+" is currently on duty for SRE.");
        this.chatOutputResult();
    }
};

Pagerduty.prototype.chatOutputResult = function(){
    if (this.outputCount <= this.outputLimit){
        this.chatCallback(this.output);
    }
    this.output = [];
};

// API Methods

Pagerduty.prototype.getPlainText = function(input,callback){
    var now = moment().toISOString();
    var now5 = moment().add(1,"minute").toISOString();
    
    var query = this.setQueryParams({
        /* This was for Wolfram; not sure if needed for PD
        appid: this.appid,
        input: input,
        format: "plaintext"
        */
        // TK Time needs to be current time in UTC YYYY-MM-DDTHH:mm:ssZ
        // Remember to set the "until" parameter to be 5 mins later
        since: now,
        until: now5
    });
    var options = {
        path: this.path + query
    };
    this.httpsRequest("GET",options,callback);
};

Pagerduty.prototype.httpsRequest = function(method,options,callback){
    var request = RequestModel({
        method: method,
        protocol: "HTTPS",
        hostname: this.hostname,
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Token "+this.token
        },
        callback: this.httpsCatchResults.bind(this,callback)
    }).set(options);
    httpClient().request(request);
};

Pagerduty.prototype.httpsCatchResults = function(callback,err,body,res){
    if (err){
        callback(err);
    }else{
        try {
            var res = JSON.parse(body);
            callback(null,res);
        } catch(err) {
            console.log(err,"Bad Response from Pagerduty Alpha API");
            callback(err);
        }
    }
};

//API Helper Methods
//Takes query parameters and appends them to the end, using &
Pagerduty.prototype.setQueryParams = function(params){
    var q = "?";
    var i = 0;
    for (p in params){
        i > 0 ? q += "&" : "";
        q += p + "=" + params[p];
        i++;
    }
    return encodeURI(q);
};
