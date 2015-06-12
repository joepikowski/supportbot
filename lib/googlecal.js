var config = require("../config/config.js");
var DataModel = require("../model/datamodel.js");

var google = require("googleapis");
var OAuth2Client = google.auth.OAuth2;
var calendar = google.calendar("v3");
var moment = require("moment");

//Class Declaration

function GoogleCal(){
    this.clientID = config.gcal.clientID;
    this.clientSecret = config.gcal.clientSecret;
    this.supportCalendar = config.gcal.supportCalendar;
    this.pdCalendar = config.gcal.pdCalendar;

    this.oauth2Client = new OAuth2Client(this.clientID,this.clientSecret)
    this.oauth2Client.credentials = {
        access_token:  config.gcal.access_token,
        refresh_token: config.gcal.refresh_token
    };

    this.hostname = config.gcal.hostname;
    this.path = config.gcal.path;

    this.startDate = moment().startOf("day").toISOString();
	this.endDate = moment().endOf("day").toISOString();
    this.dateWords = ["mon","tue","tues","wed","thur","thurs","fri","sat","sun","monday","tuesday","wednesday","thursday","friday","saturday","sunday","yesterday","today","tonight","tomorrow"];

    this.query = {};
    this.apiCallback = function(){};

    this.output = [];
    this.outputCount = 0;
    this.outputLimit = 0;
    
    this.chatCallback = function(){};
};

module.exports = function(data){
    return new GoogleCal().set(data);
};

//Class Methods

GoogleCal.prototype = DataModel();

//Chat Methods

GoogleCal.prototype.chatRequest = function(Input){
    this.set({
        input: Input,
        chatCallback: Input.callback,
        outputLimit: this.setOutputLimit(Input)
    });
    this.chatRouteRequest(Input);
};

GoogleCal.prototype.chatRouteRequest = function(Input){
    var keyword = Input.method == "onduty" ? "on call" : Input.method;  
    var date = Input.targetDate !== "" ? Input.targetDate : false;
    var range = (Input.range === 0 ? 1 : Input.range);
    var callback = this.chatHandleResult.bind(this);
    var name = Input.users.length > 0 ? Input.users[0].name : ""; 
    var next = Input.contains("options","next");
    var calendar = Input.method == "onduty" ? this.pdCalendar : this.supportCalendar;
    this.getEventsByDate(calendar,keyword,date,range,callback,name,next);
};

GoogleCal.prototype.chatHandleResult = function(err,events){
    if (err){
        this.chatHandleError(err);
    }else{
        var l = events.length;
        if (l < 1){
            this.setOne("output","Hm, I couldn't find anything for that. Sorry :(");
            this.chatOutputResult();
        }else{
            this.chatEventsFromResult(events);
        }
    }
};

GoogleCal.prototype.chatEventsFromResult = function(events){
    events.forEach(assembleLine.bind(this));

    function assembleLine(elem,ind,arr){
        try{
            if (ind < this.outputLimit){
                if (moment(elem.start.dateTime).format("MM/DD") !== moment(elem.end.dateTime).format("MM/DD")){
                    this.setOne("output","["+moment(elem.start.dateTime).format("ddd MM/DD ha")+" - "+moment(elem.end.dateTime).format("ddd MM/DD ha")+" | "+elem.summary+"]");
                }else{
                    this.setOne("output","["+moment(elem.start.dateTime ? elem.start.dateTime : elem.start.date).format("ddd MM/DD")+" | "+elem.summary+"]");
                }
            }
        }catch(err){
            this.setOne("output","Hm, I couldn't find anything for that. Sorry :(");
            this.ircOutputResult();
        }
    }
        this.chatOutputResult();
};

