var config = require("../config/config.js");
var DataModel = require("../model/datamodel.js");
var RequestModel = require("../model/requestmodel.js");
var httpClient = require("./httpclient.js");

var sailthru = require("sailthru-client");
var moment = require("moment");
var cronJob = require("cron").CronJob;

//Class Declaration

function Monitor(){
    this.apikey = config.sailthru.key;
    this.apisecret = config.sailthru.secret;
    this.sailClient = sailthru.createSailthruClient(this.apikey,this.apisecret);

    this.output = [];

    this.monitor = [];

    this.retries = {};
    this.retryLimit = 3;
    this.retryDelay = 10000;

    this.ircCallback = function(){};
};

module.exports = function(data){
    return new Monitor().set(data);
};

//Class Methods

Monitor.prototype = DataModel();

//IRC Methods

Monitor.prototype.ircCheck = function(callback){
    this.setOne("ircCallback",callback);
    this.checkAll(this.handleResult.bind(this));
};

Monitor.prototype.handleResult = function(err,checkItem,body,res){
    if (err !== null){
        this.attemptRetry(checkItem,err);
    }else{
        switch(checkItem)
            {
            case "Link":
                this.handleLink(checkItem,body,res);
                break;
            case "MY":
                this.handleUI(checkItem,body,res);
                break;
            case "Feed":
            case "Horizon":
                this.handleJSONOK(checkItem,body,res);
                break;
            case "WWW":
            case "Support Site":
            case "Horizon Akamai":
                this.handleBasicOK(checkItem,body,res);
                break;
            }
    }
};

Monitor.prototype.handleLink = function(checkItem,body,res){
    var destinations = config.monitor.linkDestinations;
    if (destinations.indexOf(res.headers.location) === -1){
        this.attemptRetry(checkItem,"No Link Redirect in Response Headers");        
    }else{
        this.handleSuccess(checkItem);
    }
};

Monitor.prototype.handleUI = function(checkItem,body,res){
    if (res.statusCode !== 200 || body.indexOf("Sailthru") > -1){
        this.handleSuccess(checkItem);        
    }else{
        this.attemptRetry(checkItem,"UI Not Loading or Loading Blank");
    }
};

Monitor.prototype.handleAPI = function(checkItem,res,err){
    if (!err){
        this.handleSuccess(checkItem);        
    }else{
        this.attemptRetry(checkItem,err);
    }
};

Monitor.prototype.handleJSONOK = function(checkItem,body,res){
    if (res.statusCode == 200){
        try {
            JSON.parse(body);
        } catch (err) {
            this.attemptRetry(checkItem,err);
        }
        this.handleSuccess(checkItem);
    }else{
        this.attemptRetry(checkItem,"Received "+res.statusCode+" response.");
    }
};

Monitor.prototype.handleBasicOK = function(checkItem,body,res){
    if (res.statusCode == 200){
        this.handleSuccess(checkItem);
    }else{
        this.attemptRetry(checkItem,"Received "+res.statusCode+" response.");   
    }
};

Monitor.prototype.attemptRetry = function(checkItem,err){
    if (!this.contains("retries",checkItem)){
        this.retries[checkItem] = 1;
        console.log(moment().format("MM/DD LT")+" Attempting Retry "+this.retries[checkItem]+" for "+checkItem);
        console.log(err);
        setTimeout(this.checkOne.bind(this),this.retryDelay,checkItem,this.handleResult.bind(this));
    }else if (this.retries[checkItem] >= this.retryLimit){
        this.handleError(checkItem,err);
    }else if (this.retries[checkItem] < this.retryLimit){
        this.retries[checkItem]++;
        console.log(moment().format("MM/DD LT")+" Attempting Retry "+this.retries[checkItem]+" for "+checkItem);
        console.log(err);
        setTimeout(this.checkOne.bind(this),this.retryDelay,checkItem,this.handleResult.bind(this));
    }
};

