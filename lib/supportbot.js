var config = require("../config/config.js");
var irc = require("irc");
var InputModel = require("../model/inputmodel.js");
var cronJob = require("cron").CronJob;

var Monitor = require("./monitor.js")
var Wolfram = require("./wolfram.js");
var Zendesk = require("./zendesk.js");
var OpenVBX = require("./openvbx.js");
var GoogleCal = require("./googlecal.js");
var WtfDocs = require("./wtfdocs.js");

//Class Declaration

function SupportBot(){
    var c = config;
    this.ircClient = new irc.Client(c.irc.path,c.irc.nick,c.irc);
    this.monitor = Monitor();
}

module.exports = function(){ 
    return new SupportBot(); 
};

//Class Methods

SupportBot.prototype.start = function(){
    this.ircClient.addListener("message",this.listen.bind(this));
    this.ircClient.addListener("error",this.log.bind(this));

    this.startCrons();
};

SupportBot.prototype.startCrons = function(){
    new cronJob("0 */1 * * * *",this.pingSelf.bind(this),null,true);
    new cronJob("0 */1 * * * *",this.checkInbox.bind(this),null,true);
    new cronJob("0 */1 * * * *",this.stabilityCheck.bind(this),null,true);
    //new cronJob("0 0 14 * * mon-fri",this.quietHours.bind(this,"on"),null,true);
    //new cronJob("0 0 16 * * mon-fri",this.quietHours.bind(this,"off"),null,true);

    new cronJob("0 0 4 * * mon-fri",this.setAgentOnDuty.bind(this,"Kirsty"),null,true);
    new cronJob("0 0 18,21 * * mon-fri",this.setAgentOnDuty.bind(this,"Robert"),null,true);
    new cronJob("0 0 20 * * mon-fri",this.setAgentOnDuty.bind(this,"Elizabeth"),null,true);
    new cronJob("0 0 11,12,23 * * mon-fri",this.getAgentOnDuty.bind(this),null,true);
    new cronJob("0 0 0 * * sat,sun",this.getAgentOnDuty.bind(this),null,true);
};

SupportBot.prototype.say = function(to,lines){
    lines.forEach(sayEach.bind(this));

    function sayEach(elem,ind,arr){
        this.ircClient.say(to,elem);
    }
};

SupportBot.prototype.log = function(error){
   console.log(error);
};

SupportBot.prototype.listen = function(from,target,text,message){
    if (text.indexOf("!") === 0){
        var parsedLine = text.toLowerCase().split(" ");
        var to = (target == config.irc.nick ? from : target);
        var Input = InputModel({
            "to": to,
            "from": from,
            "fromUser": this.setUser(from),
            "fullText": text.split(" ").slice(1).join(" "),
            "method": parsedLine[0].slice(1),
            "args": parsedLine.slice(1),
            "callback": this.say.bind(this,to)
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
            this.ircClient.action(Input.to,["waves bye to "+Input.from+"."]);
            break;
        case "join":
            this.say(Input.to,["Meet you there!"]);
            this.ircClient.join(Input.fullText);
            break;
        case "leave":
        case "scram":
            this.say(Input.to,["Didn't know this was a private party :("]);
            this.ircClient.part(Input.fullText !== "" ? Input.fullText : Input.to);
            break;
        case "onduty":
        case "ooo":
        case "wfh":
            GoogleCal().ircRequest(Input);
            break;
        case "zd":
            Zendesk().ircRequest(Input);
            break;
        case "wa":
            Wolfram().ircRequest(Input,false);
            break;
        case "wav":
            Wolfram().ircRequest(Input,true);
            break;	
        case "ts":
            this.listen(Input.from,Input.to,"!wa unix "+Input.fullText+" est");
            break;  
        case "help":
            this.say(Input.to,["Check out [ https://sites.google.com/a/sailthru.com/sailthru-intranet/departments/client-services/support/supportbot ] for my documentation!"]);
            break;
        case "vbx":
            OpenVBX().ircRequest(Input);
            break;
        case "hodor":
            this.say(Input.to,["Hodor."]);
            break;
        case "wtf":
            WtfDocs().ircRequest(Input);
            break;
        case "mon":
            this.say(Input.to,this.monitor.checkMonitor());
            break;
        case "joequotes":
            this.say(Input.to,["I don't like fun."]);
            break;
        case "josequotes":
            this.say(Input.to,["No me gusta la diversión."]);
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

SupportBot.prototype.pingSelf = function(){
    this.say(config.irc.nick,["Ping."]);
};

SupportBot.prototype.quietHours = function(state){
    var startMessage = "--[ Support Team ] DING! Quiet Hours Have Begun. <(^_^)>";
    var endMessage = "--[ Support Team ] DING! Quiet Hours Are Now Over. Cry 'Havoc!', and let slip the dogs of war.";
    this.say("#support",[(state == "on" ? startMessage : endMessage)]);
};

SupportBot.prototype.checkInbox = function(){
    var zd = Zendesk({ircCallback: this.say.bind(this,"#support")});
    zd.checkInbox(zd.ircAutoInboxCheck.bind(zd));
};

SupportBot.prototype.stabilityCheck = function(){
    this.monitor.ircCheck(this.say.bind(this,"#support"));
};

SupportBot.prototype.getAgentOnDuty = function(){
    var gcal = GoogleCal({ircCallback: this.setAgentOnDuty.bind(this)});
    gcal.getOnDuty("today",1,false,gcal.ircNamesFromResult.bind(gcal));
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
    }else if (result.length > 0 && hour < 23 && (day !== 5 || hour < 18))){ 
        console.log("Declining to set "+user.name+" on duty because they are OOO.");
        var b = config.backup[hour][user.name];
        if (b == "OnDuty"){
            this.getAgentOnDuty();
        }else if (b !== "End"){
            this.setAgentOnDuty(b);
        }
    }else{
        this.setSailbotOnDuty("!ondutycs "+user.name+"<"+user.phone+">");
        console.log("Setting "+user.name+" on duty.");
    }
};

SupportBot.prototype.setSailbotOnDuty = function(command){
    this.say("Sailbot",[command]);
};