GoogleCal.prototype.chatNamesFromResult = function(err,events){
    if (err){
        this.chatHandleError(err);
    }else{
        for (u in config.users){
            var user = config.users[u];
<<<<<<< HEAD
            if (events.length > 0 && events[0].summary.indexOf(user.name) > -1){
                this.ircCallback(user.name);
=======
            if (events[0].summary.indexOf(user.name) > -1){
                this.chatCallback(user.name);
>>>>>>> Change IRC References to More Generic 'Chat'
            }
        }
    }
};

GoogleCal.prototype.chatHandleError = function(err){
    console.log(err,"Google Calendar API Request Error");
    this.setOne("output","Bad Google API Response :(");
    this.chatOutputResult();
};

GoogleCal.prototype.chatOutputResult = function(){
    this.chatCallback(this.output);
    this.output = [];
};

//Chat Helper Methods

GoogleCal.prototype.setOutputLimit = function(Input){
    //return Input.range > 0 ? Input.range : (Input.method === "ooo" && Input.users.length < 1 ? 99 : 1);
    return Input.range > 0 ? Input.range : 99;
}

//API Methods

GoogleCal.prototype.getEventsByDate = function(calendar,keyword,date,range,callback,name,next){
    if (keyword === "on call"){
        if (name){
            this.getOnDutyByName(calendar,date,range,name,next,callback);
        }else{
            this.getOnDuty(calendar,date,range,next,callback);
        }
    }else if (keyword === "ooo"){
        if (name){
            this.getOOOByName(calendar,date,range,name,next,callback);
        }else{
            this.getOOO(calendar,date,range,next,callback);            
        }
    }else if (keyword === "wfh"){
        if (name){
            this.getWFHByName(calendar,date,range,name,next,callback);
        }else{
            this.getWFH(calendar,date,range,next,callback);            
        }
    }
};

GoogleCal.prototype.getOnDuty = function(calendar,date,range,next,callback){
    var r = this.getDateRange(date,range,"day",next);
    var apiCallback = this.filterResults.bind(this,"on call","",r.startDate,r.endDate,callback)
    this.getEventsByRange(calendar,r.startDate,r.endDate,apiCallback)
};

GoogleCal.prototype.getOOO = function(calendar,date,range,next,callback){
    var r = this.getDateRange(date,range,"day",next);
    var apiCallback = this.filterResults.bind(this,"ooo","",r.startDate,r.endDate,callback)
    this.getEventsByRange(calendar,r.startDate,r.endDate,apiCallback)
};

GoogleCal.prototype.getWFH = function(calendar,date,range,next,callback){
    var r = this.getDateRange(date,range,"day",next);
    var apiCallback = this.filterResults.bind(this,"wfh","",r.startDate,r.endDate,callback)
    this.getEventsByRange(calendar,r.startDate,r.endDate,apiCallback)
};

GoogleCal.prototype.getOnDutyByName = function(calendar,date,range,name,next,callback){
    var r = this.getDateRange(date,range,"month",next);
    var apiCallback = this.filterResults.bind(this,"on call",name,r.startDate,r.endDate,callback)
    this.getEventsByRange(calendar,r.startDate,r.endDate,apiCallback)
};

GoogleCal.prototype.getOOOByName = function(calendar,date,range,name,next,callback){
    var r = this.getDateRange(date,range,"month",next);
    var apiCallback = this.filterResults.bind(this,"ooo",name,r.startDate,r.endDate,callback)
    this.getEventsByRange(calendar,r.startDate,r.endDate,apiCallback)
};

GoogleCal.prototype.isOOO = function(name,callback){
    var calendar = this.supportCalendar; 
    this.getOOOTodayByName(calendar,name,callback);
};

GoogleCal.prototype.getOOOTodayByName = function(calendar,name,callback){
    var r = this.getDateRange("today",1,"day",false);
    var apiCallback = this.filterResults.bind(this,"ooo",name,r.startDate,r.endDate,callback)
    this.getEventsByRange(calendar,r.startDate,r.endDate,apiCallback)
};

GoogleCal.prototype.getWFHByName = function(calendar,date,range,name,next,callback){
    var r = this.getDateRange(date,range,"month",next);
    var apiCallback = this.filterResults.bind(this,"wfh",name,r.startDate,r.endDate,callback)
    this.getEventsByRange(calendar,r.startDate,r.endDate,apiCallback)
};

GoogleCal.prototype.getEventsByRange = function(calendar,startDate,endDate,apiCallback){
    this.query = {
        calendarId: calendar,
        auth: this.oauth2Client,
        timeMin: startDate,
        timeMax: endDate,
        orderBy: "startTime",
        singleEvents: true
    };
    this.apiCallback = apiCallback;
    this.calendarQuery(this.query,this.apiCallback);
};

GoogleCal.prototype.calendarQuery = function(query,apiCallback){
    calendar.events.list(query,apiCallback);
};

//API Helper Methods

GoogleCal.prototype.getDateRange = function(date,range,rangeUnit,next){
    var startDate =  moment().startOf("day").add(4,"hours").toISOString();
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
                startDate = moment(date,"MM/DD").startOf("day").add(4,"hours").toISOString();
                //If Target Month is Before This Month, Advance to Next Year
                if (moment(startDate).isBefore(moment(),"month")){
                    startDate = moment(startDate).add(1,"year").toISOString();
                }
            }else if (moment(date,["MM/DD/YY","MM/DD/YYYY"])._pf.charsLeftOver == 0){
                startDate = moment(date,["MM/DD","MM/DD/YY","MM/DD/YYYY"]).startOf("day").add(4,"hours").toISOString();
            }else if (this.contains("dateWords",date)){
                startDate = this.toWeekday(date,next);
            }
            break;
        }
        endDate = moment(startDate).endOf(rangeUnit).add(range-1,rangeUnit).toISOString();

    return {"startDate":startDate,"endDate":endDate};
};

GoogleCal.prototype.changeDate = function(mode,amt,unit,target){
    return moment(target)[mode](amt,unit).toISOString(); 
};

GoogleCal.prototype.toWeekday = function(date,next){
    var weekday = moment().day(date).startOf("day").add(4,"hours").toISOString();
    var dayIsPast = moment(weekday).isBefore(moment(),"day");

    return (dayIsPast || !dayIsPast && next) ? moment(weekday).add(1,"week").toISOString() : weekday;
};

GoogleCal.prototype.filterResults = function(keyword,user,startDate,endDate,callback,error,results){
    if (error){
        if (error.code === 401){
            this.oauth2Client.refreshAccessToken(requeue.bind(this));
            function requeue(err,tokens){
                if (err){
                    callback(err);
                }else{
                    this.calendarQuery(this.query,this.apiCallback);
                }
            }
        }else{
            callback(error);
        }
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
