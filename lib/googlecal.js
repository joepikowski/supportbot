var config = require("../config/config.js");
var DataModel = require("../model/datamodel.js");

var googleapis = require("googleapis");
var OAuth2Client = googleapis.OAuth2Client;
var moment = require("moment");

//Class Declaration

function GoogleCal(){
    this.clientID = config.gcal.clientID;
    this.clientSecret = config.gcal.clientSecret;
    this.account = config.gcal.account;

    this.oauth2Client = new OAuth2Client(this.clientID,this.clientSecret)
    this.oauth2Client.credentials = {
        access_token:  config.gcal.access_token,
        refresh_token: config.gcal.refresh_token
    };

    this.hostname = config.gcal.hostname;
    this.path = config.gcal.path;

    this.startDate = moment().startOf("day").toISOString();
	this.endDate = moment().endOf("day").toISOString();
    this.dateWords = ["mon","tue","tues","wed","thur","thurs","fri","sat","sun","monday","tuesday","wednesday","thursday","friday","saturday","yesterday","today","tonight","tomorrow"];

    this.output = [];
    this.outputCount = 0;
    this.outputLimit = 0;
    
    this.ircCallback = function(){};
};

module.exports = function(data){
    return new GoogleCal().set(data);
};

//Class Methods

GoogleCal.prototype = DataModel();

//IRC Methods

GoogleCal.prototype.ircRequest = function(Input){
    this.set({
        ircCallback: Input.callback,
        outputLimit: this.setOutputLimit(Input)
    });
    this.ircRouteRequest(Input);
};

GoogleCal.prototype.ircRouteRequest = function(Input){
    var keyword = Input.method == "onduty" ? "on-call" : Input.method;  
    var date = Input.targetDate !== "" ? Input.targetDate : false;
    var range = (Input.range === 0 ? 1 : Input.range);
    var callback = this.ircHandleResult.bind(this);
    var name = Input.users.length > 0 ? Input.users[0].name : ""; 
    var next = Input.contains("options","next");

    this.getEventsByDate(keyword,date,range,callback,name,next);
};

GoogleCal.prototype.ircHandleResult = function(err,events){
    if (err){
        this.ircHandleError(err);
    }else{
        var l = events.length
        if (l < 1){
            this.setOne("output","Hm, I couldn't find anything for that. Sorry :(");
        }else{
            this.ircEventsFromResult(events);
        }
    }
};

GoogleCal.prototype.ircEventsFromResult = function(events){
    events.forEach(assembleLine.bind(this));

    function assembleLine(elem,ind,arr){
        if (ind < this.outputLimit){
            if (elem.start.date && elem.start.date !== moment(elem.end.date).subtract("days",1).format("YYYY-MM-DD")){
                this.setOne("output","["+moment(elem.start.date).format("ddd MM/DD")+" to "+moment(elem.end.date).subtract("days",1).format("ddd MM/DD")+" | "+elem.summary+"]");
            }else{
                this.setOne("output","["+moment(elem.start.dateTime ? elem.start.dateTime : elem.start.date).format("ddd MM/DD")+" | "+elem.summary+"]");
            }
        }
    }
        this.ircOutputResult();
};

GoogleCal.prototype.ircNamesFromResult = function(err,events){
    if (err){
        this.ircHandleError(err);
    }else{
        for (u in config.users){
            var user = config.users[u];
            if (events[0].summary.indexOf(user.name) > -1){
                this.ircCallback(user.name);
            }
        }
    }
};

GoogleCal.prototype.ircHandleError = function(err){
    console.log(err,"Google Calendar API Request Error");
    this.setOne("output","Bad Google API Response :(");
    this.ircOutputResult();
};

GoogleCal.prototype.ircOutputResult = function(){
    this.ircCallback(this.output);
    this.output = [];
};

//IRC Helper Methods

GoogleCal.prototype.setOutputLimit = function(Input){
    return Input.range > 0 ? Input.range : (Input.method === "ooo" && Input.users.length < 1 ? 99 : 1);
}

//API Methods

GoogleCal.prototype.getEventsByDate = function(keyword,date,range,callback,name,next){
    if (keyword === "on-call"){
        if (name){
            this.getOnDutyByName(date,range,name,next,callback);
        }else{
            this.getOnDuty(date,range,next,callback);
        }
    }else if (keyword === "ooo"){
        if (name){
            this.getOOOByName(date,range,name,next,callback);
        }else{
            this.getOOO(date,range,next,callback);            
        }
    }
};

