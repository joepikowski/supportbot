var DataModel = require("./datamodel.js");

//Class Declaration

function RequestModel(){
    this.protocol = "HTTP";
    this.hostname = "";
    this.path = "";
    this.method = "GET";
    this.headers = {};

    this.body = "";
    this.callback = function(){};
}

module.exports = function(data){ 
    return new RequestModel().set(data); 
};

//Class Methods

RequestModel.prototype = DataModel();

RequestModel.prototype.options = function(){
	var options = {};
    var optionReturn = ["hostname","path","method","headers"];
	
    optionReturn.forEach(assembleOptions.bind(this));
	
    function assembleOptions(elem,ind,arr){
		options[elem] = this[elem]
	};

	return options;
};