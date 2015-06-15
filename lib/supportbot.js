var config = require("../config/config.js");
var slack = require("slack-client");
var InputModel = require("../model/inputmodel.js");
var cronJob = require("cron").CronJob;

var Monitor = require("./monitor.js")
var Wolfram = require("./wolfram.js");
var Zendesk = require("./zendesk.js");
var OpenVBX = require("./openvbx.js");
var GoogleCal = require("./googlecal.js");
var WtfDocs = require("./wtfdocs.js");
var Giphy = require("./giphy.js");
var Alert = require("./alert.js");

//Class Declaration

function SupportBot(){
    var c = config;
    this.slackClient = new slack(c.slack.token,c.slack.autoReconnect,c.slack.autoMark);
    this.monitor = Monitor();
}

module.exports = function(){ 
    return new SupportBot(); 
};

//Class Methods

SupportBot.prototype.start = function(){
    this.slackClient.on("message",this.listen.bind(this));
    this.slackClient.on("error",this.log.bind(this));
    this.slackClient.login();

    this.startCrons();
};

SupportBot.prototype.startCrons = function(){
    //new cronJob("0 */1 * * * *",this.pingSelf.bind(this),null,true);
    new cronJob("0 */1 * * * *",this.checkInbox.bind(this),null,true);
    new cronJob("0 */1 * * * *",this.stabilityCheck.bind(this),null,true);
    //new cronJob("0 0 14 * * mon-fri",this.quietHours.bind(this,"on"),null,true);
    //new cronJob("0 0 16 * * mon-fri",this.quietHours.bind(this,"off"),null,true);

    //No Sailbot in Slack
    //new cronJob("0 0 4,5 * * mon-fri",this.setAgentOnDuty.bind(this,"Kirsty"),null,true);
    //new cronJob("0 0 18,21 * * mon-fri",this.setAgentOnDuty.bind(this,"Robert"),null,true);
    //new cronJob("0 0 20 * * mon-fri",this.setAgentOnDuty.bind(this,"Elizabeth"),null,true);
    //new cronJob("0 0 11,12,23 * * mon-fri",this.getAgentOnDuty.bind(this),null,true);
    //new cronJob("0 0 0 * * sat,sun",this.getAgentOnDuty.bind(this),null,true);
};

SupportBot.prototype.say = function(to,lines){
    lines.forEach(sayEach.bind(this));

    function sayEach(elem,ind,arr){
        to.send(elem);
    }
};

SupportBot.prototype.log = function(error){
   console.log(error);
};

SupportBot.prototype.listen = function(message){
    var channel = this.slackClient.getChannelGroupOrDMByID(message.channel);
    var user = this.slackClient.getUserByID(message.user);
    var userName = user != null ? user.name : "";
    var text = message.text ? message.text : "";

    if (text.indexOf("!") === 0){
        var parsedLine = text.toLowerCase().split(" ");
        var Input = InputModel({
            "to": channel,
            "from": userName,
            "fromUser": this.setUser(userName),
            "fullText": text.split(" ").slice(1).join(" "),
            "method": parsedLine[0].slice(1),
            "args": parsedLine.slice(1),
            "callback": this.say.bind(this,channel)
        });
        this.parseInput(Input);
    }
};

SupportBot.prototype.setUser = function(name){
    var match = false;
    for (u in config.users){
        config.users[u].aliases.forEach(findMatch);

        function findMatch(elem,ind,arr){
            if (name.toLowerCase().indexOf(elem) > -1){
                match = config.users[u];
            }
        }
    }
    return match;
};

SupportBot.prototype.parseInput = function(Input){
    Input.args.forEach(setParams.bind(this));
    
    function setParams(elem,ind,arr){
        if (this.setUser(elem)){
            Input.setOne("users",this.setUser(elem));
        }else if (Input.containsWords("command",elem)){
            Input.setOne("command",elem);
        }else if (Input.containsWords("status",elem)){
            Input.setOne("status",elem);
        }else if (Input.containsWords("option",elem)){
            Input.setOne("options",elem);
        }else if ( !isNaN(elem) ){
            Input.parseNum(elem);
        }else if (Input.isDate(elem)){
            Input.setOne("targetDate",elem);
        }else{
            Input.setOne("unused",elem);
        }
    }
    this.execute(Input);
};

