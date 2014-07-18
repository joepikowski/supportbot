//Class Declaration

function User(){
    this.name = "";
    this.aliases = [];
    this.email = "";
    this.phone = "";
    this.vbx = "";
}

module.exports = function(names,email,phone,vbx){
    return new User().update(Array().slice.call(arguments));
}

//Class Methods

User.prototype.update = function(data){
    if (data instanceof Array){
        this.name = data[0];
        this.aliases = data[1];
        this.email = data[2];
        this.phone = data[3];
        this.zendesk = data[4];
        this.vbx = data[5];
    }
    return this;
};