Monitor.prototype.handleSuccess = function(checkItem){
    var c = checkItem;
    var r = this.retries[c];

    if (this.inMonitor(c)){
        if (r > 0){
            this.retries[c]--;
            console.log(moment().format("MM/DD LT")+" Successful Retry: Reducing to "+this.retries[checkItem]+" for "+checkItem);
            setTimeout(this.checkOne.bind(this),this.retryDelay,checkItem,this.handleResult.bind(this));       
        }else{
            this.resolveIRCAlert(c);
            this.clearMonitor(c);
        }
    }else if (r > 0){
        this.retries[c]--;
        console.log(moment().format("MM/DD LT")+" Successful Retry: Reducing to "+this.retries[checkItem]+" for "+checkItem);
    }
};

Monitor.prototype.handleError = function(checkItem,err){
    var c = checkItem;
    var now = moment();

    if (this.inMonitor(c)){
        console.log(moment().format("MM/DD LT")+" !! "+c+" still failing after "+this.retries[c]+" retries.");
        console.log(err);
        this.updateMonitorTime(c,now);
        this.retries[c] % 20 === 0 ? this.ongoingIRCAlert(c) : true;
    }else{
        this.addToMonitor(checkItem,now);
        this.newIRCAlert(checkItem);
    }
    this.retries[c]++;
};  

Monitor.prototype.inMonitor = function(checkItem){
    if (this.contains("monitor",checkItem)){
        return true;
    }
    return false;
};

Monitor.prototype.addToMonitor = function(checkItem,now){
    this.monitor[checkItem] = {
        startTime: now,
        lastCheck: now,
        message: "[ALERT] Stability Check for "+checkItem+" failing since "+now.format("LT")
    };
};

Monitor.prototype.updateMonitorTime = function(checkItem,now){
    this.monitor[checkItem].lastCheck = now;
};

Monitor.prototype.getOutageTime = function(checkItem){
    var m = this.monitor[checkItem];
    return moment(m.lastCheck).diff(m.startTime,"minutes");
};

Monitor.prototype.clearMonitor = function(checkItem){
    delete this.monitor[checkItem];
};

Monitor.prototype.checkMonitor = function(){
    var output = ["--[Stability Monitor]--"];

    for (m in this.monitor){
        output.push(this.monitor[m].message);
    }

    if (output.length === 1){
        return ["[All clear!]"];
    }else{
        return output;
    }
};

Monitor.prototype.newIRCAlert = function(checkItem){
    console.log(moment().format("MM/DD LT")+" !! Issuing Alert for "+checkItem);
    this.setOne("output","--[ Support Team ] ALERT: Stability Check for "+checkItem+" failed after "+this.retries[checkItem]+" retries.");
    this.ircOutputResult();
};

Monitor.prototype.ongoingIRCAlert = function(checkItem){
    var start = this.monitor[checkItem].startTime;
    this.setOne("output","--[ Support Team ] ALERT: Stability Check for "+checkItem+" failing since "+start.format("LT")+" after "+this.retries[checkItem]+" retries.");
    this.ircOutputResult();
};

Monitor.prototype.resolveIRCAlert = function(checkItem){
    console.log(moment().format("MM/DD LT")+" !! Resolving Alert for "+checkItem+" after "+this.getOutageTime(checkItem)+" minutes.");
    this.setOne("output","--[ Support Team ] RESOLVED: Stability Check for "+checkItem+" resolved after "+this.getOutageTime(checkItem)+" minutes.");
    this.ircOutputResult();
};

Monitor.prototype.ircOutputResult = function(){
    this.ircCallback(this.output);
    this.output = [];
};

//API Methods

Monitor.prototype.checkAll = function(callback){
    this.checkLink(callback);
    this.checkFeed(callback);    
    this.checkHorizon(callback);
    this.checkHorizonFile(callback);
    this.checkWWW(callback);
    this.checkMY(callback);   
    this.checkSupport(callback);
    this.checkAPI(this.handleAPI.bind(this));
};