GoogleCal.prototype.getOnDuty = function(date,range,next,callback){
    var r = this.getDateRange(date,range,"day",next);
    var apiCallback = this.filterResults.bind(this,"on-call","",r.startDate,r.endDate,callback)
    this.getEventsByRange(r.startDate,r.endDate,apiCallback)
};

GoogleCal.prototype.getOOO = function(date,range,next,callback){
    var r = this.getDateRange(date,range,"day",next);
    var apiCallback = this.filterResults.bind(this,"ooo","",r.startDate,r.endDate,callback)
    this.getEventsByRange(r.startDate,r.endDate,apiCallback)
};

GoogleCal.prototype.getOnDutyByName = function(date,range,name,next,callback){
    var r = this.getDateRange(date,range,"month",next);
    var apiCallback = this.filterResults.bind(this,"on-call",name,r.startDate,r.endDate,callback)
    this.getEventsByRange(r.startDate,r.endDate,apiCallback)
};

GoogleCal.prototype.getOOOByName = function(date,range,name,next,callback){
    var r = this.getDateRange(date,range,"month",next);
    var apiCallback = this.filterResults.bind(this,"ooo",name,r.startDate,r.endDate,callback)
    this.getEventsByRange(r.startDate,r.endDate,apiCallback)
};

GoogleCal.prototype.getEventsByRange = function(startDate,endDate,apiCallback){
    var query = {
        calendarId: this.account,
        timeMin: startDate,
        timeMax: endDate,
        orderBy: "startTime",
        singleEvents: true
    };
    this.calendarQuery(query,apiCallback);
};

GoogleCal.prototype.calendarQuery = function(query,apiCallback){
    googleapis.discover("calendar","v3").execute(connect.bind(this));

    function connect(err,client){
        if (err){
            apiCallback(err);
        }else{
            client.calendar.events.list(query).withAuthClient(this.oauth2Client).execute(apiCallback);
        }
    }
};

//API Helper Methods

GoogleCal.prototype.getDateRange = function(date,range,rangeUnit,next){
    var startDate =  moment().startOf("day").toISOString();
    var endDate = moment().endOf("day").toISOString();

    switch (date)
        {
        case "yesterday":
            startDate = this.changeDate("subtract",1,"days",startDate);
            break;
        case "today":
        case "tonight":
            break;
        case "tomorrow":
            startDate = this.changeDate("add",1,"days",startDate);
            break;
        default:
            if (moment(date,"MM/DD")._pf.charsLeftOver == 0){
                startDate = moment(date,"MM/DD").startOf("day").toISOString();
                //If Target Month is Before This Month, Advance to Next Year
                if (moment(startDate).isBefore(moment(),"month")){
                    startDate = moment(startDate).add("year",1).toISOString();
                }
            }else if (moment(date,["MM/DD/YY","MM/DD/YYYY"])._pf.charsLeftOver == 0){
                startDate = moment(date,["MM/DD","MM/DD/YY","MM/DD/YYYY"]).startOf("day").toISOString();
            }else if (this.contains("dateWords",date)){
                startDate = this.toWeekday(date,next);
            }
            break;
        }
        endDate = moment(startDate).endOf(rangeUnit).add(rangeUnit,range-1).toISOString();

    return {"startDate":startDate,"endDate":endDate};
};

GoogleCal.prototype.changeDate = function(mode,amt,unit,target){
    return moment(target)[mode](unit,amt).toISOString(); 
};

GoogleCal.prototype.toWeekday = function(date,next){
    var weekday = moment().day(date).startOf("day").toISOString();
    var dayIsPast = moment(weekday).isBefore(moment(),"day");

    return (dayIsPast || !dayIsPast && next) ? moment(weekday).add("week",1).toISOString() : weekday;
};

GoogleCal.prototype.filterResults = function(keyword,user,startDate,endDate,callback,error,results){
    if (error){
        callback(error);
    }else{
        var events = [];
        results.items.forEach(filterForKeyword);

        function filterForKeyword(elem,index,arr){
            if (elem.summary.toLowerCase().indexOf(keyword) > -1){
                events.push(elem);
            }
        }
        for (i = events.length - 1; i>=0; i--){
            var e = events[i];
            //If Getting Cases for a Specific User, Remove all Events Not for that User
            if (user !== "" && e.summary.indexOf(user) == -1){
                events.splice(events.indexOf(e),1);
            //Multi-Day Event Filtering Fix... Future Events Get Incorrectly Returned by API
            }else if (e.start.date && moment(e.start.date).isAfter(endDate)){
                events.splice(events.indexOf(e),1);
            }
        }
        callback(null,events);
    }
};
