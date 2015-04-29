var config = require("../config/config.js");
var DataModel = require("../model/datamodel.js");
var RequestModel = require("../model/requestmodel.js");
var httpClient = require("./httpclient.js");

var moment = require("moment");

//Class Declaration

function Zendesk(){
    this.user = config.zendesk.user;
    this.pw = config.zendesk.pw;
    this.hostname = config.zendesk.hostname;
    this.path = config.zendesk.path;

    this.output = [];
    this.outputCount = 0;
    this.outputLimit = 0;
    
    this.ircCallback = function(){};
};

module.exports = function(data){
    return new Zendesk().set(data);
};

//Class Methods

Zendesk.prototype = DataModel();

//IRC Methods

Zendesk.prototype.ircRequest = function(Input){
    this.set({
        ircCallback: Input.callback,
        outputTo: Input.to,
        outputLimit: this.setOutputLimit(Input)
    });

    this.ircRouteRequest(Input);
};

Zendesk.prototype.ircRouteRequest = function(Input){
    //Checking Inbox
    if (Input.fullText == ""){
        var callback = this.ircInboxCheck.bind(this);
        this.checkInbox(callback);
    
    //Dealing with a Specific Case
    }else if (Input.case !== ""){
        if (["pass","take"].indexOf(Input.command) > -1){
            var command = Input.command;
            var caseID = Input.case;
            var callback = this.ircHandleMove.bind(this,command);

            if (Input.command == "take"){
                var zendeskID = Input.fromUser[0].zendesk;    
            }else if (Input.command == "pass"){
                var zendeskID = Input.users[0].zendesk;
            }
            this.moveCase(command,caseID,zendeskID,callback);
        }else{
            var caseID = Input.case;
            var callback = this.ircGetRequester.bind(this);
            this.getCase(caseID,callback);
        }
    
    //Dealing with a Specific Agent
    }else if (Input.users[0]){
        var zendeskID = Input.users[0].zendesk;
        var status = Input.status;
        var callback = this.ircGetRequester.bind(this);
        this.getCaseByAgent(zendeskID,status,callback);

    //Dealing with a Specific Organization (Unknown)
    }else if (Input.unused.length > 0){
        var name = Input.unused.join(" ");
        var status = Input.status;
        var callback = this.ircOrgSearch.bind(this,status);
        this.getOrg(name,callback);

    //Dealing with a Specific Status
    }else if (Input.status !== ""){
        var status = Input.status;
        var callback = this.ircGetRequester.bind(this);
        this.getCaseByStatus(status,callback);
    }
};

Zendesk.prototype.ircHandleMove = function(command,err,ticket){
    if (err){
        this.setOne("output","Bad Zendesk Response :(");  
    }else{
        if (ticket.id == undefined){
            this.setOne("output","Nothing found, sorry!");
        }else if (command == "pass"){
            this.setOne("output","Case "+ticket.id+" passed to "+this.getAgentByID(ticket.assignee_id)+" as "+this.toCapitalCase(ticket.status)+".");
        }else if (command == "take"){
            this.setOne("output","Case "+ticket.id+" taken by "+this.getAgentByID(ticket.assignee_id)+" as "+this.toCapitalCase(ticket.status)+".");
        }
    }
    this.ircOutputResult();
};

Zendesk.prototype.ircOrgSearch = function(status,err,organizations){
    if (err){
        this.setOne("output","Bad Zendesk Response :(");
        this.ircOutputResult();
    }else{
        if (organizations.length < 1){
            this.setOne("output","Nothing found, sorry!");
            this.ircOutputResult();
        }else{
            var org = organizations[0].name;
            var callback = this.ircGetRequester.bind(this);
            this.getCaseByOrg(org,status,callback);
        }
    }
};

Zendesk.prototype.ircInboxCheck = function(err,results){
    if (err){
        this.setOne("output","Bad Zendesk Response :(");
        this.ircOutputResult();
    }else{
        for (i = results.length-1; i>-1; i--){
            if (results[i].status !== "new"){
                results.splice(results.indexOf(results[i]),1);
            }
        }
        if (results.length < 1){
            this.setOne("output","[All clear!]");
            this.ircOutputResult();           
        }else if (results.length >= 1){
            this.ircGetRequester(null,results,false);
        }
    }
};

