var config = require("../config/config.js");
var DataModel = require("../model/datamodel.js");
var RequestModel = require("../model/requestmodel.js");
var httpClient = require("./httpclient.js");

//Class Declaration

function Pagerduty(){
    //this.appid = config.pagerduty.appid;
    this.hostname = config.pagerduty.hostname;
    this.path = config.pagerduty.path;

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
        this.setOne("output","Bad Pagerduty Alpha Response :(");
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

Pagerduty.prototype.chatOutputResult = function(){
    if (this.outputCount <= this.outputLimit){
        this.chatCallback(this.output);
    }
    this.output = [];
};

// API Methods

Pagerduty.prototype.getPlainText = function(input,callback){
    var now = new Date();
    var now5 = new Date()+300;
    var query = this.setQueryParams({
        /* This was for Wolfram; not sure if needed for PD
        appid: this.appid,
        input: input,
        format: "plaintext"
        */
        // TK Time needs to be current time in UTC YYYY-MM-DDTHH:mm:ssZ
        // Remember to set the "until" parameter to be 5 mins later
        since: now.toISOString();
        until: now5.toISOString();
    });
    var options = {
        path: this.path + query
    };
    this.httpsRequest("POST",options,callback);
};

Pagerduty.prototype.httpsRequest = function(method,options,callback){
    var request = RequestModel({
        method: method,
        protocol: "HTTPS",
        hostname: this.hostname,
        callback: this.httpsCatchResults.bind(this,callback)
    }).set(options);
    httpClient().request(request);
};

Pagerduty.prototype.httpsCatchResults = function(callback,err,body,res){
    if (err){
        console.log(err);
        callback(err);
    }else{
        try {
            callback(res);
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
