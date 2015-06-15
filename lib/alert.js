var config = require("../config/config.js");
var DataModel = require("../model/datamodel.js");

var twilio = require("twilio");
var moment = require("moment");

//Class Declaration

function Alert(){
    this.account = config.twilio.account;
    this.token = config.twilio.token;

    this.twilioClient = new twilio.RestClient(this.account,this.token);

    this.output = [];
    this.chatCallback = function(){};
};

module.exports = function(data){
    return new Alert().set(data);
};

//Class Methods

Alert.prototype = DataModel();

//Chat Methods

Alert.prototype.chatRequest = function(Input){
    this.setOne("chatCallback",Input.callback);
    var message = Input.fullText;
    var from = Input.from;
    var callback = this.chatAssembleResults.bind(this);
    this.alertAll(message,from,callback);
};

Alert.prototype.alertAll = function(message,from,callback){
    var body = message.substring(0,157);
    var d = moment().format("llll") + " EST";
    var m = d+"   "+body+"  | Sent By "+from;
    var data = {
        to: config.twilio.all,
        from: config.twilio.from,
        body: m
    };
    this.twilioClient.sms.messages.create(data,callback);    
};

Alert.prototype.chatAssembleResults = function(err,res){
    if (err){
        this.setOne("output","Bad Response, Alert Failed :(");
    }else{
        try {
            this.setOne("output",res.body);
            console.log(res.body);
        } catch(err) {
            this.setOne("output","Bad Response from Twilio :(");
        }
    }
    this.chatOutputResult();
};

Alert.prototype.chatOutputResult = function(){
    this.chatCallback(this.output);
    this.output = [];
};