class User{
    constructor(id_,name_){
        this.id=id_;
        this.win=false;
        this.cards=[];
        this.name=name_;
        this.connected=true;
    }
}
module.exports=User;