Zendesk.prototype.ircAutoInboxCheck = function(err,results){
    if (err){
        this.setOne("output","Zendesk Auto Inbox Check Failed :(");
        this.ircOutputResult();
    }else{
        for (i = results.length-1; i>-1; i--){
            var r = results[i];
            if (r.status !== "new"){
                results.splice(results.indexOf(r),1);
            }else if (!(moment(r.created_at).add(15,"minutes").isBefore() && moment(r.created_at).add(16,"minutes").isAfter())){
                results.splice(results.indexOf(r),1);
            }
        }
        if (results.length >= 1){
            this.ircGetRequester(null,results,true);
        }
    }
};

Zendesk.prototype.ircGetRequester = function(err,results,automated){
    if (err){
        this.setOne("output","Bad Zendesk Response :(");
        this.ircOutputResult();
    }else{
        if (results.length < 1){
            this.setOne("output","Nothing found, sorry!");
            this.ircOutputResult();
        }else{
            if (!(results instanceof Array)){
                results = Array(results);
            }
            results.forEach(getUser.bind(this));

            function getUser(elem,ind,arr){
                var requesterID = elem.requester_id;
                var caseInfo = elem;
                var callback = this.ircAssembleCases.bind(this,caseInfo,automated);
                this.getRequesterByCase(requesterID,callback)
            }
        }
    }
};

Zendesk.prototype.ircAssembleCases = function(caseInfo,automated,err,requester){
    if (err){
        this.setOne("output","Bad Zendesk Response :(");
    }else{
        var c = caseInfo;
        if (requester.email == null){ 
            requester.email = "Unknown" 
        }
        if (automated){
            this.setOne("output","--[ Support Team ] Unassigned Case Alert : Use '!zd take "+c.id+"'--");
            this.setOne("output",c.id+" | "+c.status.toUpperCase()+" | "+ this.getAgentByID(c.assignee_id) +" | "+c.subject+" | "+requester.email);
            this.setOne("output","https://sailthru.zendesk.com/agent/#/tickets/"+c.id);
        }else{
            this.setOne("output",c.id+" | "+c.status.toUpperCase()+" | "+ this.getAgentByID(c.assignee_id) +" | "+c.subject+" | "+requester.email);
            this.setOne("output","https://sailthru.zendesk.com/agent/#/tickets/"+c.id);
            this.outputCount++;
        }
    }
    this.ircOutputResult();
};

Zendesk.prototype.ircOutputResult = function(){
    if (this.outputCount <= this.outputLimit){
        this.ircCallback(this.output);
    }
    this.output = [];
};

//IRC Helper Methods

Zendesk.prototype.setOutputLimit = function(Input){
    return Input.fullText == "" ? 99 : (Input.range > 0 ? Input.range : 3);
}

Zendesk.prototype.getAgentByID = function(id){
    for (user in config.users){
        if (config.users[user].zendesk == id){
            return config.users[user].name;
        }
    }
    return "Unassigned";
};

Zendesk.prototype.toCapitalCase = function(word){
    return word.charAt(0).toUpperCase() + word.slice(1);
};

// API Methods
// getCase(), moveCase(), getCaseByAgent(), checkInbox(), getCaseByStatus(), getOrg(), getCaseByOrg(), getRequesterByCase()

Zendesk.prototype.getCase = function(caseID,callback){
    var options = {
        path: this.path + "/tickets/"+ caseID +".json",
    };
    this.httpsRequest("GET",options,callback);
};

Zendesk.prototype.moveCase = function(command,caseID,zendeskID,callback){
    var options = {
        path: this.path + "/tickets/"+ caseID + ".json",
        body: '{"ticket":{"status":"open","assignee_id":'+zendeskID+'}'
    };
    this.httpsRequest("PUT",options,callback);
};

Zendesk.prototype.getCaseByAgent = function(zendeskID,status,callback){
    var query = this.setQueryParams({
        query: {
            type: "ticket",
            status: status !== "" ? status : "open",
            assignee_id: zendeskID,
        },
        sort_by: "created_at"
    });

    var options = {
        path: this.path + "/search.json"+ query
    };
    this.httpsRequest("GET",options,callback);
};

