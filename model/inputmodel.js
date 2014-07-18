var moment = require("moment");
var DataModel = require("./datamodel.js");

//Class Declaration

function InputModel(){
    
    this.optionWords = ["next","only"];
    this.commandWords = ["pass","take","on","off"];
    this.statusWords = ["new","open","pending","closed","solved"];
    this.dateWords = ["mon","tue","tues","wed","thur","thurs","fri","sat","sun","monday","tuesday","wednesday","thursday","friday","saturday","yesterday","today","tonight","tomorrow"];
    
    this.to = "";
    this.from = "";
    this.fromUser = [];
    this.method = "";
    this.args = [];
    this.unused = [];
    this.fullText = "";

    this.users = [];
    this.command = "";
    this.range = 0;
    this.options = [];

    this.targetDate = "";

    this.case = "";
    this.status = "";

    this.callback = function(){};
}

module.exports = function(data){ 
    return new InputModel().set(data); 
};

//Class Methods

InputModel.prototype = DataModel();

InputModel.prototype.containsWords = function(param,value){
    if (this[param+"Words"] instanceof Array && this[param+"Words"].indexOf(value) > -1){
        return true;
    }
    return false;
};

InputModel.prototype.isDate = function(value){
    return (this.containsWords("date",value) || moment(value,"M/DD","MM/DD","MM/DD/YY","MM/DD/YYYY")._pf.charsLeftOver == 0);
};

InputModel.prototype.parseNum = function(value){
    if (value.length >= 3){
		this.setOne("case",value);
    }else if (value.length < 3){
        this.setOne("range",value);
    }
};

