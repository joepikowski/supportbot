//Class Declaration
function DataModel(){
}

module.exports = function(){ 
    return new DataModel(); 
};

//Class Methods
DataModel.prototype.setOne = function(param,value){
    var p = this[param];

    if (p instanceof Function || typeof p == "string" || typeof p == "number"){
        this[param] = value;
    }else if (p instanceof Array){
        value instanceof Array ? value.forEach(add.bind(this)) : this[param].push(value);

        function add(elem,ind,arr){
            this[param].push(elem);
        }
    }else if (p instanceof Object){
        for (v  in value){ 
            this[param][v] = value[v]; 
        }
    }
    return this;
};

DataModel.prototype.set = function(data){
    if (data instanceof Object){
        for (d in data){
            this.setOne(d,data[d]);
        }
    }
    return this;
};

DataModel.prototype.contains = function(param,value){
    if (this[param] instanceof Array && this[param].indexOf(value) > -1){
        return true;
    }else if (this[param] instanceof Object && this[param][value] !== undefined){
        return true;
    }
    return false;
};