Zendesk.prototype.checkInbox = function(callback){
    var query = this.setQueryParams({
        query: {
            type: "ticket",
            status: ["new","open"],
            group: "support",
            assignee: "none",
            created: ">"+moment().subtract(1,"days").format("YYYY-MM-DD")
        },
    });
    var options = {
        path: this.path + "/search.json" + query
    };
    this.httpsRequest("GET",options,callback);
};

Zendesk.prototype.getCaseByStatus = function(status,callback){
    var query = this.setQueryParams({
        query: {
            type: "ticket",
            status: status,
            group: "support"
        },
        sort_by: "created_at"
    });
    var options = {
        path: this.path + "/search.json"+ query
    };
    this.httpsRequest("GET",options,callback);
};

Zendesk.prototype.updateOrg = function(org,update,callback){
    var options = {
        path: this.path + "/organizations/"+org+".json",
        body: update
    };
    this.httpsRequest("PUT",options,callback);
};

Zendesk.prototype.deleteOrg = function(org,callback){
    var options = {
        path: this.path + "/organizations/"+org+".json"
    };
    this.httpsRequest("DELETE",options,callback);
};

Zendesk.prototype.getOrg = function(org,callback){
    var query = this.setQueryParams({
        name: org
    });
    var options = {
        path: this.path + "/organizations/autocomplete.json"+ query
    };
    this.httpsRequest("POST",options,callback);
};

Zendesk.prototype.getAllOrgs = function(callback){
    var options = {
        path: this.path + "/organizations.json"
    };
    this.httpsRequest("GET",options,callback);
};

Zendesk.prototype.getCaseByOrg = function(org,status,callback){
    var query = this.setQueryParams({
        query: {
            organization: org,
            group: ["support","none"],
            status: status !== "" ? status : "open",
            type: "ticket"
        },
        sort_by: "updated_at",
        sort_order: "desc"
    });
    var options = {
        path: this.path + "/search.json"+ query
    };
    this.httpsRequest("GET",options,callback);
};

Zendesk.prototype.getRequesterByCase = function(requesterID,callback){
    var options = {
        path: this.path + "/users/"+requesterID+".json",
    };
    this.httpsRequest("GET",options,callback);
};

Zendesk.prototype.httpsRequest = function(method,options,callback){
    var request = RequestModel({
        method: method,
        protocol: "HTTPS",
        hostname: this.hostname,
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Basic "+new Buffer(this.user+":"+this.pw).toString("base64"),
        },
        callback: this.httpsCatchResults.bind(this,callback)
    }).set(options);
    httpClient().request(request);
};

Zendesk.prototype.httpsCatchResults = function(callback,err,body,res){
    if (err){
        console.log(err,"Zendesk Request Error");
        callback(err);
    }else{
        try {
            var results = JSON.parse(body);
            var resultType = this.getResultType(results);
            var resultData = results[resultType];
            callback(null,resultData);
        } catch (err) {
            console.log(err,"Zendesk Response Error");
            callback(err);
        }
    }
};

//API Helper Methods
Zendesk.prototype.setQueryParams = function(params){
    var q = "?";
    var i = 0;

    for (p in params){
        i > 0 ? q += "&" : "";
        switch(p)
            {
            case "query":
                q += p + "=" + this.setQuery(params[p]);
                break;
            default:
                q += p + "=" + params[p];
                break;
            }
        i++;
    }
    return encodeURI(q);
};

Zendesk.prototype.setQuery = function(params){
    var q = "";
    var i = 0;

    for (p in params){
        i > 0 ? q += "+" : "";
        if (params[p] instanceof Array){

            params[p].forEach(multiAdd);

            function multiAdd(elem,ind,arr){
                ind > 0 ? q += "+" : "";
                q += p + ":" + elem;
            };   
        } else {
            switch (p)
                {
                case "created":
                    q += p + params[p];
                    break;
                default:
                    q += p + ":" + params[p];
                    break;
                }
        }
        i++;
    }
    return q;
};

Zendesk.prototype.getResultType = function(results){
    var resTypes = ["results","organizations","ticket","user"];
    for (r in results){
        var t = resTypes.indexOf(r);
        if (t > -1){
            return resTypes[t];
        }
    }
};