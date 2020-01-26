class User{
    constructor(id_,name_){
        this.id=id_;
        this.cards=[];
        this.name=name_;
        this.connected=true;
        this.currentChance=false;
        this.currentCard=null;
    }
}
module.exports=User;