Monitor.prototype.checkOne = function(checkItem,callback){
    switch (checkItem)
        {
        case "Link":
            this.checkLink(callback);  
            break;
        case "Feed":
            this.checkFeed(callback);
            break;
        case "Horizon":
            this.checkHorizon(callback);
            break;
        case "Horizon Akamai":
            this.checkHorizonFile(callback);
            break;
        case "WWW":    
            this.checkWWW(callback);
            break;
        case "MY":    
            this.checkMY(callback);
            break;
        case "Support Site":
            this.checkSupport(callback);
            break;
        default:
            if (checkItem.indexOf("API") > -1){
                this.checkAPI(this.handleAPI.bind(this));
            }
        }
};

Monitor.prototype.checkLink = function(callback){
    var paths = config.monitor.linkPaths;

    paths.forEach(check.bind(this));

    function check(elem,ind,arr){
        var request = RequestModel({
            method: "GET",
            protocol: "HTTP",
            hostname: "cb.sailthru.com",
            path: elem,
            callback: this.httpCatchResults.bind(this,callback,"Link")
        });

        httpClient().request(request);
    }
};

Monitor.prototype.checkFeed = function(callback){
    var request = RequestModel({
        method: "GET",
        protocol: "HTTP",
        hostname: "cb.sailthru.com",
        path: config.monitor.feedPath,
        callback: this.httpCatchResults.bind(this,callback,"Feed")
    });

    httpClient().request(request);
};

Monitor.prototype.checkHorizon = function(callback){
    var request = RequestModel({
        method: "GET",
        protocol: "HTTP",
        hostname: "horizon.huffingtonpost.com",
        path: config.monitor.horizonPath,
        callback: this.httpCatchResults.bind(this,callback,"Horizon")
    });

    httpClient().request(request);
};

Monitor.prototype.checkHorizonFile = function(callback){
    var request = RequestModel({
        method: "GET",
        protocol: "HTTP",
        hostname: "ak.sail-horizon.com",
        path: config.monitor.akamaiPath,
        callback: this.httpCatchResults.bind(this,callback,"Horizon Akamai")
    });

    httpClient().request(request);
};

Monitor.prototype.checkWWW = function(callback){
    var request = RequestModel({
        method: "GET",
        protocol: "HTTP",
        hostname: "www.sailthru.com",
        callback: this.httpCatchResults.bind(this,callback,"WWW")
    });

    httpClient().request(request);
};

Monitor.prototype.checkMY = function(callback){
    var request = RequestModel({
        method: "GET",
        protocol: "HTTPS",
        hostname: "my.sailthru.com",
        path: "/login",
        callback: this.httpCatchResults.bind(this,callback,"MY")
    });

    httpClient().request(request);
};

Monitor.prototype.checkSupport = function(callback){
    var request = RequestModel({
        method: "GET",
        protocol: "HTTP",
        hostname: "www.sailthru-support.com",
        callback: this.httpCatchResults.bind(this,callback,"Support Site")
    });
    
    httpClient().request(request);
};

Monitor.prototype.checkAPI = function(callback){
    var c = config.monitor;
    var getMethods = c.getMethods;
    var postMethods = c.postMethods;
    var getData = c.getData;
    var postData = c.postData;
    var widget = c.widget;

    for (i=0;i<5;i++){
        this.sailClient.apiGet(getMethods[i],getData[i],callback.bind(this,"API GET "+this.toCapitalCase(getMethods[i])));
        this.sailClient.apiPost(postMethods[i],postData[i],callback.bind(this,"API POST "+this.toCapitalCase(postMethods[i])));        
    }
};

Monitor.prototype.httpCatchResults = function(callback,checkItem,err,body,res){
    if (err){
        callback(err,checkItem);
    }else{
        callback(null,checkItem,body,res);
    }
};

//API Helper Methods

Monitor.prototype.toCapitalCase = function(word){
    return word.charAt(0).toUpperCase() + word.slice(1);
};