SupportBot.prototype.execute = function(Input){
    switch(Input.method)
        {
        case "hello":
        case "hi":
            this.say(Input.to,["Hi "+Input.from+"!"]);
            break;
        case "bye":
        case "goodbye":
            this.say(Input.to,["/me waves bye to "+Input.from+"."]);
            break;
        //case "join":
            //this.say(Input.to,["Meet you there!"]);
            //this.chatClient.join(Input.fullText);
            //break;
        //case "leave":
        //case "scram":
            //this.say(Input.to,["Didn't know this was a private party :("]);
            //this.chatClient.part(Input.fullText !== "" ? Input.fullText : Input.to);
            //break;
        case "onduty":
        case "ooo":
        case "wfh":
            GoogleCal().chatRequest(Input);
            break;
        case "zd":
            Zendesk().chatRequest(Input);
            break;
        case "wa":
            Wolfram().chatRequest(Input,false);
            break;
        case "wav":
            Wolfram().chatRequest(Input,true);
            break;	
        case "ts":
            Input.fullText = "unix "+Input.fullText+" est"
            Wolfram().chatRequest(Input,false);
            break;  
        case "help":
            this.say(Input.to,["Check out [ https://sites.google.com/a/sailthru.com/sailthru-intranet/departments/client-services/support/supportbot ] for my documentation!"]);
            break;
        case "vbx":
            OpenVBX().chatRequest(Input);
            break;
        case "hodor":
            this.say(Input.to,["Hodor."]);
            break;
        case "wtf":
            WtfDocs().chatRequest(Input);
            break;
        case "mon":
            this.say(Input.to,this.monitor.checkMonitor());
            break;
        case "gif":
        case "giphy":
            Giphy().chatRequest(Input);
            break;
        case "alert":
            Alert().chatRequest(Input);
            break;
        case "joequotes":
            this.say(Input.to,["Let's get this money."]);
            break;
        case "josequotes":
            this.say(Input.to,["No me gusta la diversión."]);
            break;
        case "shruggiequotes":
            this.say(Input.to,["¯\_(ツ)_/¯"]);
            break;
        case "irinaquotes":
            this.say(Input.to,["http://i.imgur.com/Z8mFGXl.gifv"]);
            break;
        case "obamaquotes":
            this.say(Input.to,["You take these zeroes and ones, you take two numbers — yes or no — those can be translated into electrical messages that run through the computer."]);
            break;
        default:
            this.say(Input.to,["Not sure what "+Input.method+" means. Try !help for everything I understand."]);
            break; 
        }
};

//Cron Functions

SupportBot.prototype.quietHours = function(state){
    var startMessage = "--[ Support Team ] DING! Quiet Hours Have Begun. <(^_^)>";
    var endMessage = "--[ Support Team ] DING! Quiet Hours Are Now Over. Cry 'Havoc!', and let slip the dogs of war.";
    var channel = this.slackClient.getChannelGroupOrDMByName("support");
    this.say(channel,[(state == "on" ? startMessage : endMessage)]);
};

SupportBot.prototype.checkInbox = function(){
    var channel = this.slackClient.getChannelGroupOrDMByName("support");
    var zd = Zendesk({chatCallback: this.say.bind(this,channel)});
    zd.checkInbox(zd.chatAutoInboxCheck.bind(zd));
};

SupportBot.prototype.stabilityCheck = function(){
    var channel = this.slackClient.getChannelGroupOrDMByName("support");
    this.monitor.chatCheck(this.say.bind(this,channel));
};

SupportBot.prototype.getAgentOnDuty = function(){
<<<<<<< HEAD
    var gcal = GoogleCal({ircCallback: this.setAgentOnDuty.bind(this)});
    gcal.getOnDuty(config.gcal.supportCalendar,"today",1,false,gcal.ircNamesFromResult.bind(gcal));
=======
    var gcal = GoogleCal({chatCallback: this.setAgentOnDuty.bind(this)});
    gcal.getOnDuty("today",1,false,gcal.chatNamesFromResult.bind(gcal));
>>>>>>> Reconfigure supportbot.js for Slack, Make IRC Methods Generic
};

SupportBot.prototype.setAgentOnDuty = function(name){
    var user = this.setUser(name);
    GoogleCal().isOOO(name,this.processAgentOnDuty.bind(this,user));
};

SupportBot.prototype.processAgentOnDuty = function(user,err,result){
    var d = new Date();
    var hour = d.getHours();
    var day = d.getDay();
    if (err){
        console.log("Error setting "+user.name+" on duty.");
    }else if (result.length > 0 && hour < 23 && (day !== 5 || hour < 18)){ 
        console.log("Declining to set "+user.name+" on duty because they are OOO.");
        var b = config.backup[hour][user.name];
        if (b == "OnDuty"){
            this.getAgentOnDuty();
        }else if (b && b !== "End"){
            this.setAgentOnDuty(b);
        }else{
            console.log("[WARN] Could not find a backup plan for Hour "+hour+".");
        }
    }else{
        this.setSailbotOnDuty("!ondutycs "+user.name+"<"+user.phone+">");
        console.log(d+" Setting "+user.name+" on duty with phone # "+user.phone+" .");
    }
};

SupportBot.prototype.setSailbotOnDuty = function(command){
    this.say("Sailbot",[command]);
};
