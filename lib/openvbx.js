var config = require("../config/config.js");
var DataModel = require("../model/datamodel.js");
var RequestModel = require("../model/requestmodel.js");
var httpClient = require("./httpclient.js");

//Class Declaration

function OpenVBX(){
    this.user = config.openvbx.user;
    this.pw = config.openvbx.pw;
    this.hostname = config.openvbx.hostname;
    this.path = config.openvbx.path;

    this.output = [];
    this.outputLimit = 0;

    this.command = "";
    this.success = [];
    this.failure = [];

    this.ircCallback = function(){};
};

module.exports = function(data){
    return new OpenVBX().set(data);
};

//Class Methods

OpenVBX.prototype = DataModel();

//IRC Methods

OpenVBX.prototype.ircRequest = function(Input){
    this.set({
        ircCallback: Input.callback,
        outputTo: Input.to,
        command: Input.command
    });
    this.ircRouteRequest(Input);
};

OpenVBX.prototype.ircRouteRequest = function(Input){
    var c = Input.command;
    if (c == "on" || c == "off"){
        this.ircChangeUserStatus(Input);
    }else{
        this.getGroupUsers("users",this.ircAssembleGroupResult.bind(this));
    }
}

OpenVBX.prototype.ircChangeUserStatus = function(Input){
    if (Input.users.length < 1){
        var users = Input.fromUser;
    } else {
        var users = Input.users;
    }
    if (Input.command == "on"){
        var command = "add"; 
        var rCommand = "delete";
    }else if (Input.command == "off"){
        var command = "delete";
        var rCommand = "add";
    }
    users.forEach(makeRequest.bind(this,command,false));

    function makeRequest(method,reverse,elem,ind,arr){
        var vbxID = elem.vbx;
        var name = elem.name;
        var callback = this.ircLogChangeResult.bind(this,method,name,reverse);
        this.outputLimit++;
        this.changeUserStatus(method,vbxID,callback)
    }

    if (Input.options.indexOf("only") > -1){
        var otherUsers = this.getAllOtherUsers(users);
        otherUsers.forEach(makeRequest.bind(this,rCommand,true));
    }
};

OpenVBX.prototype.ircLogChangeResult = function(method,name,reverse,err,results){
    if (err || results.error === true){
        this.failure.push(this.toCapitalCase(name));
    }else{
        if (!reverse){
            this.success.push(this.toCapitalCase(name));
        }else if (reverse){
            this.outputLimit--;
        }
    }
    if (this.requestComplete()){
        this.ircAssembleChangeResult();
    }
};

OpenVBX.prototype.ircAssembleChangeResult = function(){
    if (this.command === "off"){
        var command = "Remove";
    } else if (this.command === "on"){
        var command = "Add";
    }
    if (this.success.length > 0){
        this.output.push(command+" successful for: "+this.success.join(", "));
    }
    if (this.failure.length > 0){
        this.output.push(command+" failed for: "+this.failure.join(", "));
    }
    this.ircOutputResult();
};

OpenVBX.prototype.ircAssembleGroupResult = function(err,results){
    if (err || results.error === true){
        this.setOne("output","Bad OpenVBX Response :(");
    }else if (results.length > 0){
        var IDs = results;
        var names = [];
        for (u in config.users){
            if (IDs.indexOf(config.users[u].vbx) > -1){
                names.push(config.users[u].name);
            }
        }
        this.setOne("output","[On VBX]: "+names.join(", "));
    }else{
        this.setOne("output","[]");
    }
    this.ircOutputResult();
};

OpenVBX.prototype.ircOutputResult = function(){
    this.ircCallback(this.output);
    this.output = [];
};

//IRC Helper Methods

OpenVBX.prototype.toCapitalCase = function(word){
    return word.charAt(0).toUpperCase() + word.slice(1);
};

OpenVBX.prototype.requestComplete = function(){
    return (this.success.length + this.failure.length === this.outputLimit);
};

OpenVBX.prototype.getAllOtherUsers = function(users){
    var names = this.namesToArray(users);
    var otherUsers = [];
    
    for (u in config.users){
        if (names.indexOf(config.users[u].name) === -1){
            otherUsers.push(config.users[u]);
        }
    }
    return otherUsers;
};

OpenVBX.prototype.namesToArray = function(users){
    var names = [];
    users.forEach(addName);

    function addName(elem,ind,arr){
        names.push(elem.name);
    }
    return names;
};

//API Methods
OpenVBX.prototype.addUser = function(vbxID,callback){
    this.changeUserStatus("add",vbxID,callback);
};

OpenVBX.prototype.removeUser = function(vbxID,callback){
    this.changeUserStatus("delete",vbxID,callback);
};

OpenVBX.prototype.getGroupUsers = function(method,callback){
    var body = this.setBody({
        group_id: 2
    });
    var options = {
        body: body,
        path: this.path + "/group/" + method,
        headers: {
            "Content-Length": body.length
        }
    };
    this.httpsRequest("POST",options,callback);
};

OpenVBX.prototype.changeUserStatus = function(method,vbxID,callback){
    var body = this.setBody({
        group_id: 2,
        user_id: vbxID
    });
    var options = {
        body: body,
        path: this.path + "/group_user/" + method,
        headers: {
            "Content-Length": body.length
        }
    };
    this.httpsRequest("POST",options,callback);
};

OpenVBX.prototype.httpsRequest = function(method,options,callback){
    var request = RequestModel({
        method: method,
        protocol: "HTTP",
        hostname: this.hostname,
        headers: {
            "Accept": "application/json",
            "Authorization": "Basic "+new Buffer(this.user+":"+this.pw).toString("base64"),
            "Content-Type": "application/x-www-form-urlencoded",
        },
        callback: this.httpsCatchResults.bind(this,callback)
    }).set(options);

    httpClient().request(request);
};

OpenVBX.prototype.httpsCatchResults = function(callback,err,body,res){
    if (err){
        callback(err);
    }else{
        try {
            var results = JSON.parse(body);
            callback(null,results);
        } catch (err) {
            console.log(err,"OpenVBX Request Error");
            callback(err);
        }
    }
};

//API Helper Methods

OpenVBX.prototype.setBody = function(params){
    var q = "";
    var i = 0;
    for (p in params){
        i > 0 ? q += "&" : "";
        q += p + "=" + params[p];
        i++;
    }
    return q;
};
