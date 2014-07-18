var http = require("http");
var https = require("https");

//Class Declaration

function httpClient(){
};

module.exports = function(){
	return new httpClient();
};

//Class Methods

httpClient.prototype.request = function(r){
    r.protocol == "HTTPS" ? this.httpsRequest(r) : this.httpRequest(r);
};

httpClient.prototype.httpRequest = function(r){
    var req = http.request(r.options(),this.addListeners(r.callback));

    req.on("error", function(err){ r.callback(err,null,req); });

    if (r.body){ req.write(r.body) }

    req.end();
};

httpClient.prototype.httpsRequest = function(r){
    var req = https.request(r.options(),this.addListeners(r.callback));

    req.on("error", function(err){ r.callback(err,null,req); });

    if (r.body){ req.write(r.body) }
        
    req.end();
};

httpClient.prototype.addListeners = function(callback){
    return function(res){
        var body = "";
    
        res.on('data', function(data) {
            body += data;
        });

        res.on('end', function(){ callback(null,body,res); });
        
        res.on('error', function(err){ callback(err,body,res); });
    };
};

